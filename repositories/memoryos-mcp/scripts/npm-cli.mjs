import { existsSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
/** npm's CLI entry for the running Node: Windows layout first, then the POSIX prefix layout. */
export function npmCli(execPath=process.execPath) {
 const bin=dirname(execPath);
 for(const candidate of [resolve(bin,'node_modules/npm/bin/npm-cli.js'),resolve(bin,'../lib/node_modules/npm/bin/npm-cli.js')])if(existsSync(candidate))return candidate;
 throw new Error('NPM_CLI_NOT_FOUND');
}
