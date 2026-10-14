from pathlib import Path
import copy,hashlib,json,subprocess,unittest
from topology import validate,validate_launch
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/correction-a'
data=json.loads((OUT/'attached.json').read_bytes())
summary=json.loads((OUT/'diagnostic-summary.json').read_bytes())
ids={k:v['path'] for k,v in summary['identities'].items()}
rows=next(s['processes'] for s in data['observation']['samples'] if len(s['processes'])==3)
root=data['rootPid'];child=data['protocol']['helperPid']
model=json.loads((OUT/'process-model.json').read_bytes())
class Correction(unittest.TestCase):
 def test_attached_protocol_and_roles(self):
  self.assertEqual(data['status'],'PASS');self.assertEqual(json.loads(data['protocol']['helperStdout'])['safe'],True)
  self.assertTrue(validate(rows,root,ids,expected_command=subprocess.list2cmdline([data['protocol']['executable'],*data['protocol']['args']])))
 def test_fourth_rejected(self):
  extra=copy.deepcopy(rows[0]);extra.update(pid=999999,parent=child)
  with self.assertRaisesRegex(ValueError,'FOURTH'):validate([*rows,extra],root,ids)
 def test_every_role_substitution(self):
  for row in rows:
   with self.subTest(pid=row['pid']):
    changed=copy.deepcopy(rows);next(r for r in changed if r['pid']==row['pid'])['executable']='C:\\untrusted\\replacement.exe'
    with self.assertRaises(ValueError):validate(changed,root,ids)
 def test_arbitrary_three_rejected(self):
  changed=copy.deepcopy(rows)
  for r in changed:
   if r['pid']!=root:r['parent']=root
  with self.assertRaisesRegex(ValueError,'MULTIPLE'):validate(changed,root,ids)
 def test_console_ownership(self):
  changed=copy.deepcopy(rows);next(r for r in changed if r['pid'] not in [root,child])['parent']=99999
  with self.assertRaises(ValueError):validate(changed,root,ids)
 def test_semantic_role(self):
  changed=copy.deepcopy(rows);next(r for r in changed if r['pid']==child)['executable']=ids['node']
  self.assertTrue(validate(changed,root,ids,'semantic'))
  with self.assertRaises(ValueError):validate(changed,root,ids,'helper')
 def test_semantic_extra_descendant(self):
  changed=copy.deepcopy(rows);next(r for r in changed if r['pid']==child)['executable']=ids['node']
  next(r for r in changed if r['pid'] not in [root,child])['executable']=ids['node']
  with self.assertRaises(ValueError):validate(changed,root,ids,'semantic')
 def test_command_substitution(self):
  with self.assertRaisesRegex(ValueError,'COMMAND'):validate(rows,root,ids,expected_command='unexpected')
 def test_runtime_and_helper_hash(self):
  args=data['protocol']['args'];helper=Path(__file__).with_name('check-paths.ps1.txt').read_bytes()
  self.assertTrue(validate_launch(helper,model['helperSha256'],summary['identities']['node']['sha256'],model['nodeSha256'],args,{'SystemRoot':'C:\\Windows','WINDIR':'C:\\Windows'}))
  for helperbytes,nodehash,arguments in [(helper+b' ',model['nodeSha256'],args),(helper,'0'*64,args),(helper,model['nodeSha256'],args+['bad'])]:
   with self.assertRaises(ValueError):validate_launch(helperbytes,model['helperSha256'],nodehash,model['nodeSha256'],arguments,{'SystemRoot':'C:\\Windows','WINDIR':'C:\\Windows'})
 def test_environment_injection(self):
  for name in ['NODE_OPTIONS','NODE_PATH','PATH','ComSpec','PSModulePath','TEMP']:
   with self.subTest(name=name):
    with self.assertRaisesRegex(ValueError,'ENVIRONMENT'):validate_launch(Path(__file__).with_name('check-paths.ps1.txt').read_bytes(),model['helperSha256'],model['nodeSha256'],model['nodeSha256'],data['protocol']['args'],{'SystemRoot':'C:\\Windows','WINDIR':'C:\\Windows',name:'injected'})
 def test_detached_rejected_as_protocol(self):
  detached=json.loads((OUT/'detached.json').read_bytes())
  self.assertEqual(detached['protocol']['helperStdout'],'');self.assertEqual(detached['protocol']['helperExit'],0)
 def test_no_observed_orphans(self):
  for name in ['attached','detached','stdio-diagnostic']:
   self.assertEqual(json.loads((OUT/(name+'.json')).read_bytes())['cleanup']['remainingPids'],[])
 def test_authority_and_unchanged_limits(self):
  freeze=(ROOT/'docs/mo1306-contract-freeze-1.md').read_text(encoding='utf-8')
  old=subprocess.check_output(['git','show','3537b037e4ea70a726a249d7397f1df15daa2167:docs/mo1306-contract-freeze-1.md'],cwd=ROOT).decode()
  def fixed(s):return s.split('configBytes:16384,',1)[1].split('\n'+chr(96)*3,1)[0]
  self.assertEqual(fixed(freeze),fixed(old).replace('processCount:2','processCount:3'))
  self.assertEqual(model['maximumAttributableProcesses'],3)
  self.assertNotIn('processCount:2',fixed(freeze))
  for text in ['Correction A','no Linux fallback','No phase requires Linux, Ubuntu, WSL','2000 ms termination allowance','fourth attributable process','No arbitrary three-process topology']:self.assertIn(text,freeze)
 def test_old_attempt_preserved(self):
  baseline=json.loads((OUT/'dirty-baseline.json').read_bytes())
  inventory=baseline.get('paths',baseline.get('files',[]))
  self.assertTrue(inventory)
  for row in inventory:
   if row.get('classification')=='blocker evidence/report':self.assertEqual(hashlib.sha256((ROOT/row['path']).read_bytes()).hexdigest(),row['sha256'].removeprefix('sha256:'))
if __name__=='__main__':
 result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Correction))
 (OUT/'contract-tests.json').write_text(json.dumps({'tests':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'status':'PASS' if result.wasSuccessful() else 'FAIL'},indent=2)+'\n')
 raise SystemExit(0 if result.wasSuccessful() else 1)
