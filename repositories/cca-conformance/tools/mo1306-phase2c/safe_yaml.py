"""Independent bounded YAML and parse-only PowerShell engineering boundaries."""
import json
import os
from pathlib import Path
import re
import subprocess
import yaml


class ContractError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ContractError(message)


def parse_yaml(data):
    require(isinstance(data, bytes) and 0 < len(data) <= 32768, 'YAML byte bound')
    text = data.decode('utf-8', errors='strict')
    require(not text.startswith('\ufeff') and text.endswith('\n') and not text.endswith('\n\n'), 'YAML encoding/final LF')
    require(not re.search(r'[\x00-\x09\x0b-\x1f\x7f-\x9f]', text), 'YAML control character')
    require(not any(0xD800 <= ord(char) <= 0xDFFF for char in text), 'YAML surrogate')
    for token in yaml.scan(text, Loader=yaml.BaseLoader):
        require(not isinstance(token, (yaml.tokens.AnchorToken, yaml.tokens.AliasToken, yaml.tokens.TagToken,
                                       yaml.tokens.DirectiveToken, yaml.tokens.DocumentStartToken,
                                       yaml.tokens.DocumentEndToken)), 'YAML forbidden token')
    root = yaml.compose(text, Loader=yaml.BaseLoader)
    require(isinstance(root, yaml.MappingNode), 'YAML root mapping')

    fixed_expressions = {
        '${{ github.sha }}', '${{ steps.evaluate.outputs.complete }}',
        '${{ steps.evaluate.outputs.exit-code }}', '${{ steps.evaluate.outputs.run-id }}',
        '${{ steps.evaluate.outcome }}', '${{ steps.upload.outcome }}',
        "always() && steps.evaluate.outputs.complete == 'true'", 'always()',
    }

    def convert(node, depth=0, expected_column=0):
        require(depth <= 24, 'YAML depth')
        if isinstance(node, yaml.MappingNode):
            require(not node.flow_style or not node.value, 'YAML flow mapping')
            require(not node.value or node.start_mark.column == expected_column, 'YAML mapping indentation')
            result = {}
            for k, v in node.value:
                require(isinstance(k, yaml.ScalarNode) and k.style in (None, "'"), 'YAML key kind')
                require(k.start_mark.column == expected_column, 'YAML key indentation')
                name = k.value
                require(name != 'on' or k.style == "'", 'YAML on key must be quoted')
                require(name != '<<' and name not in result, 'YAML duplicate/merge key')
                require(re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]*', name), 'YAML key alphabet')
                result[name] = convert(v, depth + 1, expected_column + 2)
            return result
        if isinstance(node, yaml.SequenceNode):
            require(not node.flow_style, 'YAML flow sequence')
            require(node.start_mark.column == expected_column, 'YAML sequence indentation')
            return [convert(item, depth + 1, expected_column + 2) for item in node.value]
        require(isinstance(node, yaml.ScalarNode), 'YAML scalar node')
        if node.style in ('|', "'"):
            return node.value
        require(node.style is None, 'YAML unsupported scalar style')
        if node.value in ('true', 'false'):
            return node.value == 'true'
        if re.fullmatch(r'0|[1-9][0-9]*', node.value):
            return int(node.value)
        require(node.value in fixed_expressions, 'YAML ordinary string must be single quoted')
        return node.value

    return convert(root)


def powershell_ast(script):
    """Parse untrusted script text through stdin; never execute it."""
    ps = Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
    command = r"""$text=[Console]::In.ReadToEnd();$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$errors);if($errors.Count){exit 2};$nodes=@($ast.FindAll({param($n) $true},$true)|ForEach-Object{[ordered]@{kind=$_.GetType().Name;text=$_.Extent.Text}});ConvertTo-Json -InputObject $nodes -Compress -Depth 8"""
    result = subprocess.run([str(ps), '-NoProfile', '-NonInteractive', '-Command', command], input=script.encode('utf-8'),
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20,
                            creationflags=subprocess.CREATE_NO_WINDOW)
    require(result.returncode == 0 and not result.stderr, 'PowerShell AST parsing')
    return json.loads(result.stdout.decode('utf-8-sig'))


def validate_powershell(script, expected=None):
    actual = powershell_ast(script)
    if expected is not None:
        require(actual == powershell_ast(expected), 'PowerShell AST contract')
    return actual
