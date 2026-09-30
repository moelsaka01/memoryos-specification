// Preparation only: exact anchored instrumentation; never launches PowerShell.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),self=fileURLToPath(import.meta.url);
const source=path.join(root,'repositories/memoryos-readiness/helpers/windows-inspect.ps1');
const E=path.join(root,'repositories/cca-conformance/evidence/mo1307/startup-exit22/preparation-final');
assert.equal(process.argv.length,2);assert.equal(fs.existsSync(E),false,'Fresh preparation only');
const bytes=fs.readFileSync(source),original=bytes.toString('utf8');assert.deepEqual(Buffer.from(original),bytes);
const nl=original.includes('\r\n')?'\r\n':'\n';assert.equal(original.replaceAll('\r\n','').includes('\r'),false);
const lines=s=>s.replaceAll('\r\n','\n').replaceAll('\n',nl);
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const binding=file=>{const b=fs.readFileSync(file);return{path:path.relative(root,file).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
const definitions=JSON.parse(fs.readFileSync(path.join(root,'repositories/memoryos-readiness/contracts/definitions.json')));
assert.equal(definitions.limits.stderrBytes,4096);
const ledger=[],ids=new Map();
const note=(id,operation)=>{ids.set(id,{id,operation,status:'INSTRUMENTED'});return id;};
const start=(id,op)=>{note(id,op);return "D-Start '"+id+"' '"+op+"'";};
const ok=id=>"D-Ok '"+id+"'";
const val=(expr,id,op,expected)=>"$("+start(id,op)+"; $__mo1307Value = "+expr+"; D-Value $__mo1307Value $null $false; "+(expected!==undefined?"if ($__mo1307Value -eq "+expected+") { "+ok(id)+" }; ":"")+"$__mo1307Value)";
function native(expr,id,op,meaningful=true){
 let meaningfulExpression=meaningful?'($__mo1307Return -eq 0)':'$false',details='$null';
 if(expr.includes('WaitForSingleObject'))meaningfulExpression='($__mo1307Return -eq 4294967295)';
 if(expr.includes('GetWindowThreadProcessId'))details=expr.includes('$currentOwner')?'@{owner=$currentOwner}':'@{owner=$owner}';
 else if(expr.includes('OpenProcess'))details='@{owner=$owner}';
 else if(expr.includes('QueryFullProcessImageNameW'))details='@{imageLength=$imageLength}';
 else if(expr.includes('$consoleHandle'))details='@{heldHandle=$consoleHandle.ToInt64()}';
 return "$("+start(id,op)+"; $__mo1307Return = "+expr+"; $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error "+meaningfulExpression+" "+details+"; $__mo1307Return)";
}
function one(text,anchor,replacement){anchor=lines(anchor);replacement=lines(replacement);assert.equal(text.split(anchor).length,2,'Anchor must occur once: '+anchor.slice(0,100));return text.replace(anchor,replacement);}
function statement(text,anchor,id,op){const a=lines(anchor),indent=/^[ \t]*/.exec(a)[0];return one(text,a,indent+start(id,op)+nl+a+nl+indent+ok(id));}
const initStart=original.indexOf('function Initialize-Native {'),confirmStart=original.indexOf('function Confirm-ConsoleQuiescence {'),afterConfirm=original.indexOf('function Open-Native(');
assert.ok(initStart>=0&&confirmStart>initStart&&afterConfirm>confirmStart);
const originalInit=original.slice(initStart,confirmStart),originalConfirm=original.slice(confirmStart,afterConfirm);
let init=originalInit,confirm=originalConfirm;
const initStatements=[
 ["    $name = [Reflection.AssemblyName]::new('MemoryOSReadinessNative')",'S05.01','AssemblyName'],
 ["    $assembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly($name, [Reflection.Emit.AssemblyBuilderAccess]::Run)",'S05.02','DefineDynamicAssembly'],
 ["    $module = $assembly.DefineDynamicModule('Native')",'S05.03','DefineDynamicModule'],
 ["    $builder = $module.DefineType('MemoryOSReadiness.Native', [Reflection.TypeAttributes]'Public, Sealed, Abstract')",'S05.04','DefineType'],
 ["    $dllConstructor = [Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]] @([string]))",'S05.06','DllImport constructor lookup'],
 ["        $library = if ($definition.Count -eq 4) { $definition[3] } else { 'kernel32.dll' }",'S05.08','Select fixed native library'],
 ["        $method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)",'S05.10','SetImplementationFlags'],
 ["        $method.SetCustomAttribute($attribute)",'S05.12','SetCustomAttribute'],
 ["    $script:native = $builder.CreateType()",'S06','Native type creation']
];
for(const [anchor,id,op]of initStatements)init=statement(init,anchor,id,op);
init=one(init,'    $definitions = @(', "    "+start('S05.05','Native signature definitions')+"\n    $definitions = @(");
init=one(init,'    )\n    '+start('S05.06','DllImport constructor lookup'),'    )\n    '+ok('S05.05')+'\n    '+start('S05.06','DllImport constructor lookup'));
init=one(init,'    $fields = [Reflection.FieldInfo[]] @(','    '+start('S05.07','DllImport fields')+'\n    $fields = [Reflection.FieldInfo[]] @(');
init=one(init,"        [Runtime.InteropServices.DllImportAttribute].GetField('CharSet'))","        [Runtime.InteropServices.DllImportAttribute].GetField('CharSet'))\n    "+ok('S05.07'));
init=statement(init,["        $method = $builder.DefinePInvokeMethod($definition[0], $library, $definition[0],","            [Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [Reflection.CallingConventions]::Standard,","            $definition[1], $definition[2], [Runtime.InteropServices.CallingConvention]::Winapi,","            [Runtime.InteropServices.CharSet]::Unicode)"].join('\n'),'S05.09','DefinePInvokeMethod');
init=statement(init,["        $attribute = [Reflection.Emit.CustomAttributeBuilder]::new($dllConstructor, [object[]] @($library),","            $fields, [object[]] @($true, $true, [Runtime.InteropServices.CharSet]::Unicode))"].join('\n'),'S05.11','DllImport attribute construction');
for(const [id,operation]of [['S05.08','Select fixed native library'],['S05.09','DefinePInvokeMethod'],['S05.10','SetImplementationFlags'],['S05.11','DllImport attribute construction'],['S05.12','SetCustomAttribute']])init=one(init,start(id,operation),"D-Start '"+id+"' ('"+operation+" '+$definition[0])");
confirm=statement(confirm,"    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(4)",'S07','AllocHGlobal');
const replaceCalls=(text,expression,list)=>{const parts=text.split(expression);assert.equal(parts.length,list.length+1,expression);let out=parts[0];for(let i=0;i<list.length;i++){const [id,op,meaningful=true]=list[i];out+=native(expression,id,op,meaningful)+parts[i+1];}return out;};
confirm=replaceCalls(confirm,'$script:native::GetConsoleProcessList($buffer, 1)',[['S08','Initial console membership'],['S12.04','Recheck sole console membership'],['S20','Final console absence']]);
confirm=confirm.replaceAll('$nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()','$nativeError = $script:__mo1307LastError');
confirm=replaceCalls(confirm,'$script:native::GetConsoleWindow()',[['S12.01','Current console HWND/nonzero guard',false],['S12.03a','Recheck same console HWND',false]]);
confirm=replaceCalls(confirm,'$script:native::GetWindowThreadProcessId($window, [ref] $owner)',[['S12.02','Current HWND owner/nonzero distinct-self guard']]);
confirm=replaceCalls(confirm,'$script:native::GetWindowThreadProcessId($window, [ref] $currentOwner)',[['S12.03b','Recheck same HWND owner']]);
confirm=replaceCalls(confirm,'$script:native::OpenProcess(0x101000, $false, $owner)',[['S13.01','OpenProcess query-synchronize/nonzero guard']]);
confirm=replaceCalls(confirm,'$script:native::GetProcessId($consoleHandle)',[['S13.02','Opened handle PID equality'],['S12.05','Recheck held handle PID equality']]);
confirm=replaceCalls(confirm,'$script:native::QueryFullProcessImageNameW($consoleHandle, 0, $image, [ref] $imageLength)',[['S14','QueryFullProcessImageNameW/success guard']]);
confirm=replaceCalls(confirm,'$script:native::WaitForSingleObject($consoleHandle, 0)',[['S17','Held host live-object wait/258 guard']]);
confirm=replaceCalls(confirm,'$script:native::FreeConsole()',[['S16','FreeConsole/success guard']]);
confirm=replaceCalls(confirm,'$script:native::WaitForSingleObject($consoleHandle, 1000)',[['S19','Natural host exit wait/zero guard']]);
confirm=replaceCalls(confirm,'$script:native::CloseHandle($consoleHandle)',[['S21','CloseHandle original return discarded']]);
const readExpr='[Runtime.InteropServices.Marshal]::ReadInt32($buffer)';let readIndex=0;
confirm=confirm.replaceAll(readExpr,()=>{readIndex++;return val(readExpr,readIndex===1?'S08.01':'S12.04a',readIndex===1?'Initial sole-client PID read':'Rechecked sole-client PID read');});assert.equal(readIndex,2);
confirm=statement(confirm,'        $image = [Text.StringBuilder]::new(512); $imageLength = [uint32] 512','S14.00','Image buffer allocation');
confirm=statement(confirm,'        $systemDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::System)','S15.01','System directory lookup');
const compare="[string]::Equals($image.ToString(), $systemDirectory + '\\conhost.exe', [StringComparison]::OrdinalIgnoreCase)";
confirm=one(confirm,compare,val(compare,'S15.02','Exact system conhost image equality'));
confirm=statement(confirm,'        [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)','S22','FreeHGlobal');
confirm=one(confirm,'    } finally {','    } catch { D-Failure $_; throw } finally {');
const guarded=[];for(const line of confirm.split(nl)){guarded.push(line);if(line.includes("{ Reject-Protocol 'MO1307_INTERNAL' }"))guarded.push('        D-Ok $script:__mo1307D.activeId');}confirm=guarded.join(nl);
const startupAnchor=["try {","    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or","        -not [Environment]::Is64BitProcess) { exit 22 }","    $stdin = [Console]::OpenStandardInput()","    $savedStdout = [Console]::OpenStandardOutput()","    Initialize-Native","} catch { exit 22 }"].join('\n');
const diagnosticHelpers="    $script:__mo1307Clock = [Diagnostics.Stopwatch]::StartNew()\n    $script:__mo1307D = @{ activeId='ENTRY'; operation='Startup entry'; lastSuccessfulId=$null; nativeReturn=$null; win32Error=$null; win32ErrorMeaningful=$false; details=$null; firstFailure=$null }\n    $script:__mo1307Recent = [Collections.Generic.List[object]]::new()\n    $script:__mo1307LastError = 0\n    function D-Start([string]$Id,[string]$Operation) {\n        $script:__mo1307D.activeId=$Id; $script:__mo1307D.operation=$Operation\n        $script:__mo1307D.nativeReturn=$null; $script:__mo1307D.win32Error=$null; $script:__mo1307D.win32ErrorMeaningful=$false; $script:__mo1307D.details=$null\n    }\n    function D-Value($Value,$NativeError,[bool]$Meaningful,$Details=$null) {\n        if($Value -is [IntPtr]) { $Value=$Value.ToInt64() }\n        $script:__mo1307D.nativeReturn=$Value; $script:__mo1307D.win32Error=$NativeError; $script:__mo1307D.win32ErrorMeaningful=$Meaningful; $script:__mo1307D.details=$Details\n        $script:__mo1307Recent.Add([ordered]@{id=$script:__mo1307D.activeId;operation=$script:__mo1307D.operation;nativeReturn=$Value;win32Error=$NativeError;win32ErrorMeaningful=$Meaningful;details=$Details;elapsedMs=$script:__mo1307Clock.Elapsed.TotalMilliseconds})\n        if($script:__mo1307Recent.Count -gt 6) { $script:__mo1307Recent.RemoveAt(0) }\n    }\n    function D-Ok([string]$Id) { $script:__mo1307D.lastSuccessfulId=$Id }\n    function D-Exception($Caught) {\n        if($null -eq $Caught) { return $null }\n        $exception=$Caught.Exception\n        $message=[string]$exception.Message\n        $message=[regex]::Replace($message,'[A-Za-z]:[\\\\/][^\\r\\n]*','<path>')\n        $message=[regex]::Replace($message,'[\\r\\n\\t]',' ')\n        if($message.Length -gt 160) { $message=$message.Substring(0,160) }\n        return [ordered]@{exceptionType=$exception.GetType().FullName;hresult=$exception.HResult;message=$message}\n    }\n    function D-Failure($Caught) {\n        if($null -eq $script:__mo1307D.firstFailure) {\n            $exception=D-Exception $Caught\n            $script:__mo1307D.firstFailure=[ordered]@{id=$script:__mo1307D.activeId;operation=$script:__mo1307D.operation;lastSuccessfulId=$script:__mo1307D.lastSuccessfulId;nativeReturn=$script:__mo1307D.nativeReturn;win32Error=$script:__mo1307D.win32Error;win32ErrorMeaningful=$script:__mo1307D.win32ErrorMeaningful;details=$script:__mo1307D.details;selfPid=$PID;exceptionType=$(if($exception){$exception.exceptionType}else{$null});hresult=$(if($exception){$exception.hresult}else{$null});message=$(if($exception){$exception.message}else{'RUNTIME_CHECK_FALSE'});elapsedMs=$script:__mo1307Clock.Elapsed.TotalMilliseconds}\n        }\n    }\n    function D-EmitFailure($Caught) {\n        $ProgressPreference='SilentlyContinue'\n        try {\n            D-Failure $Caught\n            $record=[ordered]@{kind='MO1307StartupDiagnostic';event='FAILURE';outerId='S23';activeId=$script:__mo1307D.activeId;lastSuccessfulId=$script:__mo1307D.firstFailure.lastSuccessfulId;cleanupLastSuccessfulId=$script:__mo1307D.lastSuccessfulId;firstFailure=$script:__mo1307D.firstFailure;outerException=(D-Exception $Caught);recent=@($script:__mo1307Recent.ToArray());elapsedMs=$script:__mo1307Clock.Elapsed.TotalMilliseconds}\n            $encoded=ConvertTo-Json -InputObject $record -Depth 8 -Compress\n            while([Text.Encoding]::UTF8.GetByteCount($encoded) -gt 3900 -and $record.recent.Count -gt 0) {\n                $record.recent=@($record.recent | Select-Object -Skip 1)\n                $encoded=ConvertTo-Json -InputObject $record -Depth 8 -Compress\n            }\n            if([Text.Encoding]::UTF8.GetByteCount($encoded) -gt 3900) { $record.outerException=$null; $record.firstFailure.message='<bounded>'; $encoded=ConvertTo-Json -InputObject $record -Depth 8 -Compress }\n            if([Text.Encoding]::UTF8.GetByteCount($encoded) -le 3900) { [Console]::Error.WriteLine($encoded) }\n        } catch { }\n    }\n    [Console]::Error.WriteLine('{\"kind\":\"MO1307StartupDiagnostic\",\"event\":\"ENTRY\"}')";
let startup=lines(startupAnchor);
startup=one(startup,'try {','try {\n'+diagnosticHelpers);
startup=one(startup,'$PSVersionTable.PSVersion.Major',val('$PSVersionTable.PSVersion.Major','S01.01','PowerShell major version',5));
startup=one(startup,'$PSVersionTable.PSVersion.Minor',val('$PSVersionTable.PSVersion.Minor','S01.02','PowerShell minor version',1));
startup=one(startup,'[Environment]::Is64BitProcess',val('[Environment]::Is64BitProcess','S02','64-bit architecture','$true'));
startup=one(startup,') { exit 22 }',') { try { D-EmitFailure $null } catch { }; exit 22 }');
startup=statement(startup,'    $stdin = [Console]::OpenStandardInput()','S03','OpenStandardInput');
startup=statement(startup,'    $savedStdout = [Console]::OpenStandardOutput()','S04','OpenStandardOutput');
startup=one(startup,'} catch { exit 22 }','} catch { try { D-EmitFailure $_ } catch { }; exit 22 }');
note('S23','Outer startup catch; original exit22 preserved');
for(const [id,operation]of [['S09','Toolhelp snapshot'],['S10','Process32FirstW'],['S11','Process32NextW traversal'],['S18','TerminateProcess']])ids.set(id,{id,operation,status:'NOT_APPLICABLE',reason:'Absent from intended production helper; never introduced by diagnostics'});
let diagnostic=original;
for(const [id,from,to]of [['INITIALIZE',originalInit,init],['CONSOLE',originalConfirm,confirm],['STARTUP',lines(startupAnchor),startup]]){diagnostic=one(diagnostic,from,to);ledger.push({id,before:from,after:to});}
let reconstructed=diagnostic;for(const replacement of [...ledger].reverse())reconstructed=one(reconstructed,replacement.after,replacement.before);
assert.deepEqual(Buffer.from(reconstructed),bytes,'Inverse reconstruction must match original bytes');
const copyBytes=Buffer.from(diagnostic);
assert.equal((diagnostic.match(/MO1307StartupDiagnostic/g)??[]).length,2);
fs.mkdirSync(E,{recursive:true});const copy=path.join(E,'instrumented.ps1');fs.writeFileSync(copy,copyBytes,{flag:'wx'});
const proof={kind:'MO1307StartupDiagnosticInstrumentationProof',result:'PASS',reversibleAdditions:true,source:binding(source),generator:binding(self),diagnosticCopy:binding(copy),inverseSha256:hash(Buffer.from(reconstructed)),exactInverseEquality:true,unchangedOutsideThreeSelectedRegions:true,lineEndings:nl==='\n'?'LF':'CRLF',ids:[...ids.values()],replacements:ledger.map(x=>({id:x.id,beforeSha256:hash(Buffer.from(x.before)),afterSha256:hash(Buffer.from(x.after)),beforeByteLength:Buffer.byteLength(x.before),afterByteLength:Buffer.byteLength(x.after)})),stderr:{productCapBytes:4096,entryMaximumBytes:80,failureMaximumUtf8Bytes:3900,newlineMaximumBytes:4,totalMaximumBytes:3984,events:['ENTRY','FAILURE'],recentMaximum:6},semantics:{nativeCallCountsPreserved:true,shortCircuitExpressionsPreserved:true,byReferenceLocalScopePreserved:true,GetLastWin32ErrorCapturedBeforeObservation:true,originalGetLastWin32ErrorConsumersUseCachedValue:true,firstFailureCapturedBeforeFinally:true,cleanupExceptionAlsoRetained:true,productionFailuresNotSuppressed:true,originalExit22Preserved:true,stdoutUntouched:true,requestsUnobserved:true},preparationOnly:true,powershellExecutions:0,helperExecutions:0};
fs.writeFileSync(path.join(E,'instrumentation-proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(E,'replacement-ledger.json'),JSON.stringify(ledger,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(E,'inverse-reconstruction.ps1.data'),Buffer.from(reconstructed),{flag:'wx'});
assert.deepEqual(fs.readFileSync(source),bytes);
console.log(JSON.stringify({result:'PASS',preparationOnly:true,copy:binding(copy),proof:binding(path.join(E,'instrumentation-proof.json')),nativeExecutions:0}));
