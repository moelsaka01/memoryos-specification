import { Server, ProtocolError, INVALID_PARAMS } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { catalog, discoveryResult, listingResult, names, PROTOCOL, SERVER_INFO, toolResult } from './contracts.mjs';
import { CANCELLED, Dispatcher, PUBLICATION_TOKEN } from './dispatcher.mjs';
import { contractIdentityPin, validateLaunch, verifyRuntime } from './integrity.mjs';
import { loadLimits } from './limits.mjs';
import { adapterError } from './errors.mjs';
import { BoundedStdioTransport } from './transport.mjs';

export async function startServer({ input = process.stdin, output = process.stdout, fatal = () => {}, onend = () => {} } = {}) {
  validateLaunch();
  const limits = await loadLimits();
  await verifyRuntime();
  const identities = await contractIdentityPin();
  const tools = catalog(identities);
  const dispatcher = new Dispatcher(limits, identities, undefined, fatal);
  const transport = new BoundedStdioTransport(input, output, limits, dispatcher, fatal);
  const handle = serveStdio(() => {
    const server = new Server(SERVER_INFO, { capabilities: { tools: { listChanged: false } }, supportedProtocolVersions: [PROTOCOL] });
    server.setRequestHandler('server/discover', discoveryResult);
    server.setRequestHandler('tools/list', () => listingResult(tools));
    server.setRequestHandler('tools/call', async (request, context) => {
      if (!names.includes(request.params.name)) throw new ProtocolError(INVALID_PARAMS, 'Unknown tool');
      const pending = dispatcher.call(request.params.name, request.params.arguments, context.mcpReq.id, context.mcpReq.signal);
      const generation = dispatcher.token(context.mcpReq.id);
      const product = await pending;
      // The SDK suppresses replies after its abort signal. This fallback is never published for cancellation.
      const result = toolResult(product === CANCELLED ? adapterError('MO1304_INTERNAL_FAILURE', 'cancelled') : product);
      if (generation !== undefined) result._meta = { ...result._meta, [PUBLICATION_TOKEN]: generation };
      return result;
    });
    server.onerror = () => {};
    return server;
  }, { legacy: 'reject', maxSubscriptions: 1, transport, onerror: () => {} });
  let closing;
  const close = () => closing ??= (async () => {
    let timer;
    try {
      await Promise.race([handle.close(), new Promise((_, reject) => {
        timer = setTimeout(() => { fatal('MO1304_SHUTDOWN_TIMEOUT'); reject(new Error('SHUTDOWN_TIMEOUT')); }, limits.shutdownMs);
      })]);
    } finally { clearTimeout(timer); }
  })();
  transport.onend = async () => { await close(); onend(); };
  return { close, limits };
}
