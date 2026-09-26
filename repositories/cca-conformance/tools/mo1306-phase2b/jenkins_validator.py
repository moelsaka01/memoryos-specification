"""Independent, non-executing MO-1306 Jenkins restricted-grammar validator.

No generator/product imports. A character scanner tokenizes literals separately
from code, recursive descent builds a closed Declarative Pipeline AST, and a
second recognizer decodes the fixed PowerShell tokens. Native PowerShell
parse-only AST validation is an additional mandatory conformance layer.
This module neither executes Groovy nor simulates Jenkins or its plugins.
"""
from dataclasses import dataclass
import re

PARSER_ID = "memoryos.conformance.jenkins.restricted-parser"
PARSER_VERSION = "1.0.0"
MAX_BYTES = 32768
LABEL = re.compile(r"[A-Za-z0-9_-]{1,64}\Z", re.ASCII)
DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z", re.ASCII)


class JenkinsValidationError(ValueError):
    """Input is outside the frozen Jenkins subset."""


def require(condition, message):
    if not condition:
        raise JenkinsValidationError(message)


@dataclass(frozen=True)
class Token:
    kind: str
    value: str
    offset: int


def decode_bytes(data):
    require(type(data) is bytes and 0 < len(data) <= MAX_BYTES, "provider byte bound")
    try:
        source = data.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise JenkinsValidationError("invalid UTF-8") from error
    require(not source.startswith("\ufeff"), "BOM forbidden")
    require(source.endswith("\n") and not source.endswith("\n\n"), "one final LF required")
    require(all(c == "\n" or (ord(c) >= 32 and not 127 <= ord(c) <= 159)
                for c in source), "control character forbidden")
    return source


class Lexer:
    """Bounded character scanner; strings are tokens, never evaluated code."""
    def __init__(self, source, powershell=False):
        self.source, self.powershell, self.cursor = source, powershell, 0

    def string(self):
        start = self.cursor
        triple = self.source.startswith("'''", start)
        require(not (triple and self.powershell), "PowerShell triple string forbidden")
        self.cursor += 3 if triple else 1
        characters = []
        while self.cursor < len(self.source):
            if triple and self.source.startswith("'''", self.cursor):
                self.cursor += 3
                return Token("SCRIPT", "".join(characters), start)
            current = self.source[self.cursor]
            if not triple and current == "'":
                self.cursor += 1
                return Token("STRING", "".join(characters), start)
            require(triple or current != "\n", "multiline ordinary literal forbidden")
            # Groovy processes backslashes even in triple-single-quoted strings.
            # No escape occurs in the fixed script; label escapes fail its alphabet.
            if current == "\\":
                require(not triple and not self.powershell, "script escape forbidden")
                self.cursor += 1
                require(self.cursor < len(self.source), "unfinished string escape")
                current = self.source[self.cursor]
                require(current in ("'", "\\"), "unsupported string escape")
            characters.append(current)
            self.cursor += 1
        raise JenkinsValidationError("unterminated string")

    def tokens(self):
        result = []
        while self.cursor < len(self.source):
            start, current = self.cursor, self.source[self.cursor]
            if current == " ":
                self.cursor += 1
                continue
            if current == "\n":
                result.append(Token("NEWLINE", current, start))
                self.cursor += 1
            elif current == "'":
                result.append(self.string())
            elif current in "{}():," or (self.powershell and current in "=&"):
                result.append(Token(current, current, start))
                self.cursor += 1
            elif current in "0123456789":
                self.cursor += 1
                while self.cursor < len(self.source) and self.source[self.cursor] in "0123456789":
                    self.cursor += 1
                value = self.source[start:self.cursor]
                require(len(value) <= 8 and (value == "0" or not value.startswith("0")), "invalid integer")
                result.append(Token("INTEGER", value, start))
            elif current.isascii() and (current.isalpha() or current == "_" or
                                        (self.powershell and current in "$-")):
                self.cursor += 1
                alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_"
                if self.powershell:
                    alphabet += ":-"
                while self.cursor < len(self.source) and self.source[self.cursor] in alphabet:
                    self.cursor += 1
                result.append(Token("IDENTIFIER", self.source[start:self.cursor], start))
            else:
                raise JenkinsValidationError(f"forbidden token at offset {start}")
        result.append(Token("EOF", "", self.cursor))
        return result


@dataclass(frozen=True)
class Agent:
    label: str


@dataclass(frozen=True)
class Options:
    skip_default_checkout: bool
    timeout: int
    unit: str


@dataclass(frozen=True)
class Checkout:
    source: str


@dataclass(frozen=True)
class PowerShell:
    encoding: str
    script: str


@dataclass(frozen=True)
class Stage:
    name: str
    steps: tuple


@dataclass(frozen=True)
class Pipeline:
    agent: Agent
    options: Options
    stages: tuple


class Cursor:
    def __init__(self, tokens):
        self.tokens, self.index = tokens, 0

    def take(self, kind, value=None):
        token = self.tokens[self.index]
        require(token.kind == kind and (value is None or token.value == value),
                f"expected {kind} {value!r} at offset {token.offset}")
        self.index += 1
        return token.value

    def keyword(self, value):
        return self.take("IDENTIFIER", value)


class PipelineParser(Cursor):
    """Recursive-descent parser for the retained section 16.3 grammar."""
    def agent(self):
        self.keyword("agent")
        self.take("{")
        self.take("NEWLINE")
        self.keyword("label")
        result = Agent(self.take("STRING"))
        self.take("NEWLINE")
        self.take("}")
        self.take("NEWLINE")
        return result

    def options(self):
        self.keyword("options")
        self.take("{")
        self.take("NEWLINE")
        self.keyword("skipDefaultCheckout")
        self.take("(")
        self.take(")")
        self.take("NEWLINE")
        self.keyword("timeout")
        self.take("(")
        self.keyword("time")
        self.take(":")
        timeout = int(self.take("INTEGER"))
        self.take(",")
        self.keyword("unit")
        self.take(":")
        unit = self.take("STRING")
        self.take(")")
        self.take("NEWLINE")
        self.take("}")
        self.take("NEWLINE")
        return Options(True, timeout, unit)

    def stage(self):
        self.keyword("stage")
        self.take("(")
        name = self.take("STRING")
        self.take(")")
        self.take("{")
        self.take("NEWLINE")
        self.keyword("steps")
        self.take("{")
        self.take("NEWLINE")
        self.keyword("checkout")
        checkout = Checkout(self.take("IDENTIFIER"))
        self.take("NEWLINE")
        self.keyword("powershell")
        self.take("(")
        self.keyword("encoding")
        self.take(":")
        encoding = self.take("STRING")
        self.take(",")
        self.keyword("script")
        self.take(":")
        script = self.take("SCRIPT")
        self.take(")")
        self.take("NEWLINE")
        self.take("}")
        self.take("NEWLINE")
        self.take("}")
        self.take("NEWLINE")
        return Stage(name, (checkout, PowerShell(encoding, script)))

    def parse(self):
        self.keyword("pipeline")
        self.take("{")
        self.take("NEWLINE")
        agent, options = self.agent(), self.options()
        self.keyword("stages")
        self.take("{")
        self.take("NEWLINE")
        stages = (self.stage(),)
        self.take("}")
        self.take("NEWLINE")
        self.take("}")
        self.take("NEWLINE")
        self.take("EOF")
        return Pipeline(agent, options, stages)


def decode_script(script):
    """Decode the fixed launch tokens without consulting the generator template."""
    cursor = Cursor(Lexer(script, powershell=True).tokens())
    cursor.take("NEWLINE")
    cursor.keyword("$status")
    cursor.take("=")
    cursor.take("INTEGER", "16")
    cursor.take("NEWLINE")
    cursor.keyword("try")
    cursor.take("{")
    cursor.take("NEWLINE")
    cursor.take("&")
    cursor.take("(")
    cursor.keyword("Join-Path")
    home = cursor.take("IDENTIFIER")
    runner = cursor.take("STRING")
    cursor.take(")")
    cursor.keyword("-Provider")
    provider = cursor.take("STRING")
    cursor.keyword("-Workspace")
    workspace = cursor.take("IDENTIFIER")
    cursor.keyword("-ConfigurationDigest")
    configuration_digest = cursor.take("STRING")
    cursor.keyword("-DistributionDigest")
    distribution_digest = cursor.take("STRING")
    cursor.take("NEWLINE")
    cursor.keyword("$status")
    cursor.take("=")
    cursor.keyword("$LASTEXITCODE")
    cursor.take("NEWLINE")
    cursor.take("}")
    cursor.keyword("finally")
    cursor.take("{")
    cursor.take("NEWLINE")
    cursor.keyword("exit")
    cursor.keyword("$status")
    cursor.take("NEWLINE")
    cursor.take("}")
    cursor.take("NEWLINE")
    cursor.take("EOF")
    require(home == "$env:MEMORYOS_CI_HOME", "protected launcher capability required")
    require(runner == "scripts/Invoke-MemoryOSCI.ps1", "fixed runner required")
    require(provider == "jenkins", "literal Jenkins provider required")
    require(workspace == "$env:WORKSPACE", "fixed workspace capability required")
    require(DIGEST.fullmatch(configuration_digest) is not None, "invalid config pin")
    require(DIGEST.fullmatch(distribution_digest) is not None, "invalid distribution pin")
    return {"provider": provider, "runner": runner,
            "runnerCapability": home.removeprefix("$env:"),
            "workspaceCapability": workspace.removeprefix("$env:"),
            "configurationDigest": configuration_digest,
            "distributionDigest": distribution_digest}


def validate_jenkins(data: bytes, label: str, config_digest: str, distribution_digest: str):
    """Validate closed AST and pinned inputs, then return the decoded launch."""
    require(type(label) is str and LABEL.fullmatch(label) is not None, "expected label invalid")
    require(type(config_digest) is str and DIGEST.fullmatch(config_digest) is not None, "expected config digest invalid")
    require(type(distribution_digest) is str and DIGEST.fullmatch(distribution_digest) is not None, "expected distribution digest invalid")
    tree = PipelineParser(Lexer(decode_bytes(data)).tokens()).parse()
    require(LABEL.fullmatch(tree.agent.label) is not None and tree.agent.label == label, "agent label mismatch")
    require(tree.options == Options(True, 5, "MINUTES"), "fixed options required")
    stage = tree.stages[0]
    require(stage.name == "MemoryOS Policy", "fixed stage required")
    checkout, powershell = stage.steps
    require(checkout == Checkout("scm"), "fixed SCM checkout required")
    require(powershell.encoding == "UTF-8", "fixed encoding required")
    launch = decode_script(powershell.script)
    require(launch["configurationDigest"] == config_digest, "configuration digest substitution")
    require(launch["distributionDigest"] == distribution_digest, "distribution digest substitution")
    launch.update({"agentLabel": tree.agent.label, "timeoutMinutes": tree.options.timeout,
        "skipDefaultCheckout": tree.options.skip_default_checkout, "checkout": checkout.source,
        "encoding": powershell.encoding,
        "exitPropagation": "$LASTEXITCODE -> $status -> finally exit $status",
        "configurationCapability": "MEMORYOS_CI_CONFIG", "nodeCapability": "MEMORYOS_CI_NODE",
        "metadataMapping": {"repository": "JOB_NAME", "revision": "GIT_COMMIT", "runId": "BUILD_NUMBER",
            "jobId": "BUILD_TAG", "attempt": None, "event": None, "changeRequest": "CHANGE_ID"},
        "publication": "local verified common bundle; no provider upload", "script": powershell.script})
    return launch
