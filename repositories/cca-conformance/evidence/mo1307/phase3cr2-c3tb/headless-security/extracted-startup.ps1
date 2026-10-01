function Reject-Protocol([string] $ErrorCode = 'MO1307_INPUT') {
    throw [System.InvalidOperationException]::new($ErrorCode)
}
function Confirm-ConsoleQuiescence {
    # Standard handles are borrowed from this process, not newly owned handles.
    # Only the fixed redirected product pipes admit the headless lifecycle path.
    foreach ($selector in @(-10, -11, -12)) {
        $standardHandle = $script:native::GetStdHandle($selector)
        if ($standardHandle -eq [IntPtr]::Zero -or $standardHandle -eq [IntPtr]::new(-1) -or
            $script:native::GetFileType($standardHandle) -ne 3) { Reject-Protocol 'MO1307_INTERNAL' }
    }
    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(4)
    try {
        $count = $script:native::GetConsoleProcessList($buffer, 1)
        # Every failed initial observation, including zero/error 6, fails closed.
        if ($count -ne 1 -or [Runtime.InteropServices.Marshal]::ReadInt32($buffer) -ne $PID) { Reject-Protocol 'MO1307_INTERNAL' }
        # Membership is topology evidence only. Detach this helper without
        # discovering, opening, terminating or claiming exit of any host process.
        if (-not $script:native::FreeConsole()) { Reject-Protocol 'MO1307_INTERNAL' }
        # Successful self-detachment is the transition; do not query membership again.
    } finally {
        [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
    }
}

