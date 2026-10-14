[IO.File]::WriteAllText($args[0]+'.entry','SCRIPT_ENTRY',[Text.UTF8Encoding]::new($false))
# Engineering-only entry/stdio observation. The first statement above is the
# private entry witness; this script never invokes the production helper.
Set-StrictMode -Version 2.0
$ErrorActionPreference='Stop'
$sidecarBase=$args[0]
$state=[ordered]@{kind='MO1307EngineeringLaunchProbe';phase='ENTRY';pid=$PID;powerShellVersion=$PSVersionTable.PSVersion.ToString();is64Bit=[Environment]::Is64BitProcess;productionHelperInvoked=$false;nativeMutationPerformed=$false}
function Save-State {
    [IO.File]::WriteAllText($sidecarBase+'.state.json',(ConvertTo-Json -InputObject $state -Depth 10 -Compress)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
}
Save-State
try {
    if (-not [Environment]::Is64BitProcess) { throw 'ENGINEERING_REQUIRES_X64' }
    $assemblyName=[Reflection.AssemblyName]::new('MemoryOSEngineeringLaunchObservation')
    $assembly=[AppDomain]::CurrentDomain.DefineDynamicAssembly($assemblyName,[Reflection.Emit.AssemblyBuilderAccess]::Run)
    $module=$assembly.DefineDynamicModule('NativeObservation')
    $builder=$module.DefineType('MemoryOSEngineering.LaunchNative',[Reflection.TypeAttributes]'Public, Sealed, Abstract')
    $definitions=@(
        @('GetStdHandle',[IntPtr],[Type[]]@([int32])),
        @('GetFileType',[uint32],[Type[]]@([IntPtr])),
        @('GetStartupInfoW',[void],[Type[]]@([IntPtr])),
        @('GetConsoleWindow',[IntPtr],[Type[]]@()),
        @('GetConsoleProcessList',[uint32],[Type[]]@([IntPtr],[uint32]))
    )
    $constructor=[Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]]@([string]))
    $fields=[Reflection.FieldInfo[]]@(
        [Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'),
        [Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'),
        [Runtime.InteropServices.DllImportAttribute].GetField('CharSet'))
    foreach($definition in $definitions) {
        $method=$builder.DefinePInvokeMethod($definition[0],'kernel32.dll',$definition[0],[Reflection.MethodAttributes]'Public, Static, PinvokeImpl',[Reflection.CallingConventions]::Standard,$definition[1],$definition[2],[Runtime.InteropServices.CallingConvention]::Winapi,[Runtime.InteropServices.CharSet]::Unicode)
        $method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
        $attribute=[Reflection.Emit.CustomAttributeBuilder]::new($constructor,[object[]]@('kernel32.dll'),$fields,[object[]]@($true,$true,[Runtime.InteropServices.CharSet]::Unicode))
        $method.SetCustomAttribute($attribute)
    }
    $native=$builder.CreateType()
    $handles=@()
    foreach($channel in @(@('stdin',-10),@('stdout',-11),@('stderr',-12))) {
        $handle=$native::GetStdHandle([int32]$channel[1])
        $handleError=[Runtime.InteropServices.Marshal]::GetLastWin32Error()
        $fileType=$native::GetFileType($handle)
        $typeError=[Runtime.InteropServices.Marshal]::GetLastWin32Error()
        $handles += [ordered]@{channel=$channel[0];selector=$channel[1];handleHex=$handle.ToInt64().ToString('X16');isNull=($handle -eq [IntPtr]::Zero);isInvalid=($handle -eq [IntPtr]::new(-1));getStdHandleLastError=$handleError;fileType=$fileType;fileTypeLastError=$typeError}
    }
    $state.rawStandardHandles=$handles
    $startupBuffer=[Runtime.InteropServices.Marshal]::AllocHGlobal(104)
    try {
        [Runtime.InteropServices.Marshal]::Copy([byte[]]::new(104),0,$startupBuffer,104)
        [Runtime.InteropServices.Marshal]::WriteInt32($startupBuffer,104)
        $native::GetStartupInfoW($startupBuffer)
        $startupHandles=@()
        foreach($field in @(@('stdin',80),@('stdout',88),@('stderr',96))) {
            $handle=[Runtime.InteropServices.Marshal]::ReadIntPtr($startupBuffer,[int]$field[1])
            $fileType=$native::GetFileType($handle)
            $typeError=[Runtime.InteropServices.Marshal]::GetLastWin32Error()
            $startupHandles += [ordered]@{channel=$field[0];offset=$field[1];handleHex=$handle.ToInt64().ToString('X16');isNull=($handle -eq [IntPtr]::Zero);isInvalid=($handle -eq [IntPtr]::new(-1));fileType=$fileType;fileTypeLastError=$typeError}
        }
        $state.startupInfo=[ordered]@{layout='STARTUPINFOW-x64';bufferBytes=104;cb=[Runtime.InteropServices.Marshal]::ReadInt32($startupBuffer,0);flags=[Runtime.InteropServices.Marshal]::ReadInt32($startupBuffer,60);showWindow=[Runtime.InteropServices.Marshal]::ReadInt16($startupBuffer,64);reserved2Bytes=[Runtime.InteropServices.Marshal]::ReadInt16($startupBuffer,66);standardHandles=$startupHandles}
    } finally { [Runtime.InteropServices.Marshal]::FreeHGlobal($startupBuffer) }
    $window=$native::GetConsoleWindow()
    $membersBuffer=[Runtime.InteropServices.Marshal]::AllocHGlobal(64)
    try {
        $count=$native::GetConsoleProcessList($membersBuffer,16)
        $consoleError=[Runtime.InteropServices.Marshal]::GetLastWin32Error()
        $members=@()
        if($count -gt 0 -and $count -le 16) {
            for($index=0;$index -lt $count;$index++) { $members += [Runtime.InteropServices.Marshal]::ReadInt32($membersBuffer,4*$index) }
        }
        $state.console=[ordered]@{windowHex=$window.ToInt64().ToString('X16');windowIsNull=($window -eq [IntPtr]::Zero);processListCapacity=16;processCount=$count;lastError=$consoleError;memberPids=$members;listComplete=($count -le 16);soleSelf=($count -eq 1 -and $members.Count -eq 1 -and $members[0] -eq $PID);hostPidInferred=$false}
    } finally { [Runtime.InteropServices.Marshal]::FreeHGlobal($membersBuffer) }
    $state.phase='NATIVE_OBSERVATIONS'
    Save-State
    $stdin=[Console]::OpenStandardInput()
    $stdout=[Console]::OpenStandardOutput()
    $stderr=[Console]::OpenStandardError()
    $state.managedStreams=@(
        [ordered]@{channel='stdin';type=$stdin.GetType().FullName;isStreamNull=[object]::ReferenceEquals($stdin,[IO.Stream]::Null);canRead=$stdin.CanRead;canWrite=$stdin.CanWrite;canSeek=$stdin.CanSeek},
        [ordered]@{channel='stdout';type=$stdout.GetType().FullName;isStreamNull=[object]::ReferenceEquals($stdout,[IO.Stream]::Null);canRead=$stdout.CanRead;canWrite=$stdout.CanWrite;canSeek=$stdout.CanSeek},
        [ordered]@{channel='stderr';type=$stderr.GetType().FullName;isStreamNull=[object]::ReferenceEquals($stderr,[IO.Stream]::Null);canRead=$stderr.CanRead;canWrite=$stderr.CanWrite;canSeek=$stderr.CanSeek}
    )
    $state.phase='MANAGED_STREAMS'
    Save-State
    $buffer=[byte[]]::new(4096)
    $bytes=[IO.MemoryStream]::new()
    while($true) {
        $read=$stdin.Read($buffer,0,$buffer.Length)
        if($read -eq 0) { break }
        if($bytes.Length+$read -gt 65536) { throw 'ENGINEERING_INPUT_CEILING' }
        $bytes.Write($buffer,0,$read)
    }
    $echo=$bytes.ToArray()
    $digest=[Security.Cryptography.SHA256]::Create()
    try { $inputHash=([BitConverter]::ToString($digest.ComputeHash($echo))).Replace('-','').ToLowerInvariant() }
    finally { $digest.Dispose() }
    $state.phase='INPUT_EOF'
    $state.inputEof=$true
    $state.inputByteLength=$echo.Length
    $state.inputSha256='sha256:'+$inputHash
    Save-State
    $stdout.Write($echo,0,$echo.Length)
    $state.writeReturned=$true
    $state.writeRequestedBytes=$echo.Length
    $stdout.Flush()
    $state.flushReturned=$true
    $state.phase='COMPLETE'
    Save-State
    exit 0
} catch {
    $state.phase='ENGINEERING_FAILURE'
    $state.failure=[ordered]@{type=$_.Exception.GetType().FullName;message=$_.Exception.Message}
    Save-State
    exit 78
}
