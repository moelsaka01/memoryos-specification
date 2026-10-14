"""Read-only post-BF validation; writes only an ignored external receipt."""
from datetime import datetime,timezone
from support import *
from validate import verify
if __name__=='__main__':
    result=verify('post');head=result['head'];i3=result['I3']
    checks={}
    for name,argv in [('workspace',[sys.executable,'-B','-X','utf8',ROOT/'tools/verify_workspace.py','--root',ROOT]),('diffBF',['git','--no-optional-locks','diff','--check','HEAD^','HEAD']),('diffI3',['git','--no-optional-locks','diff','--check',S3,i3])]:
        r=command(argv);need(r['exitCode']==0,name+'_FAILED');checks[name]=r
    status=git('status').decode();need(not git('status','--porcelain=v1').strip(),'FINAL_CLEAN')
    now=datetime.now(timezone.utc);started=datetime.fromisoformat(load('baseline.json')['startUtc'].replace('Z','+00:00'));elapsed=(now-started).total_seconds()
    need(elapsed<10800,'THREE_HOUR_HARD_STOP')
    value={'status':'PASS','utc':now.isoformat(),'elapsedSeconds':elapsed,'within60MinuteTarget':elapsed<=3600,'hardStopCompliant':elapsed<10800,'workspace':str(ROOT),'branch':'main','I3':i3,'I3Parent':S3,'BF':head,'BFParent':i3,'I3Diff':git('diff','--stat',S3,i3).decode(),'BFDiff':git('diff','--stat',i3,head).decode(),'I3FilesChanged':len(git('diff','--name-only',S3,i3).decode().splitlines()),'BFFilesChanged':len(git('diff','--name-only',i3,head).decode().splitlines()),'validation':result,'checks':checks,'gitStatus':status,'phaseStates':{'1':'COMPLETE','2':'COMPLETE','3':'COMPLETE'},'releaseState':'CERTIFIED_READY_TO_TAG','releaseTag':{'name':'memoryos-1.3-mo1306','state':'ABSENT','recommendedTarget':head},'pushes':0,'remoteMutations':0,'remoteQueries':0,'newHostedExecutions':0,'newNativeCampaigns':0,'newProviderValidation':0,'newAdvisoryResearch':0,'linuxUbuntuWsl':False,'vm':False,'providerAccountUse':False,'nextAction':'Review release tag memoryos-1.3-mo1306 at exact BF '+head+'; do not create or push without later user review.'}
    save(CACHE/'post-bf.json',value);print(json.dumps(value))
