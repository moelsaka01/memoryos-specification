// Engineering-only owned child process capture. Never loaded by MemoryOS product code.
using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
public sealed class EngineeringCaptureResult {
    public bool started, exitObserved, outputComplete, stdoutComplete, stderrComplete, timedOut, outputLimitExceeded;
    public int exitCode, pid;
    public string startError, wrapperError, stdoutBase64, stderrBase64;
}
public static class EngineeringProcessCapture {
    private sealed class Drain {
        public MemoryStream bytes = new MemoryStream();
        public volatile bool overLimit, complete;
        public string error;
        public void Run(Stream input, int limit) {
            try {
                byte[] chunk = new byte[8192];
                int n;
                while ((n = input.Read(chunk, 0, chunk.Length)) != 0) {
                    lock (bytes) {
                        int keep = Math.Min(n, Math.Max(0, limit - (int)bytes.Length));
                        if (keep > 0) bytes.Write(chunk, 0, keep);
                        if (keep < n) overLimit = true;
                    }
                }
                complete = true;
            } catch (Exception e) { error = e.GetType().FullName; }
        }
        public string Base64() { lock(bytes) return Convert.ToBase64String(bytes.ToArray()); }
    }
    // Windows CRT argument quoting, including quotes and trailing backslashes.
    private static string Quote(string arg) {
        if (arg == null) throw new ArgumentNullException("arg");
        StringBuilder b = new StringBuilder("\""); int slashes = 0;
        foreach (char c in arg) {
            if (c == '\\') { slashes++; continue; }
            if (c == '"') { b.Append('\\', slashes * 2 + 1); b.Append('"'); }
            else { b.Append('\\', slashes); b.Append(c); }
            slashes = 0;
        }
        b.Append('\\', slashes * 2); b.Append('"'); return b.ToString();
    }
    public static EngineeringCaptureResult Run(string exe, string[] args, string cwd, int timeoutMs, int maxBytesPerStream) {
        EngineeringCaptureResult r = new EngineeringCaptureResult();
        Drain output = new Drain(), error = new Drain();
        Process p = new Process(); Task a = null, b = null;
        try {
            if (timeoutMs < 1 || maxBytesPerStream < 1) throw new ArgumentOutOfRangeException();
            ProcessStartInfo si = new ProcessStartInfo();
            si.FileName = exe; si.WorkingDirectory = cwd; si.UseShellExecute = false;
            si.CreateNoWindow = true; si.RedirectStandardOutput = true; si.RedirectStandardError = true;
            si.RedirectStandardInput = true;
            StringBuilder argv = new StringBuilder();
            foreach (string arg in args) { if (argv.Length > 0) argv.Append(' '); argv.Append(Quote(arg)); }
            si.Arguments = argv.ToString();
            si.EnvironmentVariables.Clear();
            si.EnvironmentVariables["SystemRoot"] = "C:\\Windows";
            si.EnvironmentVariables["WINDIR"] = "C:\\Windows";
            p.StartInfo = si;
            try { r.started = p.Start(); } catch (Exception e) { r.startError = e.GetType().FullName + ": " + e.Message; }
            if (!r.started) return r;
            r.pid = p.Id; p.StandardInput.Close();
            a = Task.Factory.StartNew(() => output.Run(p.StandardOutput.BaseStream, maxBytesPerStream), TaskCreationOptions.LongRunning);
            b = Task.Factory.StartNew(() => error.Run(p.StandardError.BaseStream, maxBytesPerStream), TaskCreationOptions.LongRunning);
            Stopwatch elapsed = Stopwatch.StartNew();
            while (!p.WaitForExit(20)) {
                if (output.overLimit || error.overLimit || elapsed.ElapsedMilliseconds >= timeoutMs) {
                    r.timedOut = elapsed.ElapsedMilliseconds >= timeoutMs;
                    r.outputLimitExceeded = output.overLimit || error.overLimit;
                    try { p.Kill(); } catch (Exception e) { r.wrapperError = "Kill: " + e.GetType().FullName; }
                    if (!p.WaitForExit(2000)) r.wrapperError = "Owned Git process did not exit within cleanup guard";
                    break;
                }
            }
            if (p.HasExited) { r.exitCode = p.ExitCode; r.exitObserved = true; }
            if (!Task.WaitAll(new Task[] {a,b}, 2000)) r.wrapperError = "Output pipes did not close within capture guard";
            if (output.error != null || error.error != null) r.wrapperError = "Output capture: " + output.error + "; " + error.error;
        } catch (Exception e) { r.wrapperError = e.GetType().FullName + ": " + e.Message; }
        finally {
            if (r.started) {
                try { if (!p.HasExited) { p.Kill(); if (!p.WaitForExit(2000)) r.wrapperError = "Owned child cleanup incomplete"; } }
                catch (Exception e) { r.wrapperError = "Owned child cleanup: " + e.GetType().FullName; }
                try { if (p.HasExited) { r.exitCode = p.ExitCode; r.exitObserved = true; } } catch { }
            }
            r.outputLimitExceeded = r.outputLimitExceeded || output.overLimit || error.overLimit;
            r.stdoutComplete = output.complete && !output.overLimit && output.error == null;
            r.stderrComplete = error.complete && !error.overLimit && error.error == null;
            r.outputComplete = r.stdoutComplete && r.stderrComplete;
            r.stdoutBase64 = output.Base64(); r.stderrBase64 = error.Base64();
            p.Dispose();
        }
        return r;
    }
}
