import fs from 'node:fs';
import { packageMetadata, canonical, buildPackage } from '../mo1307-phase1/package.mjs';
fs.writeFileSync(new URL('../../../memoryos-readiness/package.json', import.meta.url), canonical(packageMetadata)+'\n');
process.stdout.write(JSON.stringify(buildPackage())+'\n');
