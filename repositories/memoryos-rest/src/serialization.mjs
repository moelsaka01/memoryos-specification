/** Transport/document serialization only. Normative SDK byte arrays stay opaque. */
export function J(value) {
  const active = new Set();
  function visit(item) {
    if (item === null || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'string') {
      if (!item.isWellFormed()) throw new TypeError('Invalid transport string');
      return JSON.stringify(item);
    }
    if (typeof item === 'number') {
      if (!Number.isSafeInteger(item) || Object.is(item, -0)) throw new TypeError('Invalid transport number');
      return String(item);
    }
    if (typeof item !== 'object' || active.has(item)) throw new TypeError('Invalid transport value');
    const prototype = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && prototype !== null && prototype !== Object.prototype) {
      throw new TypeError('Invalid transport object');
    }
    active.add(item);
    let text;
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length || Object.keys(item).some((key, index) => key !== String(index))) throw new TypeError('Invalid transport array');
      text = '[' + item.map(visit).join(',') + ']';
    } else {
      text = '{' + Object.keys(item).sort().map((key) => visit(key) + ':' + visit(item[key])).join(',') + '}';
    }
    active.delete(item);
    return text;
  }
  return visit(value);
}

export const jsonBytes = (value) => Buffer.from(J(value), 'utf8');
