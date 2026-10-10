// Imported first by every test file: idempotent, serial (--test-concurrency=1), and writes nothing tracked.
import { prepare } from '../scripts/prepare-tests.mjs';
export const prepared = await prepare();
