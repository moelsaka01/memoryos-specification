// MO-1308 Phase 3B: canonical USTAR archives, written two independent ways, and a reader. A canonical archive has entries sorted
// by path (UTF-16 code unit), mode 0644 or 0755, uid and gid 0, mtime 0, empty user and group names, and two zero blocks at the end,
// so equal closures give byte-identical archives. `writeTarA` fills a zeroed block at fixed offsets; `writeTarB` builds each
// header from padded text fields and computes the checksum by summing its bytes. Neither calls the other.
const BLOCK = 512;
const compare = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

function splitPath(path) {
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: '' };
  for (let index = path.lastIndexOf('/'); index > 0; index = path.lastIndexOf('/', index - 1)) {
    const prefix = path.slice(0, index);
    const name = path.slice(index + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { name, prefix };
  }
  throw new Error(`tar: ${path} does not fit a ustar header`);
}
const modeText = (mode) => (mode === '100755' ? '0000755' : '0000644');
const octal = (value, width) => value.toString(8).padStart(width - 1, '0');

// ---- A: fixed offsets in a zeroed block ----
export function writeTarA(entries) {
  const parts = [];
  for (const entry of [...entries].sort(compare)) {
    const header = Buffer.alloc(BLOCK);
    const { name, prefix } = splitPath(entry.path);
    header.write(name, 0, 'latin1');
    header.write(modeText(entry.mode), 100, 'latin1');
    header.write(octal(0, 8), 108, 'latin1');
    header.write(octal(0, 8), 116, 'latin1');
    header.write(octal(entry.bytes.length, 12), 124, 'latin1');
    header.write(octal(0, 12), 136, 'latin1');
    header.fill(0x20, 148, 156);
    header[156] = 0x30;
    header.write('ustar\0', 257, 'latin1');
    header.write('00', 263, 'latin1');
    header.write(octal(0, 8), 329, 'latin1');
    header.write(octal(0, 8), 337, 'latin1');
    header.write(prefix, 345, 'latin1');
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(`${octal(sum, 7)}\0`, 148, 'latin1');
    header[155] = 0x20;
    parts.push(header, entry.bytes, Buffer.alloc((BLOCK - (entry.bytes.length % BLOCK)) % BLOCK));
  }
  parts.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(parts);
}

// ---- B: text fields, padded, checksum by summation ----
export function writeTarB(entries) {
  const chunks = [];
  const pad = (text, width) => text + '\0'.repeat(width - text.length);
  for (const entry of entries.slice().sort(compare)) {
    const { name, prefix } = splitPath(entry.path);
    const size = entry.bytes.length;
    const fields = [
      pad(name, 100), modeText(entry.mode) + '\0', '0000000\0', '0000000\0', size.toString(8).padStart(11, '0') + '\0', '00000000000\0',
      '        ', '0', pad('', 100), 'ustar\0', '00', pad('', 32), pad('', 32), '0000000\0', '0000000\0', pad(prefix, 155), pad('', 12),
    ];
    let header = Buffer.from(fields.join(''), 'latin1');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    const text = checksum.toString(8).padStart(6, '0') + '\0 ';
    header = Buffer.concat([header.subarray(0, 148), Buffer.from(text, 'latin1'), header.subarray(156)]);
    if (header.length !== BLOCK) throw new Error('tar: header is not one block');
    chunks.push(header, entry.bytes);
    if (size % BLOCK !== 0) chunks.push(Buffer.alloc(BLOCK - (size % BLOCK)));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

// ---- reader: regular files only; pax headers contribute `path`; anything else is skipped ----
export function readTar(buffer) {
  const entries = [];
  let offset = 0;
  let paxPath = null;
  const text = (start, length) => buffer.toString('latin1', start, start + length).replace(/\0.*$/s, '');
  while (offset + BLOCK <= buffer.length) {
    const block = buffer.subarray(offset, offset + BLOCK);
    if (block.every((byte) => byte === 0)) break;
    const size = parseInt(text(offset + 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(block[156] === 0 ? 0x30 : block[156]);
    const dataStart = offset + BLOCK;
    const data = buffer.subarray(dataStart, dataStart + size);
    if (type === 'x') {
      const record = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(data.toString('utf8'));
      paxPath = record === null ? null : record[1];
    } else if (type === '0') {
      const prefix = text(offset + 345, 155);
      const name = paxPath ?? (prefix === '' ? text(offset, 100) : `${prefix}/${text(offset, 100)}`);
      const mode = parseInt(text(offset + 100, 8).trim() || '0', 8);
      entries.push({ path: name, mode: (mode & 0o111) !== 0 ? '100755' : '100644', bytes: Buffer.from(data) });
      paxPath = null;
    }
    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
  }
  return entries;
}
