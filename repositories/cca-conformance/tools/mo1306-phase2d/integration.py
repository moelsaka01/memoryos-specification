from common import *
command('integration-structure',[NODE,'--test','--test-reporter=tap',TOOLS/'integration.test.mjs'],tests=47,env={**os.environ,**ENV},timeout=90)
