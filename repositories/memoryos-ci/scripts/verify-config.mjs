import { verifyInstallation } from '../src/integrity.mjs';
import { readChecked,checkPaths,absolutePath } from '../src/filesystem.mjs';
import { configuration,digest } from '../src/contracts.mjs';
import { J } from '../src/serialization.mjs';
import { diagnosticWriter,classification,projections,reject } from '../src/errors.mjs';
try {
  await verifyInstallation();
  if(process.argv.length!==4)reject('USAGE');
  const config=absolutePath(process.argv[2]);await checkPaths([{path:config,allowMissingLeaf:false}]);
  if(digest(J(configuration(readChecked(config,16384))))!==process.argv[3])reject('CONFIG_INTEGRITY');
} catch(e) {diagnosticWriter(s=>process.stderr.write(s))(e);process.exitCode=projections[classification(e)].exitCode;}
