// MO-1308 Phase 3A (platform-neutral part): the case table. The cases implemented here run unchanged on any host and on the
// Windows reference host. Every other 3A case needs a Windows API or a Windows-only harness and is declared host-only with the
// Step 3 harness that will implement it; a rehearsal skips them visibly and a certifying generation refuses every skip.
import { makeEnv } from './env.mjs';
import { cliCases } from './cases-cli.mjs';
import { boundaryCases } from './cases-boundary.mjs';
import { detCases } from './cases-det.mjs';
import { limitCases } from './cases-limits.mjs';
import { hostCases } from './cases-host.mjs';
import { ntfsCases } from './cases-ntfs.mjs';
import { pathCases } from './cases-paths.mjs';
import { pathCases2 } from './cases-paths2.mjs';
import { concCases } from './cases-conc.mjs';
import { swapCases } from './cases-swap.mjs';
import { killCases } from './cases-kill.mjs';
import { purgeHostCases } from './cases-purgehost.mjs';
import { resourceCases } from './cases-res.mjs';
import { transportCases } from './cases-transport.mjs';
import { ceilingCases } from './cases-ceiling.mjs';

export { makeEnv };
export const impls = { ...cliCases, ...detCases, ...boundaryCases, ...limitCases, ...hostCases, ...ntfsCases, ...pathCases, ...pathCases2, ...concCases, ...swapCases, ...killCases, ...purgeHostCases, ...resourceCases, ...transportCases, ...ceilingCases };

// Step 3 harness items (the Windows-only code that does not exist yet).
export const STEP3 = Object.freeze({
  HOST_CAPTURE: 'Windows host capture (build, NTFS volume, Node executable hash, AV/Defender, LongPathsEnabled, 8.3 setting, symlink privilege, load sample)',
  GATE_INPUT: 'a gate input bound at seal time (the A3.2 receipt, the sealed tool inventory and harness review), not a program',
  JUNCTIONS: 'junction and reparse-point planting, name-form and path-form probes (8.3, ADS, reserved names, UNC, \\\\?\\), ACL and read-only attribute setup',
  FILE_INDEX: 'NTFS file index reader (hard-link and file-identity audit)',
  SHARING: 'exclusive-handle holder and delete-pending probe (sharing violations, staging names held open)',
  FANOUT: 'process-tree launcher and handle observer (10 appenders and readers, tombstoners, exporters, repeated census runs)',
  SWAPPER: 'junction swapper racing real operations at the commit points',
  KILL: 'process killer at staged points, console and Ctrl-C/Ctrl-Break launcher, closed stdio',
  PURGE_HOST: 'purge on the host with a member held open (sharing) and the lifecycle observations that need the process harness',
  OBSERVER: 'fault-injection preload and process/socket/handle/memory observer',
  TRANSPORT: 'console code page, headless launch, closed pipe and slow reader, time-zone and clock change, hostile NODE_OPTIONS',
  CEILING: 'ceiling generator for 100,000 entries and the second (JC) segment runner',
});

const declare = (reason, ids) => Object.fromEntries(ids.map((id) => [`3A-${id}`, `HOST_ONLY: ${STEP3[reason]}`]));
// A case implemented by the Windows harness leaves this table; what remains is still to be written.
const declared = {
  ...declare('HOST_CAPTURE', ['A1', 'A2', 'A6', 'A7']),
  ...declare('GATE_INPUT', ['A4', 'A5']),
  ...declare('FILE_INDEX', ['C6', 'E3']),
  ...declare('JUNCTIONS', ['D1', 'D2', 'D3', 'D4', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'E1', 'E2', 'E7']),
  ...declare('SHARING', ['E4', 'E5', 'E6']),
  ...declare('FANOUT', ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']),
  ...declare('SWAPPER', ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']),
  ...declare('KILL', ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10']),
  ...declare('PURGE_HOST', ['I1', 'I2', 'I3', 'I4', 'I5', 'I6']),
  ...declare('OBSERVER', ['K1', 'K2', 'K3', 'K4']),
  ...declare('TRANSPORT', ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']),
  ...declare('CEILING', ['JC1', 'JC2', 'JC3', 'JC4', 'JC5', 'JC6', 'JC7', 'JC8', 'JC9', 'JC10']),
};
export const hostOnly = Object.fromEntries(Object.entries(declared).filter(([id]) => impls[id] === undefined));
