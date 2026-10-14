# Engineering-only intrusive observer. Never certifies product timing or success.
# Run with the absolute Windows PowerShell 5.1 executable and a hidden window.
param(
    [Alias('pid-file')][string] $PidFile,
    [Alias('output')][string] $OutputFile,
    [Alias('ready')][string] $ReadyFile,
    [switch] $CompileOnly
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { throw 'Windows PowerShell 5.1 required.' }
$source = @'
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Globalization;
using System.Management.Automation;
using System.Management.Automation.Host;
using System.Management.Automation.Runspaces;
using System.Security;
using System.Threading;
using System.Threading.Tasks;

public sealed class MO1307ObserverUI : PSHostUserInterface {
    public override PSHostRawUserInterface RawUI { get { return null; } }
    public override string ReadLine() { throw new InvalidOperationException("Observer has no interactive input."); }
    public override SecureString ReadLineAsSecureString() { throw new InvalidOperationException("Observer has no interactive input."); }
    public override void Write(string v) { }
    public override void Write(ConsoleColor f, ConsoleColor b, string v) { }
    public override void WriteLine(string v) { }
    public override void WriteErrorLine(string v) { }
    public override void WriteDebugLine(string v) { }
    public override void WriteProgress(long id, ProgressRecord v) { }
    public override void WriteVerboseLine(string v) { }
    public override void WriteWarningLine(string v) { }
    public override Dictionary<string, PSObject> Prompt(string c, string m, Collection<FieldDescription> d) { throw new InvalidOperationException("No prompts."); }
    public override int PromptForChoice(string c, string m, Collection<ChoiceDescription> d, int n) { throw new InvalidOperationException("No prompts."); }
    public override PSCredential PromptForCredential(string c, string m, string u, string t) { throw new InvalidOperationException("No credentials."); }
    public override PSCredential PromptForCredential(string c, string m, string u, string t, PSCredentialTypes a, PSCredentialUIOptions b) { throw new InvalidOperationException("No credentials."); }
}
public sealed class MO1307ObserverHost : PSHost {
    private readonly Guid id = Guid.NewGuid();
    private readonly MO1307ObserverUI ui = new MO1307ObserverUI();
    public override Guid InstanceId { get { return id; } }
    public override string Name { get { return "MO1307 bounded source-location observer"; } }
    public override Version Version { get { return new Version(1, 0); } }
    public override PSHostUserInterface UI { get { return ui; } }
    public override CultureInfo CurrentCulture { get { return CultureInfo.InvariantCulture; } }
    public override CultureInfo CurrentUICulture { get { return CultureInfo.InvariantCulture; } }
    public override void SetShouldExit(int n) { }
    public override void EnterNestedPrompt() { throw new InvalidOperationException("No interactive debugger."); }
    public override void ExitNestedPrompt() { }
    public override void NotifyBeginApplication() { }
    public override void NotifyEndApplication() { }
}
public sealed class MO1307ObserverResult {
    public string kind = "MO1307IntrusivePowerShellSourceLocationObservation";
    public string version = "1.0.0";
    public bool intrusive = true;
    public bool timingCertification = false;
    public bool productSuccessCertification = false;
    public string powerShellVersion;
    public int helperPid;
    public string expectedHelperPath;
    public string processStartUtc;
    public string status = "NOT_ATTACHED";
    public string failureType;
    public int selectedRunspaceId;
    public int offTargetStopEvents;
    public bool detachRequested;
    public bool debuggerCommandStopped;
    public double observerElapsedMs;
    public readonly List<Dictionary<string, object>> calls = new List<Dictionary<string, object>>();
    public readonly List<Dictionary<string, object>> snapshots = new List<Dictionary<string, object>>();
    public string scope = "Debugger sequence-point source locations only. No locals, input bytes, native/CLR stack or durations inside observed functions. Break requests and execution of a secondary named-pipe runspace perturb the helper. No observation establishes uninstrumented timing, helper-console cleanup, readiness or certification.";
}
public static class MO1307SourceObserver {
    private static bool Bounded(Action action, int timeout, string name, MO1307ObserverResult result) {
        Stopwatch watch = Stopwatch.StartNew();
        Task task = Task.Factory.StartNew(action);
        bool complete = false;
        string fault = null;
        try { complete = task.Wait(timeout); }
        catch (AggregateException e) { complete = true; fault = e.GetBaseException().GetType().FullName; }
        lock (result.calls) { result.calls.Add(new Dictionary<string, object> {
            {"operation", name}, {"waitBudgetMs", timeout}, {"completed", complete},
            {"failureType", fault}, {"elapsedMs", watch.Elapsed.TotalMilliseconds},
            {"timeoutMeaning", "Observer stops waiting; does not claim cancellation of outstanding remoting operation."}
        }); }
        return complete && fault == null;
    }
    public static MO1307ObserverResult Run(int helperPid, string expectedPath, string version) {
        MO1307ObserverResult result = new MO1307ObserverResult();
        result.powerShellVersion = version;
        result.helperPid = helperPid;
        result.expectedHelperPath = expectedPath;
        Stopwatch watch = Stopwatch.StartNew();
        Runspace attached = null;
        PowerShell selection = null;
        PowerShell debugging = null;
        EventHandler<DebuggerStopEventArgs> handler = null;
        DateTime processStart = DateTime.MinValue;
        AutoResetEvent observed = new AutoResetEvent(false);
        try {
            Process process = Process.GetProcessById(helperPid);
            if (!String.Equals(process.ProcessName, "powershell", StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Unexpected process kind.");
            processStart = process.StartTime.ToUniversalTime();
            result.processStartUtc = processStart.ToString("o", CultureInfo.InvariantCulture);
            NamedPipeConnectionInfo connection = new NamedPipeConnectionInfo(helperPid, "DefaultAppDomain", 1000);
            connection.OpenTimeout = 1000;
            connection.OperationTimeout = 1000;
            attached = RunspaceFactory.CreateRunspace(new MO1307ObserverHost(), connection);
            if (!Bounded(delegate { attached.Open(); }, 1000, "open-named-pipe", result)) { result.status = "ATTACH_UNCONFIRMED"; return result; }
            result.status = "ATTACHED";
            selection = PowerShell.Create(); selection.Runspace = attached;
            selection.AddScript("$observerRunspace = [runspace]::DefaultRunspace.Id; Get-Runspace | Where-Object { $_.Id -ne $observerRunspace -and $_.RunspaceAvailability -eq 'Busy' } | Select-Object Id,Name,RunspaceAvailability");
            Collection<PSObject> candidates = null;
            if (!Bounded(delegate { candidates = selection.Invoke(); }, 1000, "identify-existing-busy-runspace", result)) { result.status = "RUNSPACE_QUERY_UNCONFIRMED"; return result; }
            if (selection.HadErrors || candidates == null || candidates.Count != 1) throw new InvalidOperationException("Unique busy target runspace not established.");
            result.selectedRunspaceId = Convert.ToInt32(candidates[0].Properties["Id"].Value, CultureInfo.InvariantCulture);
            handler = delegate(object sender, DebuggerStopEventArgs args) {
                Stopwatch pause = Stopwatch.StartNew();
                try {
                    InvocationInfo info = args.InvocationInfo;
                    if (info != null && String.Equals(info.ScriptName, expectedPath, StringComparison.OrdinalIgnoreCase)) {
                        lock (result.snapshots) {
                            if (result.snapshots.Count < 3) result.snapshots.Add(new Dictionary<string, object> {
                                {"ordinal", result.snapshots.Count + 1}, {"scriptName", info.ScriptName},
                                {"scriptLineNumber", info.ScriptLineNumber},
                                {"commandName", info.MyCommand == null ? null : info.MyCommand.Name},
                                {"observerElapsedMs", watch.Elapsed.TotalMilliseconds},
                                {"helperProcessAgeWallClockMs", (DateTime.UtcNow - processStart).TotalMilliseconds},
                                {"callbackWorkMs", pause.Elapsed.TotalMilliseconds},
                                {"resumeAction", "Continue"}, {"stackCaptured", false}
                            });
                        }
                    } else { Interlocked.Increment(ref result.offTargetStopEvents); }
                } finally {
                    args.ResumeAction = DebuggerResumeAction.Continue;
                    observed.Set();
                }
            };
            attached.Debugger.DebuggerStop += handler;
            debugging = PowerShell.Create(); debugging.Runspace = attached;
            debugging.AddCommand("Debug-Runspace").AddParameter("Id", result.selectedRunspaceId);
            IAsyncResult running = debugging.BeginInvoke();
            result.status = "DEBUG_REQUESTED";
            // Initial Debug-Runspace itself requests a stop at the next sequence point.
            for (int attempt = 0; attempt < 3 && watch.ElapsedMilliseconds < 6000; attempt++) {
                if (attempt > 0) {
                    Thread.Sleep(500);
                    if (running.IsCompleted) break;
                    if (!Bounded(delegate { attached.Debugger.SetDebuggerStepMode(true); }, 1000, "request-next-sequence-point-" + attempt, result)) break;
                }
                observed.WaitOne(1000);
                if (running.IsCompleted) break;
            }
            lock (result.snapshots) { result.status = result.snapshots.Count > 0 ? "SOURCE_LOCATION_OBSERVED" : "NO_TARGET_SEQUENCE_POINT_OBSERVED"; }
        } catch (Exception e) {
            result.failureType = e.GetType().FullName;
            result.status = "OBSERVER_ERROR";
        } finally {
            // Stopping Debug-Runspace invokes its own StopDebugRunspace cleanup;
            // it is not a Stop command sent to the product's script pipeline.
            if (debugging != null) {
                result.detachRequested = true;
                result.debuggerCommandStopped = Bounded(delegate {
                    IAsyncResult stopping = debugging.BeginStop(null, null);
                    if (!stopping.AsyncWaitHandle.WaitOne(900)) throw new TimeoutException();
                    debugging.EndStop(stopping);
                }, 1000, "stop-observer-debug-command-and-detach", result);
            }
            if (attached != null) {
                if (handler != null && result.debuggerCommandStopped) attached.Debugger.DebuggerStop -= handler;
                Bounded(delegate { attached.Close(); }, 1000, "close-observer-runspace", result);
            }
            // Outstanding Task work is not represented as cancelled or complete.
            // Avoid unbounded Dispose on unconfirmed remoting operations.
            result.observerElapsedMs = watch.Elapsed.TotalMilliseconds;
        }
        return result;
    }
}
'@
Add-Type -TypeDefinition $source -ReferencedAssemblies @([System.Management.Automation.PSObject].Assembly.Location, 'System.dll', 'System.Core.dll')
if ($CompileOnly) { 'COMPILE_ONLY_PASS'; exit 0 }
foreach ($p in @($PidFile, $OutputFile, $ReadyFile)) { if (-not [IO.Path]::IsPathRooted($p)) { throw 'Absolute observer paths required.' } }
if ([IO.File]::Exists($OutputFile) -or [IO.File]::Exists($ReadyFile)) { throw 'Observer outputs must be new.' }
$encoding = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText($ReadyFile, '{"kind":"MO1307SourceObserverReady","powerShell":"5.1","compiled":true}' + "`n", $encoding)
$wait = [Diagnostics.Stopwatch]::StartNew()
while (-not [IO.File]::Exists($PidFile) -and $wait.ElapsedMilliseconds -lt 10000) { Start-Sleep -Milliseconds 20 }
if (-not [IO.File]::Exists($PidFile)) {
    $result = @{ kind = 'MO1307IntrusivePowerShellSourceLocationObservation'; status = 'NO_PID_REQUEST'; intrusive = $true; timingCertification = $false }
} else {
    # Harness publishes the request atomically. Strict fixed fields, no commands.
    $request = [IO.File]::ReadAllText($PidFile, $encoding) | ConvertFrom-Json
    if (@($request.PSObject.Properties.Name).Count -ne 2 -or -not $request.PSObject.Properties['pid'] -or -not $request.PSObject.Properties['helperPath']) { throw 'Expected exactly pid and helperPath.' }
    if ($request.pid -isnot [int] -or $request.pid -le 0 -or -not [IO.Path]::IsPathRooted([string]$request.helperPath)) { throw 'Invalid PID or expected helper path.' }
    $result = [MO1307SourceObserver]::Run($request.pid, [string]$request.helperPath, $PSVersionTable.PSVersion.ToString())
}
$json = $result | ConvertTo-Json -Depth 10
$file = [IO.File]::Open($OutputFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
try { $bytes = $encoding.GetBytes($json + "`n"); $file.Write($bytes, 0, $bytes.Length) } finally { $file.Dispose() }
