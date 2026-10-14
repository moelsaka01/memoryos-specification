// Release-media helper: a minimal MCP client over stdio. It starts the released MemoryOS MCP server (the installed package, pinned Node),
// asks it for its tool list and calls one read-only tool, and prints what the SERVER answered (names, flags, identity fields).
//   node tools/media/mcp-call.mjs PATH_TO_memoryos-mcp.mjs
import { spawn } from 'node:child_process';

const server = process.argv[2];
if (!server) { console.error('usage: mcp-call.mjs PATH_TO_memoryos-mcp.mjs'); process.exit(2); }
const env = { ...process.env };
delete env.NODE_OPTIONS;
const child = spawn(process.execPath, [server], { stdio: ['pipe', 'pipe', 'pipe'], env });
const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };
const pending = new Map();
let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  let lf;
  while ((lf = buffer.indexOf('\n')) >= 0) {
    const message = JSON.parse(buffer.slice(0, lf));
    buffer = buffer.slice(lf + 1);
    pending.get(message.id)?.(message);
  }
});
let stderr = '';
child.stderr.on('data', (d) => { stderr += d; });
let nextId = 1;
const request = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  const timer = setTimeout(() => reject(new Error('no answer from the server')), 30000);
  pending.set(id, (m) => { clearTimeout(timer); resolve(m); });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params: { _meta: meta, ...params } })}\n`);
});

try {
  const listed = await request('tools/list');
  const info = listed.result._meta['io.modelcontextprotocol/serverInfo'];
  console.log(`server   ${info.name} ${info.version}   protocol 2026-07-28   node ${process.version}`);
  console.log(`tools/list answered: ${listed.result.tools.length} tools`);
  for (const tool of listed.result.tools) console.log(`  ${tool.name.padEnd(36)} readOnly=${tool.annotations.readOnlyHint}`);
  const called = await request('tools/call', { name: 'memoryos_contract_identities', arguments: {} });
  const identities = called.result.structuredContent?.identities ?? JSON.parse(called.result.content[0].text).identities;
  console.log('tools/call memoryos_contract_identities answered:');
  console.log(`  kind              ${identities.kind}`);
  console.log(`  evaluatorVersion  ${identities.evaluatorVersion}`);
  console.log(`  resourceProfile   ${identities.resourceProfile.identifier}`);
} catch (error) {
  console.error(`failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  child.stdin.end();
  setTimeout(() => child.kill(), 3000).unref();
}
