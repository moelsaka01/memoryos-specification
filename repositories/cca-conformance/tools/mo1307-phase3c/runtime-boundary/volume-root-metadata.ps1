# Read-only fixed root metadata witness. No content enumeration, mount, or file mutation.
$ErrorActionPreference='Stop'
$assembly=[Reflection.Emit.AssemblyBuilder]::DefineDynamicAssembly([Reflection.AssemblyName]::new('MO1307WrongVolumeMetadata'),[Reflection.Emit.AssemblyBuilderAccess]::Run)
$module=$assembly.DefineDynamicModule('Native')
$builder=$module.DefineType('MO1307WrongVolumeMetadata.Native',[Reflection.TypeAttributes]'Public, Sealed, Abstract')
$definitions=@(@('CreateFileW',[Microsoft.Win32.SafeHandles.SafeFileHandle],[Type[]]@([string],[uint32],[uint32],[IntPtr],[uint32],[uint32],[IntPtr])),@('GetFileInformationByHandle',[bool],[Type[]]@([Microsoft.Win32.SafeHandles.SafeFileHandle],[IntPtr])))
$constructor=[Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]]@([string]))
$fields=[Reflection.FieldInfo[]]@([Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'),[Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'),[Runtime.InteropServices.DllImportAttribute].GetField('CharSet'))
foreach($definition in $definitions){
 $method=$builder.DefinePInvokeMethod($definition[0],'kernel32.dll',$definition[0],[Reflection.MethodAttributes]'Public, Static, PinvokeImpl',[Reflection.CallingConventions]::Standard,$definition[1],$definition[2],[Runtime.InteropServices.CallingConvention]::Winapi,[Runtime.InteropServices.CharSet]::Unicode)
 $method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
 $method.SetCustomAttribute([Reflection.Emit.CustomAttributeBuilder]::new($constructor,[object[]]@('kernel32.dll'),$fields,[object[]]@($true,$true,[Runtime.InteropServices.CharSet]::Unicode)))
}
$native=$builder.CreateType()
$results=@()
foreach($root in @('C:\','\\?\Volume{12dbd20e-1280-4ec0-abfa-22933ac79b60}\')){
 $handle=$native::CreateFileW($root,128,7,[IntPtr]::Zero,3,0x02200000,[IntPtr]::Zero)
 $nativeError=[Runtime.InteropServices.Marshal]::GetLastWin32Error()
 $buffer=[Runtime.InteropServices.Marshal]::AllocHGlobal(52)
 try{
  if($handle.IsInvalid){throw "Fixed root metadata open failed: $nativeError"}
  if(-not $native::GetFileInformationByHandle($handle,$buffer)){throw 'Fixed root identity query failed'}
  $bytes=[byte[]]::new(52)
  [Runtime.InteropServices.Marshal]::Copy($buffer,$bytes,0,52)
  $results += [pscustomobject]@{root=$root;attributes=[BitConverter]::ToUInt32($bytes,0);volumeSerial=[BitConverter]::ToUInt32($bytes,28).ToString('x8');fileId=[BitConverter]::ToUInt32($bytes,44).ToString('x8')+[BitConverter]::ToUInt32($bytes,48).ToString('x8');linkCount=[BitConverter]::ToUInt32($bytes,40);byteLength=[long][BitConverter]::ToUInt32($bytes,32)*4294967296+[BitConverter]::ToUInt32($bytes,36);lastWriteTimeLow=[BitConverter]::ToUInt32($bytes,20);lastWriteTimeHigh=[BitConverter]::ToUInt32($bytes,24)}
 }finally{$handle.Dispose();[Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)}
}
[pscustomobject]@{observedAtUtc=[DateTime]::UtcNow.ToString('o');roots=$results;directoryEnumeration=$false;fileContentsRead=$false;writes=$false;temporaryAssemblyFiles=$false}|ConvertTo-Json -Depth 5
