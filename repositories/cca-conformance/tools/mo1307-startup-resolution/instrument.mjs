// Preparation only. Exact anchored reversible trace; never starts a helper or shell.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),self=fileURLToPath(import.meta.url);
const source=path.join(root,'repositories/memoryos-readiness/helpers/windows-inspect.ps1');
const E=path.join(root,'repositories/cca-conformance/evidence/mo1307/startup-resolution/diagnostic-preparation');
assert.equal(process.argv.length,2);assert.equal(fs.existsSync(E),false,'Fresh preparation only; no overwrite');
const bytes=fs.readFileSync(source),original=bytes.toString('utf8');assert.deepEqual(Buffer.from(original),bytes);
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
assert.equal(hash(bytes),'sha256:158a4008131ede42458ba60a8166e63abad180443031ea05bf75c3180a2ad846');
const record=file=>{const b=fs.readFileSync(file);return{path:path.relative(root,file).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
const nl=original.includes('\r\n')?'\r\n':'\n',lines=s=>s.replaceAll('\r\n','\n').replaceAll('\n',nl);
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'repositories/memoryos-readiness/contracts/definitions.json'))).limits.stderrBytes,4096);
const ids=new Map(),ledger=[];
function note(id,operation,extra={}){ids.set(id,{id,operation,status:'INSTRUMENTED',...extra});return id;}
function one(text,anchor,replacement){anchor=lines(anchor);replacement=lines(replacement);assert.equal(text.split(anchor).length,2,'Unique anchor: '+anchor.slice(0,120));return text.replace(anchor,replacement);}
const start=id=>"D-Start '"+id+"'";
const end=(id,value='1',passed='$true')=>"D-End '"+id+"' "+value+" "+passed;
function statement(text,anchor,id,operation,value='1',passed='$true'){note(id,operation);const indent=/^[ \t]*/.exec(anchor)[0];return one(text,anchor,indent+start(id)+'\n'+anchor+'\n'+indent+end(id,value,passed));}
function value(expr,id,operation,expected=null){note(id,operation);return "$("+start(id)+"; $__trValue = "+expr+"; "+end(id,'$__trValue',expected===null?'$true':'($__trValue -eq '+expected+')')+"; $__trValue)";}
function native(expr,id,operation,passed,meaningful){note(id,operation,{native:true});return "$("+start(id)+"; $__trNativeResult = "+expr+"; $__trNativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__trLastError = $__trNativeError; D-End '"+id+"' $__trNativeResult ("+passed+") $__trNativeError ("+meaningful+") $true; $__trNativeResult)";}
const initAt=original.indexOf('function Initialize-Native {'),consoleAt=original.indexOf('function Confirm-ConsoleQuiescence {'),afterConsole=original.indexOf('function Open-Native(');
assert.ok(initAt>=0&&consoleAt>initAt&&afterConsole>consoleAt);
const oldInit=original.slice(initAt,consoleAt),oldConsole=original.slice(consoleAt,afterConsole);
let init=oldInit,consoleBody=oldConsole;
for(const [anchor,id,op,val]of [
 ["    $name = [Reflection.AssemblyName]::new('MemoryOSReadinessNative')",'T007.1','AssemblyName construction','($null -ne $name)'],
 ["    $assembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly($name, [Reflection.Emit.AssemblyBuilderAccess]::Run)",'T007.2','Dynamic assembly construction','($null -ne $assembly)'],
 ["    $module = $assembly.DefineDynamicModule('Native')",'T007.3','Dynamic module construction','($null -ne $module)'],
 ["    $builder = $module.DefineType('MemoryOSReadiness.Native', [Reflection.TypeAttributes]'Public, Sealed, Abstract')",'T007.4','Native type builder construction','($null -ne $builder)'],
 ["    $dllConstructor = [Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]] @([string]))",'T009.1','DllImport constructor resolution','($null -ne $dllConstructor)'],
 ["    $script:native = $builder.CreateType()",'T008','Create native type','($null -ne $script:native)']
])init=statement(init,anchor,id,op,val,val);
note('T009.0','Construct eight fixed signature definitions');
init=one(init,'    $definitions = @(','    '+start('T009.0')+'\n    $definitions = @(');
init=one(init,'    )\n    '+start('T009.1'),'    )\n    '+end('T009.0','$definitions.Count')+'\n    '+start('T009.1'));
for(const [field,id]of [['SetLastError','T009.2'],['ExactSpelling','T009.3'],['CharSet','T009.4']]){
 const expr="[Runtime.InteropServices.DllImportAttribute].GetField('"+field+"')";
 note(id,'Resolve DllImport field '+field);
 init=one(init,expr,"$("+start(id)+"; $__trField = "+expr+"; "+end(id,'($null -ne $__trField)','($null -ne $__trField)')+"; $__trField)");
}
init=one(init,'    foreach ($definition in $definitions) {','    $script:__trIteration = 0\n    foreach ($definition in $definitions) {\n        $script:__trIteration++');
const loopBlocks=[
 ["        $library = if ($definition.Count -eq 4) { $definition[3] } else { 'kernel32.dll' }\n        $method = $builder.DefinePInvokeMethod($definition[0], $library, $definition[0],\n            [Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [Reflection.CallingConventions]::Standard,\n            $definition[1], $definition[2], [Runtime.InteropServices.CallingConvention]::Winapi,\n            [Runtime.InteropServices.CharSet]::Unicode)",1,'Select fixed library and define PInvoke method','($null -ne $method)'],
 ["        $method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)",2,'Set PreserveSig implementation flags','1'],
 ["        $attribute = [Reflection.Emit.CustomAttributeBuilder]::new($dllConstructor, [object[]] @($library),\n            $fields, [object[]] @($true, $true, [Runtime.InteropServices.CharSet]::Unicode))",3,'Construct DllImport attribute','($null -ne $attribute)'],
 ["        $method.SetCustomAttribute($attribute)",4,'Attach DllImport attribute','1']
];
const symbols=['CreateFileW','GetFileInformationByHandle','GetFinalPathNameByHandleW','GetFileType(SafeFileHandle)','GetStdHandle','GetFileType(IntPtr)','GetConsoleProcessList','FreeConsole'];
for(const [anchor,suffix,op,val]of loopBlocks){
 for(let ordinal=1;ordinal<=8;ordinal++)note('T009.'+(ordinal*10+suffix),op+' for '+symbols[ordinal-1],{definitionOrdinal:ordinal});
 const id="('T009.' + ($script:__trIteration * 10 + "+suffix+"))";
 init=one(init,anchor,'        D-Start '+id+'\n'+anchor+'\n        D-End '+id+' '+val+' '+(val==='1'?'$true':val));
}
for(let ordinal=1;ordinal<=3;ordinal++){
 for(const [suffix,op]of [['a','GetStdHandle'],['b','Zero-handle guard'],['c','Invalid-minus-one guard'],['d','GetFileType pipe guard']])note('T015.'+ordinal+suffix,op+' for '+['stdin','stdout','stderr'][ordinal-1],{selector:-9-ordinal});
}
init=statement(init,'    Confirm-ConsoleQuiescence','T015','Invoke current pipe/membership/self-detach startup function');
const stdId=suffix=>"('T015.' + (-$selector - 9) + '"+suffix+"')";
consoleBody=one(consoleBody,'$script:native::GetStdHandle($selector)',"$(D-Start "+stdId('a')+"; $__trNativeResult = $script:native::GetStdHandle($selector); $__trNativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__trLastError = $__trNativeError; D-End "+stdId('a')+" $__trNativeResult ($__trNativeResult -ne [IntPtr]::Zero -and $__trNativeResult -ne [IntPtr]::new(-1)) $__trNativeError ($__trNativeResult -eq [IntPtr]::Zero -or $__trNativeResult -eq [IntPtr]::new(-1)) $true; $__trNativeResult)");
for(const [expr,suffix]of [['$standardHandle -eq [IntPtr]::Zero','b'],['$standardHandle -eq [IntPtr]::new(-1)','c']]){
 consoleBody=one(consoleBody,expr,"$(D-Start "+stdId(suffix)+"; $__trGuard = "+expr+"; D-End "+stdId(suffix)+" $__trGuard (-not $__trGuard); $__trGuard)");
}
consoleBody=one(consoleBody,'$script:native::GetFileType($standardHandle)',"$(D-Start "+stdId('d')+"; $__trNativeResult = $script:native::GetFileType($standardHandle); $__trNativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__trLastError = $__trNativeError; D-End "+stdId('d')+" $__trNativeResult ($__trNativeResult -eq 3) $__trNativeError ($__trNativeResult -eq 0) $true; $__trNativeResult)");
consoleBody=statement(consoleBody,'    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(4)','T010','Allocate four-byte native membership buffer','($buffer -ne [IntPtr]::Zero)');
let membershipIndex=0;
consoleBody=consoleBody.replaceAll('$script:native::GetConsoleProcessList($buffer, 1)',()=>++membershipIndex===1
 ?native('$script:native::GetConsoleProcessList($buffer, 1)','T011','Initial membership call','($__trNativeResult -eq 0 -and $__trNativeError -eq 6) -or $__trNativeResult -eq 1','$__trNativeResult -eq 0')
 :native('$script:native::GetConsoleProcessList($buffer, 1)','T018','Post-detach membership call','$__trNativeResult -eq 0 -and $__trNativeError -eq 6','$__trNativeResult -eq 0'));
assert.equal(membershipIndex,2);
let errIndex=0;
consoleBody=consoleBody.replaceAll('$nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()',()=>{
 const id=++errIndex===1?'T012':'T019',variable=errIndex===1?'$count':'$remaining';note(id,'Reuse immediately captured membership result and Win32 error');
 return '$nativeError = $script:__trLastError'+nl+'        D-End \''+id+'\' '+variable+' $true $nativeError ('+variable+' -eq 0)';
});
assert.equal(errIndex,2);
consoleBody=one(consoleBody,'$count -eq 0 -and $nativeError -eq 6',value('($count -eq 0 -and $nativeError -eq 6)','T013.1','Native no-console absence branch'));
consoleBody=one(consoleBody,'$count -ne 1',value('($count -ne 1)','T013.2','Sole membership count guard','$false'));
consoleBody=one(consoleBody,'[Runtime.InteropServices.Marshal]::ReadInt32($buffer)',value('[Runtime.InteropServices.Marshal]::ReadInt32($buffer)','T014','Read sole member and require self PID','$PID'));
note('T016','Decision to detach current helper after sole membership passes');
consoleBody=one(consoleBody,'        if (-not $script:native::FreeConsole())','        '+end('T016','$PID')+'\n        if (-not $script:native::FreeConsole())');
consoleBody=one(consoleBody,'$script:native::FreeConsole()',native('$script:native::FreeConsole()','T017','Self-detach result','$__trNativeResult','-not $__trNativeResult'));
consoleBody=one(consoleBody,'$remaining -ne 0',value('($remaining -ne 0)','T020.1','Final membership count must be zero','$false'));
consoleBody=one(consoleBody,'$nativeError -ne 6',value('($nativeError -ne 6)','T020.2','Final absence error must be six','$false'));
consoleBody=consoleBody.replaceAll("{ Reject-Protocol 'MO1307_INTERNAL' }","{ D-Failure $null; Reject-Protocol 'MO1307_INTERNAL' }");
note('T021','No owned native process handles exist; standard handles are borrowed and never closed',{status:'NOT_APPLICABLE'});
consoleBody=one(consoleBody,'    } finally {','    } catch { D-Failure $_; throw } finally {\n        D-End \'T021\' 0');
consoleBody=statement(consoleBody,'        [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)','T022','Free four-byte membership buffer');
const startupAt=original.indexOf('try {',original.indexOf('# Save all redirected transports'));
const startupEnd=original.indexOf('} catch { exit 22 }',startupAt)+'} catch { exit 22 }'.length;
assert.ok(startupAt>afterConsole&&startupEnd>startupAt);
const oldStartup=original.slice(startupAt,startupEnd);let startup=oldStartup;
startup=one(startup,'$PSVersionTable.PSVersion.Major',value('$PSVersionTable.PSVersion.Major','T002.1','PowerShell major version',5));
startup=one(startup,'$PSVersionTable.PSVersion.Minor',value('$PSVersionTable.PSVersion.Minor','T002.2','PowerShell minor version',1));
startup=one(startup,'[Environment]::Is64BitProcess',value('[Environment]::Is64BitProcess','T003','64-bit process architecture','$true'));
for(const [line,id,op]of [
 ['    $stdin = [Console]::OpenStandardInput()','T004','Acquire managed stdin'],
 ['    $savedStdout = [Console]::OpenStandardOutput()','T005','Acquire managed stdout'],
 ['    $savedStderr = [Console]::OpenStandardError()','T006.1','Acquire managed stderr']
])startup=statement(startup,line,id,op);
for(const [expr,id,op,expected]of [
 ['[object]::ReferenceEquals($stdin, [IO.Stream]::Null)','T006.2','stdin Stream.Null guard','$false'],
 ['[object]::ReferenceEquals($savedStdout, [IO.Stream]::Null)','T006.3','stdout Stream.Null guard','$false'],
 ['[object]::ReferenceEquals($savedStderr, [IO.Stream]::Null)','T006.4','stderr Stream.Null guard','$false'],
 ['$stdin.CanRead','T006.5','stdin readability guard','$true'],
 ['$savedStdout.CanWrite','T006.6','stdout writability guard','$true'],
 ['$savedStderr.CanWrite','T006.7','stderr writability guard','$true']
])startup=one(startup,expr,value(expr,id,op,expected));
startup=startup.replaceAll('{ exit 22 }','{ try { D-EmitFailure $null } catch {}; exit 22 }');
startup=statement(startup,'    Initialize-Native','T007','Invoke native initialization and console startup gates');
startup=one(startup,"    D-End 'T007' 1 $true","    D-End 'T007' 1 $true\n    "+end('T023'));
note('T023','Completed all startup gates');
startup=one(startup,'} catch { try { D-EmitFailure $null } catch {}; exit 22 }','} catch { try { D-EmitFailure $_ $true } catch {}; exit 22 }');
note('T025','Outer startup catch preserves unconditional exit22 and first failure before cleanup');
const headerAnchor="    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or\n        -not [Environment]::Is64BitProcess) { Reject-Protocol }\n    $header = [byte[]]::new(4)\n    $used = 0";
let header=lines(headerAnchor);
header=one(header,'$PSVersionTable.PSVersion.Major',value('$PSVersionTable.PSVersion.Major','T024.1','Pre-read major version guard',5));
header=one(header,'$PSVersionTable.PSVersion.Minor',value('$PSVersionTable.PSVersion.Minor','T024.2','Pre-read minor version guard',1));
header=one(header,'[Environment]::Is64BitProcess',value('[Environment]::Is64BitProcess','T024.3','Pre-read architecture guard','$true'));
header=header.replace('{ Reject-Protocol }','{ D-Failure $null; Reject-Protocol }');
header=statement(header,'    $header = [byte[]]::new(4)','T024.4','Allocate first four-byte request header (contents unobserved)');
header=statement(header,'    $used = 0','T024.5','Initialize first request-read counter');
header='    try {'+nl+header+nl+'    } catch { try { D-EmitFailure $_ } catch {}; throw }';
note('T024','First actual stdin.Read call site reached once; no request contents recorded');
const readAnchor='        $count = $stdin.Read($header, $used, 4 - $used)';
const readTrace="        if (-not $script:__trRead) { $script:__trRead=$true; D-End 'T024' }"+nl+readAnchor;
const preludeEnd=original.indexOf('function Reject-Protocol('),oldPrelude=original.slice(0,preludeEnd);
note('T001','Script entry with self PID before original executable prelude');
note('T001.1','Original Set-StrictMode, ErrorActionPreference and static protocol-state initialization');
const diagnosticHelpers="# Engineering trace functions do not alter stdout or load JSON cmdlets.\n$script:__trStream=$null; $script:__trClock=$null; $script:__trUsed=0; $script:__trNormal=0\n$script:__trId='T001'; $script:__trLast=$null; $script:__trValue=$null; $script:__trNative=$null\n$script:__trFirst=$null; $script:__trOverflow=$false; $script:__trLastError=0; $script:__trRead=$false\nfunction D-Time { if($null -eq $script:__trClock){return 0}; return [Math]::Min(999999,[long]$script:__trClock.Elapsed.TotalMilliseconds) }\nfunction D-Q($Value,[int]$Limit=64) {\n    if($null -eq $Value){return 'null'}\n    $text=[string]$Value\n    $text=[regex]::Replace($text,'[A-Za-z]:[\\\\/][^\\r\\n]*','<path>')\n    $text=[regex]::Replace($text,'[^\\x20-\\x7e]','?').Replace('\\','/').Replace('\"',\"'\")\n    if($text.Length -gt $Limit){$text=$text.Substring(0,$Limit)}\n    return '\"'+$text+'\"'\n}\nfunction D-Scalar($Value) {\n    if($null -eq $Value){return 'null'}\n    if($Value -is [bool]){if($Value){return '1'}else{return '0'}}\n    if($Value -is [IntPtr]){return $Value.ToInt64().ToString([Globalization.CultureInfo]::InvariantCulture)}\n    if($Value -is [ValueType]){return [string]::Format([Globalization.CultureInfo]::InvariantCulture,'{0}',$Value)}\n    return D-Q $Value 16\n}\nfunction D-Write([string]$Text,[bool]$Critical=$false) {\n    try {\n        $b=[Text.Encoding]::UTF8.GetBytes($Text+[char]10)\n        if($null -eq $script:__trStream){return}\n        if(-not $Critical -and $script:__trNormal+$b.Length -gt 3000){\n            if(-not $script:__trOverflow){\n                $script:__trOverflow=$true\n                D-Write ('{\"kind\":\"MO1307StartupTraceOverflow\",\"id\":'+(D-Q $script:__trId 16)+',\"elapsedMs\":'+(D-Time)+'}') $true\n            }\n            return\n        }\n        if($script:__trUsed+$b.Length -le 4096){\n            $script:__trStream.Write($b,0,$b.Length)\n            $script:__trUsed+=$b.Length\n            if(-not $Critical){$script:__trNormal+=$b.Length}\n        }\n    } catch { }\n}\nfunction D-Start([string]$Id) { try {$script:__trId=$Id; $script:__trValue=$null} catch {} }\nfunction D-End([string]$Id,$Value=1,[bool]$Passed=$true,$ErrorCode=$null,[bool]$Meaningful=$false,[bool]$Native=$false) {\n    try {\n        $script:__trId=$Id; $script:__trValue=$Value\n        if($Native){$script:__trNative=@{id=$Id;value=$Value;error=$ErrorCode;meaningful=$Meaningful}}\n        if(-not $Passed){D-Failure $null}\n        $line='['+(D-Q $Id 16)+','+(D-Time)+','+(D-Scalar $Value)+','+(D-Scalar $ErrorCode)+','+([int]$Meaningful)+','+([int]$Passed)+']'\n        D-Write $line ($Id -eq 'T021' -or $Id -eq 'T022')\n        if($Passed){$script:__trLast=$Id}\n    } catch {}\n}\nfunction D-Exception($Caught) {\n    if($null -eq $Caught){return $null}\n    $e=$Caught.Exception; $inner=$null\n    if($null -ne $e.InnerException){$i=$e.InnerException;$inner=@{type=$i.GetType().FullName;hresult=$i.HResult;message=$i.Message}}\n    return @{type=$e.GetType().FullName;hresult=$e.HResult;message=$e.Message;inner=$inner}\n}\nfunction D-Failure($Caught) {\n    try {\n        $ex=D-Exception $Caught\n        if($null -eq $script:__trFirst){$script:__trFirst=@{id=$script:__trId;lastSuccessfulId=$script:__trLast;value=$script:__trValue;native=$script:__trNative;exception=$ex;elapsedMs=(D-Time)}}\n        elseif($null -eq $script:__trFirst.exception -and $null -ne $ex){$script:__trFirst.exception=$ex}\n    } catch {}\n}\nfunction D-ExceptionJson($Ex,[bool]$WithInner=$true) {\n    if($null -eq $Ex){return 'null'}\n    $s='{\"type\":'+(D-Q $Ex.type 64)+',\"hresult\":'+(D-Scalar $Ex.hresult)+',\"message\":'+(D-Q $Ex.message 64)\n    if($WithInner -and $null -ne $Ex.inner){$s+=',\"inner\":'+(D-ExceptionJson $Ex.inner $false)}\n    return $s+'}'\n}\nfunction D-EmitFailure($Caught,[bool]$OuterCatch=$false) {\n    try {\n        D-Failure $Caught\n        $f=$script:__trFirst; $n=$f.native; $native='null'\n        if($null -ne $n){$native='{\"id\":'+(D-Q $n.id 16)+',\"value\":'+(D-Scalar $n.value)+',\"error\":'+(D-Scalar $n.error)+',\"meaningful\":'+([int]$n.meaningful)+'}'}\n        $outer=D-Exception $Caught\n        if($null -ne $outer -and $null -ne $f.exception -and $outer.type -eq $f.exception.type -and $outer.hresult -eq $f.exception.hresult -and $outer.message -eq $f.exception.message){$outer=$null}\n        $record='{\"kind\":\"MO1307StartupTraceFailure\",\"outerId\":\"T025\",\"outerCatch\":'+([int]$OuterCatch)+',\"firstFailure\":{\"id\":'+(D-Q $f.id 16)+',\"lastSuccessfulId\":'+(D-Q $f.lastSuccessfulId 16)+',\"value\":'+(D-Scalar $f.value)+',\"native\":'+$native+',\"exception\":'+(D-ExceptionJson $f.exception)+',\"elapsedMs\":'+$f.elapsedMs+'},\"activeId\":'+(D-Q $script:__trId 16)+',\"cleanupLastSuccessfulId\":'+(D-Q $script:__trLast 16)+',\"outerException\":'+(D-ExceptionJson $outer $false)+',\"traceOverflow\":'+([int]$script:__trOverflow)+'}'\n        D-Write $record $true\n    } catch {}\n}\ntry {$script:__trClock=[Diagnostics.Stopwatch]::StartNew();$script:__trStream=[Console]::OpenStandardError();D-End 'T001' $PID} catch {}\n";
const prelude=lines(diagnosticHelpers)+nl+"D-Start 'T001.1'"+nl+'try {'+nl+oldPrelude+nl+"    D-End 'T001.1'"+nl+"} catch { try { D-EmitFailure $_ } catch {}; throw }"+nl;
let diagnostic=original;
for(const [id,before,after]of [
 ['INITIALIZE',oldInit,init],['CONSOLE',oldConsole,consoleBody],['STARTUP',oldStartup,startup],
 ['PRE_READ_HEADER',lines(headerAnchor),header],['FIRST_READ_MARKER',readAnchor,readTrace],['PRELUDE',oldPrelude,prelude]
]){diagnostic=one(diagnostic,before,after);ledger.push({id,before:lines(before),after:lines(after)});}
let inverse=diagnostic;for(const replacement of [...ledger].reverse())inverse=one(inverse,replacement.after,replacement.before);
assert.deepEqual(Buffer.from(inverse),bytes,'Exact inverse reconstruction');
for(let number=1;number<=25;number++){
 const base='T'+String(number).padStart(3,'0');
 if(!ids.has(base))note(base,'Coverage group; see concrete executed sub-IDs',{status:'GROUP',emits:false});
}
const maximumOrdinaryRows=[...ids.values()].filter(x=>!['GROUP','NOT_APPLICABLE'].includes(x.status)&&x.id!=='T022'&&x.id!=='T025');
const bound=maximumOrdinaryRows.reduce((sum,row)=>{
 const v=row.id==='T014'?'-2147483648':['T001','T016','T012','T019'].includes(row.id)?4294967295:row.id.startsWith('T015.')&&row.id.endsWith('a')?'-9223372036854775808':row.native||(/^T015\.[123]d$/.test(row.id))?4294967295:1;
 const valueText=typeof v==='string'?v:String(v);
 const nativeField=row.native||(/^T015\.[123][ad]$/.test(row.id))||['T012','T019'].includes(row.id)?'-2147483648':'null';
 return sum+Buffer.byteLength('["'+row.id+'",999999,'+valueText+','+nativeField+',0,1]\n');
},0);
assert.ok(bound<=3000,'Full ordinary trace bound exceeds budget: '+bound);
const criticalWorst={kind:'MO1307StartupTraceFailure',outerId:'T025',outerCatch:1,firstFailure:{id:'T'.repeat(16),lastSuccessfulId:'T'.repeat(16),value:-9223372036854775808,native:{id:'T'.repeat(16),value:-9223372036854775808,error:-2147483648,meaningful:1},exception:{type:'X'.repeat(64),hresult:-2147483648,message:'X'.repeat(64),inner:{type:'X'.repeat(64),hresult:-2147483648,message:'X'.repeat(64)}},elapsedMs:999999},activeId:'T'.repeat(16),cleanupLastSuccessfulId:'T'.repeat(16),outerException:{type:'X'.repeat(64),hresult:-2147483648,message:'X'.repeat(64)},traceOverflow:1};
const criticalFailureMaximumBytes=Buffer.byteLength(JSON.stringify(criticalWorst)+'\n');
const cleanupMaximumBytes=Buffer.byteLength('["T021",999999,0,null,0,1]\n["T022",999999,1,null,0,1]\n');
const overflowMaximumBytes=Buffer.byteLength(JSON.stringify({kind:'MO1307StartupTraceOverflow',id:'T'.repeat(16),elapsedMs:999999})+'\n');
assert.ok(criticalFailureMaximumBytes+cleanupMaximumBytes+overflowMaximumBytes<=1096,'Critical diagnostic reserve must retain primary failure and cleanup');
fs.mkdirSync(E,{recursive:true});const copy=path.join(E,'instrumented.ps1');
fs.writeFileSync(copy,diagnostic,{flag:'wx'});
const proof={kind:'MO1307FullStartupTraceInstrumentationProof',result:'PASS',reversibleAdditions:true,source:record(source),generator:record(self),diagnosticCopy:record(copy),inverseSha256:hash(Buffer.from(inverse)),exactInverseEquality:true,unchangedOutsideSelectedRegions:true,ids:[...ids.values()],stderr:{productCapBytes:4096,totalMaximumBytes:4096,ordinaryBudgetBytes:3000,calculatedFullCoverageMaximumBytes:bound,reservedCriticalBytes:1096,criticalFailureMaximumBytes,cleanupMaximumBytes,overflowMaximumBytes,eventFormat:['id','elapsedMsInteger','scalar','win32ErrorOrNull','meaningful_0or1','passed_0or1'],failureKind:'MO1307StartupTraceFailure',overflowKind:'MO1307StartupTraceOverflow',failureExceptionDepth:2,exceptionTypeMaximumCharacters:64,exceptionMessageMaximumCharacters:64,diagnosticStreamSavedBeforeDetach:true,JSONCmdlets:false},semantics:{exactOriginalNativeCallsAndOrder:true,originalGetLastWin32ErrorConsumersUseImmediateCachedResult:true,shortCircuitPreserved:true,firstFailureCapturedBeforeFinally:true,cleanupCannotReplaceFirstFailure:true,originalExit22Preserved:true,stdoutAndWireUnchanged:true,requestContentsUnobserved:true,noNativeHandleClosedByDiagnostics:true},replacements:ledger.map(x=>({id:x.id,beforeSha256:hash(Buffer.from(x.before)),afterSha256:hash(Buffer.from(x.after)),beforeByteLength:Buffer.byteLength(x.before),afterByteLength:Buffer.byteLength(x.after)})),preparationOnly:true,helperExecutions:0};
fs.writeFileSync(path.join(E,'instrumentation-proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(E,'replacement-ledger.json'),JSON.stringify(ledger,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(E,'inverse-reconstruction.ps1.data'),Buffer.from(inverse),{flag:'wx'});
assert.deepEqual(fs.readFileSync(source),bytes);
console.log(JSON.stringify({result:'PASS',preparationOnly:true,copy:record(copy),proof:record(path.join(E,'instrumentation-proof.json')),ordinaryTraceMaximumBytes:bound,helperExecutions:0}));
