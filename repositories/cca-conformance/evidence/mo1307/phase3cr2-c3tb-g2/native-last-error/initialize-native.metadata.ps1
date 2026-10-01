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
$c3rRows = @()
foreach ($c3rMethod in $script:native.GetMethods([Reflection.BindingFlags] 'Public, Static, DeclaredOnly')) {
    $c3rAttributes = @($c3rMethod.GetCustomAttributes([Runtime.InteropServices.DllImportAttribute], $false))
    if ($c3rAttributes.Length -ne 1) { throw 'Exactly one live DllImport mapping required' }
    $c3rAttribute = $c3rAttributes[0]
    $c3rTypes = @($c3rMethod.GetParameters() | ForEach-Object { $_.ParameterType.FullName })
    $c3rRows += [pscustomobject] @{
        key = $c3rMethod.Name + ':' + ($c3rTypes -join ',')
        name = $c3rMethod.Name
        returnType = $c3rMethod.ReturnType.FullName
        parameterTypes = $c3rTypes
        library = $c3rAttribute.Value
        entryPoint = $c3rAttribute.EntryPoint
        charSet = [int] $c3rAttribute.CharSet
        callingConvention = [int] $c3rAttribute.CallingConvention
        preserveSig = [bool] $c3rAttribute.PreserveSig
        setLastError = [bool] $c3rAttribute.SetLastError
        exactSpelling = [bool] $c3rAttribute.ExactSpelling
        pinvokeImpl = [bool] (($c3rMethod.Attributes -band [Reflection.MethodAttributes]::PinvokeImpl) -ne 0)
        implementationFlags = [int] $c3rMethod.GetMethodImplementationFlags()
    }
}
ConvertTo-Json -InputObject $c3rRows -Depth 5 -Compress
