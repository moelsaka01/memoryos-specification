"""Closed role-bound topology validation. Process count alone is never acceptance."""
from pathlib import PureWindowsPath
def normalized(value):return str(PureWindowsPath(value)).casefold()
def validate(rows,root_pid,identities,phase='helper',expected_command=None):
 if len(rows)>3:raise ValueError('FOURTH_ATTRIBUTABLE_PROCESS')
 if len({r['pid'] for r in rows})!=len(rows):raise ValueError('DUPLICATE_PID')
 roots=[r for r in rows if r['pid']==root_pid]
 if len(roots)!=1:raise ValueError('SUPERVISOR_MISSING')
 root=roots[0]
 if normalized(root['executable'])!=normalized(identities['node']):raise ValueError('SUPERVISOR_SUBSTITUTION')
 children=[r for r in rows if r['parent']==root_pid and r['pid']!=root_pid]
 if len(children)>1:raise ValueError('MULTIPLE_DIRECT_CHILDREN')
 expected=identities['powershell'] if phase=='helper' else identities['node']
 if children:
  child=children[0]
  if normalized(child['executable'])!=normalized(expected):raise ValueError('ACTIVE_CHILD_SUBSTITUTION')
  if expected_command is not None and child['commandLine']!=expected_command:raise ValueError('COMMAND_SUBSTITUTION')
  rest=[r for r in rows if r['pid'] not in [root_pid,child['pid']]]
  if len(rest)>1:raise ValueError('EXTRA_DESCENDANT')
  if rest and (rest[0]['parent']!=child['pid'] or normalized(rest[0]['executable'])!=normalized(identities['conhost'])):raise ValueError('CONSOLE_HOST_SUBSTITUTION')
 elif len(rows)!=1:raise ValueError('UNOWNED_PROCESS')
 return True

def validate_launch(helper_bytes,helper_sha,node_sha,pinned_node_sha,args,env):
 import hashlib,base64
 if hashlib.sha256(helper_bytes).hexdigest()!=helper_sha:raise ValueError('HELPER_IDENTITY')
 if node_sha!=pinned_node_sha:raise ValueError('RUNTIME_IDENTITY')
 expected=['-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(helper_bytes.decode('utf-8').encode('utf-16le')).decode()]
 if args!=expected:raise ValueError('COMMAND_SUBSTITUTION')
 if set(env)!={'SystemRoot','WINDIR'} or normalized(env['SystemRoot'])!=normalized(env['WINDIR']):raise ValueError('ENVIRONMENT_INJECTION')
 return True
