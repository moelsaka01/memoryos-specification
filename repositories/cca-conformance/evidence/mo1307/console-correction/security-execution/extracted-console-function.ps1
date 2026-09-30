function Reject-Protocol([string] $ErrorCode = 'MO1307_INPUT') {
    throw [System.InvalidOperationException]::new($ErrorCode)
}
function Confirm-ConsoleQuiescence {
    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(4)
    $consoleHandle = [IntPtr]::Zero
    try {
        $count = $script:native::GetConsoleProcessList($buffer, 1)
        $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($count -eq 0 -and $nativeError -eq 6) { return }
        if ($count -ne 1 -or [Runtime.InteropServices.Marshal]::ReadInt32($buffer) -ne $PID) { Reject-Protocol 'MO1307_INTERNAL' }
        # Bind the current console window's owner, never historical numeric PPID.
        # Missing/headless windows are ambiguous and fail before request parsing.
        $window = $script:native::GetConsoleWindow()
        if ($window -eq [IntPtr]::Zero) { Reject-Protocol 'MO1307_INTERNAL' }
        $owner = [uint32] 0
        if ($script:native::GetWindowThreadProcessId($window, [ref] $owner) -eq 0 -or $owner -eq 0 -or $owner -eq $PID) { Reject-Protocol 'MO1307_INTERNAL' }
        # Query and synchronize only: no process-termination capability is acquired.
        $consoleHandle = $script:native::OpenProcess(0x101000, $false, $owner)
        if ($consoleHandle -eq [IntPtr]::Zero -or $script:native::GetProcessId($consoleHandle) -ne $owner) { Reject-Protocol 'MO1307_INTERNAL' }
        $image = [Text.StringBuilder]::new(512); $imageLength = [uint32] 512
        if (-not $script:native::QueryFullProcessImageNameW($consoleHandle, 0, $image, [ref] $imageLength)) { Reject-Protocol 'MO1307_INTERNAL' }
        $systemDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::System)
        if (-not [string]::Equals($image.ToString(), $systemDirectory + '\conhost.exe', [StringComparison]::OrdinalIgnoreCase)) { Reject-Protocol 'MO1307_INTERNAL' }
        # A second current association, followed by a live-object check, closes
        # discovery/open PID replacement without asserting historical ancestry.
        $currentOwner = [uint32] 0
        if ($script:native::GetConsoleWindow() -ne $window -or
            $script:native::GetWindowThreadProcessId($window, [ref] $currentOwner) -eq 0 -or $currentOwner -ne $owner) { Reject-Protocol 'MO1307_INTERNAL' }
        $count = $script:native::GetConsoleProcessList($buffer, 1)
        if ($count -ne 1 -or [Runtime.InteropServices.Marshal]::ReadInt32($buffer) -ne $PID -or
            $script:native::GetProcessId($consoleHandle) -ne $owner -or
            $script:native::WaitForSingleObject($consoleHandle, 0) -ne 258) { Reject-Protocol 'MO1307_INTERNAL' }
        if (-not $script:native::FreeConsole()) { Reject-Protocol 'MO1307_INTERNAL' }
        # Detach only self and observe natural exit of the SAME held host object.
        # A late joining client can make this fail closed, never authorize killing
        # its console. No TerminateProcess or PID-based process kill is available.
        if ($script:native::WaitForSingleObject($consoleHandle, 1000) -ne 0) { Reject-Protocol 'MO1307_INTERNAL' }
        $remaining = $script:native::GetConsoleProcessList($buffer, 1)
        $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($remaining -ne 0 -or $nativeError -ne 6) { Reject-Protocol 'MO1307_INTERNAL' }
    } finally {
        if ($consoleHandle -ne [IntPtr]::Zero) { [void] $script:native::CloseHandle($consoleHandle) }
        [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
    }
}

