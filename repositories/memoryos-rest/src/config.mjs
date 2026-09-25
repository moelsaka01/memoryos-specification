import { createPrivateKey, X509Certificate, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { isIPv4 } from 'node:net';
import { readChecked } from './integrity.mjs';
import { parseJSON } from './json.mjs';
import { api, validate } from './contracts.mjs';
import { reject } from './errors.mjs';

export function validateBinding(mode, address, interfaces = networkInterfaces()) {
  if (mode !== 'local' && mode !== 'remote') reject('REQUEST_SCHEMA');
  if (!isIPv4(address)) reject('REQUEST_SCHEMA');
  if (mode === 'local') { if (address !== '127.0.0.1') reject('FORBIDDEN'); return; }
  const octets = address.split('.').map(Number);
  if (!(octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168))) reject('FORBIDDEN');
  const item = Object.values(interfaces).flat().find(x => x.family === 'IPv4' && !x.internal && x.address === address);
  if (!item || !item.cidr) reject('FORBIDDEN');
  const prefix = Number(item.cidr.split('/')[1]);
  if (!Number.isInteger(prefix) || prefix < 1 || prefix > 30) reject('FORBIDDEN');
  const number = octets.reduce((n,x) => (n * 256 + x) >>> 0, 0), mask = (0xffffffff << (32 - prefix)) >>> 0;
  const host = (number & (~mask >>> 0)) >>> 0;
  if (host === 0 || host === (~mask >>> 0)) reject('FORBIDDEN');
}
export function loadConfig(path) {
  const value = parseJSON(readChecked(path, 8192), {bytes:8192,depth:2,members:7,nodes:8,keyCodeUnits:128,stringCodeUnits:8192,totalStringCodeUnits:8192});
  if (!validate('Config', value)) reject('REQUEST_SCHEMA');
  const mode = value.mode ?? 'local', bindAddress = value.bindAddress ?? '127.0.0.1', port = value.port ?? 13050;
  if (mode === 'remote' && !Object.hasOwn(value,'bindAddress')) reject('REQUEST_SCHEMA');
  validateBinding(mode, bindAddress);
  const tokenText = readChecked(value.tokenFile, 64);
  if (tokenText.length !== 64 || !/^[0-9a-f]{64}$/u.test(tokenText.toString('ascii')) || tokenText.some(b => b > 127)) reject('UNAUTHENTICATED');
  const cert = readChecked(value.certificateFile, 16384), key = readChecked(value.privateKeyFile, 4096);
  const pem = cert.toString('ascii'), certificates = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu) ?? [];
  if (cert.some(b => b > 127) || certificates.length < 1 || certificates.length > 4
      || pem.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu,'').trim() !== '') reject('REQUEST_SCHEMA');
  const parsed = certificates.map(x => new X509Certificate(x));
  for (const item of parsed) if (!(Date.now() >= Date.parse(item.validFrom) && Date.now() < Date.parse(item.validTo))) reject('REQUEST_SCHEMA');
  const keyText = key.toString('ascii');
  if (key.some(b => b > 127) || !/^-----BEGIN PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END PRIVATE KEY-----\s*$/u.test(keyText)) reject('REQUEST_SCHEMA');
  const privateKey = createPrivateKey({key,format:'pem',type:'pkcs8'});
  if (privateKey.asymmetricKeyType !== 'ec' || privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
      || !parsed[0].checkPrivateKey(privateKey) || parsed[0].checkIP(bindAddress) !== bindAddress) reject('REQUEST_SCHEMA');
  return {mode,bindAddress,port,token:Buffer.from(tokenText.toString('ascii'),'hex'),cert,key};
}
export function authenticate(header, token) {
  if (typeof header !== 'string' || !new RegExp(api.headers.values.authorizationPattern,'u').test(header)) return false;
  return timingSafeEqual(Buffer.from(header.slice(7),'hex'),token);
}
export function rejectEnvironment() {
  const forbidden = /^(NODE_|OPENSSL_|SSL_CERT_|UV_|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NO_PROXY$)/iu;
  if (process.execArgv.length || Object.keys(process.env).some(k => forbidden.test(k))) reject('FORBIDDEN');
}
