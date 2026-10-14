$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Confirm-ConsoleQuiescence { }
function Initialize-Native {
    $name = [Reflection.AssemblyName]::new('MemoryOSReadinessNative')
    $assembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly($name, [Reflection.Emit.AssemblyBuilderAccess]::Run)
    $module = $assembly.DefineDynamicModule('Native')
    $builder = $module.DefineType('MemoryOSReadiness.Native', [Reflection.TypeAttributes]'Public, Sealed, Abstract')
    $definitions = @(
        @('CreateFileW', [Microsoft.Win32.SafeHandles.SafeFileHandle], [Type[]] @([string], [uint32], [uint32], [IntPtr], [uint32], [uint32], [IntPtr])),
        @('GetFileInformationByHandle', [bool], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle], [IntPtr])),
        @('GetFinalPathNameByHandleW', [uint32], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle], [Text.StringBuilder], [uint32], [uint32])),
        @('GetFileType', [uint32], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle])),
        @('GetStdHandle', [IntPtr], [Type[]] @([int32])),
        @('GetFileType', [uint32], [Type[]] @([IntPtr])),
        @('GetConsoleProcessList', [uint32], [Type[]] @([IntPtr], [uint32])),
        @('FreeConsole', [bool], [Type[]] @())
    )
    $dllConstructor = [Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]] @([string]))
    $fields = [Reflection.FieldInfo[]] @(
        [Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'),
        [Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'),
        [Runtime.InteropServices.DllImportAttribute].GetField('CharSet'))
    foreach ($definition in $definitions) {
        $library = if ($definition.Count -eq 4) { $definition[3] } else { 'kernel32.dll' }
        if ($definition[0] -ceq 'CreateFileW') {
            # DefineMethod lets the complete DllImport attribute establish the
            # mapping once, including marshaler last-error capture.
            $method = $builder.DefineMethod($definition[0],
                [Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [Reflection.CallingConventions]::Standard,
                $definition[1], $definition[2])
        } else {
            $method = $builder.DefinePInvokeMethod($definition[0], $library, $definition[0],
                [Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [Reflection.CallingConventions]::Standard,
                $definition[1], $definition[2], [Runtime.InteropServices.CallingConvention]::Winapi,
                [Runtime.InteropServices.CharSet]::Unicode)
        }
        $method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
        if ($definition[0] -ceq 'CreateFileW') {
            $createFileFields = [Reflection.FieldInfo[]] @(
                [Runtime.InteropServices.DllImportAttribute].GetField('EntryPoint'),
                [Runtime.InteropServices.DllImportAttribute].GetField('PreserveSig'),
                [Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'),
                [Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'),
                [Runtime.InteropServices.DllImportAttribute].GetField('CallingConvention'),
                [Runtime.InteropServices.DllImportAttribute].GetField('CharSet'))
            $attribute = [Reflection.Emit.CustomAttributeBuilder]::new($dllConstructor, [object[]] @($library),
                $createFileFields, [object[]] @($definition[0], $true, $true, $true,
                    [Runtime.InteropServices.CallingConvention]::Winapi, [Runtime.InteropServices.CharSet]::Unicode))
        } else {
            $attribute = [Reflection.Emit.CustomAttributeBuilder]::new($dllConstructor, [object[]] @($library),
                $fields, [object[]] @($true, $true, [Runtime.InteropServices.CharSet]::Unicode))
        }
        $method.SetCustomAttribute($attribute)
    }
    $script:native = $builder.CreateType()
    Confirm-ConsoleQuiescence
}
Initialize-Native
$n15Rows = @()
foreach ($n15Method in $script:native.GetMethods([Reflection.BindingFlags] 'Public, Static, DeclaredOnly')) {
    $n15Attributes = @($n15Method.GetCustomAttributes([Runtime.InteropServices.DllImportAttribute], $false))
    if ($n15Attributes.Length -ne 1) { throw 'Exactly one live DllImport mapping required' }
    $n15Attribute = $n15Attributes[0]
    $n15Types = @($n15Method.GetParameters() | ForEach-Object { $_.ParameterType.FullName })
    $n15Rows += [pscustomobject] @{
        key = $n15Method.Name + ':' + ($n15Types -join ',')
        name = $n15Method.Name
        returnType = $n15Method.ReturnType.FullName
        parameterTypes = $n15Types
        library = $n15Attribute.Value
        entryPoint = $n15Attribute.EntryPoint
        charSet = [int] $n15Attribute.CharSet
        callingConvention = [int] $n15Attribute.CallingConvention
        preserveSig = [bool] $n15Attribute.PreserveSig
        setLastError = [bool] $n15Attribute.SetLastError
        exactSpelling = [bool] $n15Attribute.ExactSpelling
        pinvokeImpl = [bool] (($n15Method.Attributes -band [Reflection.MethodAttributes]::PinvokeImpl) -ne 0)
        implementationFlags = [int] $n15Method.GetMethodImplementationFlags()
    }
}
ConvertTo-Json -InputObject $n15Rows -Depth 5 -Compress
