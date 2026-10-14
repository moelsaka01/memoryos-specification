// MO-1308 Phase 3 shared tool (kept outside lib/ because the default root is Windows-specific): the short temporary root (A8.9). Any stream that makes temporary checkouts, clones, extractions or work
// directories makes them here and never under the system temp path, whose length is the user's (an account name, a long profile path) and has
// produced "Filename too long" in a checkout of the repository's deep evidence paths. The root is configurable (MO1308_P3_TEMP_ROOT) but must be
// short on Windows (MAX_TEMP_ROOT_LENGTH characters); the default is C:\tt on Windows and <os temp>/mo1308-p3 elsewhere. Each directory is <root>\<stream>-<n> (the first free n, made
// atomically), and every directory made is listed by tempRecord() so a campaign can record it in its evidence.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TEMP_ROOT_VARIABLE = 'MO1308_P3_TEMP_ROOT';
export const MAX_TEMP_ROOT_LENGTH = 24;
const made = [];

export function tempBase({ env = process.env, platform = process.platform } = {}) {
  const configured = env[TEMP_ROOT_VARIABLE];
  const base = configured ? path.resolve(configured) : platform === 'win32' ? 'C:\\tt' : path.join(os.tmpdir(), 'mo1308-p3');
  if (platform === 'win32' && base.length > MAX_TEMP_ROOT_LENGTH) throw new Error(`the temporary root ${base} is ${base.length} characters; at most ${MAX_TEMP_ROOT_LENGTH} (set ${TEMP_ROOT_VARIABLE} to a short path)`);
  return base;
}

// Makes <root>\<stream>-<n> (n = the first free counter) and returns it. `stream` is a short lower-case id such as 3a, 3b, 3c, 3d, or p3.
export function makeTemp(stream, options = {}) {
  if (!/^[a-z0-9]{1,6}$/u.test(stream)) throw new Error(`invalid temporary stream id ${JSON.stringify(stream)}`);
  const base = tempBase(options);
  fs.mkdirSync(base, { recursive: true });
  for (let counter = 1; counter < 1_000_000; counter += 1) {
    const directory = path.join(base, `${stream}-${counter}`);
    try {
      fs.mkdirSync(directory);
    } catch (error) {
      if (error?.code === 'EEXIST') continue;
      throw error;
    }
    made.push(directory);
    return directory;
  }
  throw new Error(`no free temporary directory under ${base}`);
}

// Removes a directory this module made (never anything else, never through a link).
export function removeTemp(directory) {
  const resolved = path.resolve(directory);
  if (!made.includes(resolved)) throw new Error(`${directory} was not made by makeTemp`);
  fs.rmSync(resolved, { recursive: true, force: true });
}

export const removeAllTemp = () => { for (const directory of made.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); };

// The record a campaign puts in its evidence: where temporary directories go and which were made.
export const tempRecord = (options = {}) => ({ variable: TEMP_ROOT_VARIABLE, base: tempBase(options), maxLength: MAX_TEMP_ROOT_LENGTH, directories: [...made], longestPathLength: Math.max(0, ...made.map((directory) => directory.length)) });
