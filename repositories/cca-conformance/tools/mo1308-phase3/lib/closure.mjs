// MO-1308 Phase 3 shared library: static import closure of JavaScript modules (used by the candidate identity, and by 3B).
// The scanner tokenizes enough JavaScript to skip comments, strings, template literals and regular-expression literals,
// then reads import/export statements that name a module. Any dynamic import() with a non-literal argument is reported, never
// guessed. The tests cross-check the result against the set of modules Node actually loads.
import path from 'node:path';

const REGEX_PRECEDERS = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const isWordStart = (ch) => /[A-Za-z_$]/.test(ch);
const isWordPart = (ch) => /[A-Za-z0-9_$]/.test(ch);

export function tokenize(source) {
  const tokens = [];
  let i = 0;
  const n = source.length;
  const previous = () => tokens[tokens.length - 1];
  const regexAllowed = () => {
    const last = previous();
    if (last === undefined) return true;
    if (last.type === 'punct') return REGEX_PRECEDERS.has(last.value);
    if (last.type === 'word') return REGEX_KEYWORDS.has(last.value);
    return false;
  };
  const skipTemplate = () => {
    // i is just after the opening backtick; handles ${ ... } nesting by recursion through the tokenizer-lite below.
    while (i < n) {
      const ch = source[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') { i += 1; return; }
      if (ch === '$' && source[i + 1] === '{') {
        i += 2;
        let depth = 1;
        while (i < n && depth > 0) {
          const c = source[i];
          if (c === '`') { i += 1; skipTemplate(); continue; }
          if (c === '"' || c === "'") { skipString(c); continue; }
          if (c === '{') depth += 1;
          else if (c === '}') depth -= 1;
          i += 1;
        }
        continue;
      }
      i += 1;
    }
  };
  const skipString = (quote) => {
    i += 1;
    while (i < n && source[i] !== quote) i += source[i] === '\\' ? 2 : 1;
    i += 1;
  };
  while (i < n) {
    const ch = source[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch === '/' && source[i + 1] === '/') { while (i < n && source[i] !== '\n') i += 1; continue; }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const start = i;
      skipString(ch);
      tokens.push({ type: 'string', value: source.slice(start + 1, i - 1) });
      continue;
    }
    if (ch === '`') { i += 1; skipTemplate(); tokens.push({ type: 'template', value: '' }); continue; }
    if (ch === '/' && regexAllowed()) {
      i += 1;
      let inClass = false;
      while (i < n) {
        const c = source[i];
        if (c === '\\') { i += 2; continue; }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) break;
        i += 1;
      }
      i += 1;
      while (i < n && isWordPart(source[i])) i += 1;
      tokens.push({ type: 'regex', value: '' });
      continue;
    }
    if (isWordStart(ch)) {
      const start = i;
      while (i < n && isWordPart(source[i])) i += 1;
      tokens.push({ type: 'word', value: source.slice(start, i) });
      continue;
    }
    if (/[0-9]/.test(ch)) {
      while (i < n && /[0-9A-Za-z_.]/.test(source[i])) i += 1;
      tokens.push({ type: 'number', value: '' });
      continue;
    }
    tokens.push({ type: 'punct', value: ch });
    i += 1;
  }
  return tokens;
}

// Module specifiers named by a source text: {specifiers: string[], dynamicNonLiteral: number}.
export function scanImports(source) {
  const tokens = tokenize(source);
  const specifiers = [];
  let dynamicNonLiteral = 0;
  const at = (index) => tokens[index];
  const isPunct = (index, value) => at(index)?.type === 'punct' && at(index).value === value;
  const isWord = (index, value) => at(index)?.type === 'word' && at(index).value === value;
  // `import(input) { ... }` is a method named import, not a dynamic import: a call is never followed by a block.
  const isMethodDefinition = (openIndex) => {
    let depth = 0;
    for (let k = openIndex; k < tokens.length; k += 1) {
      if (isPunct(k, '(')) depth += 1;
      else if (isPunct(k, ')')) { depth -= 1; if (depth === 0) return isPunct(k + 1, '{'); }
    }
    return false;
  };
  const skipBraces = (index) => {
    let depth = 0;
    for (let k = index; k < tokens.length; k += 1) {
      if (isPunct(k, '{')) depth += 1;
      else if (isPunct(k, '}')) { depth -= 1; if (depth === 0) return k + 1; }
    }
    return tokens.length;
  };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'word') continue;
    const previous = tokens[index - 1];
    if (previous?.type === 'punct' && previous.value === '.') continue; // a property named import/export
    if (token.value === 'import') {
      if (isPunct(index + 1, '(')) {
        if (at(index + 2)?.type === 'string' && isPunct(index + 3, ')')) specifiers.push(at(index + 2).value);
        else if (!isMethodDefinition(index + 1)) dynamicNonLiteral += 1;
      } else if (isPunct(index + 1, '.')) {
        // import.meta
      } else if (at(index + 1)?.type === 'string') {
        specifiers.push(at(index + 1).value);
      } else {
        let k = index + 1;
        while (k < tokens.length && !isWord(k, 'from') && !isPunct(k, ';')) {
          k = isPunct(k, '{') ? skipBraces(k) : k + 1;
        }
        if (isWord(k, 'from') && at(k + 1)?.type === 'string') specifiers.push(at(k + 1).value);
      }
    } else if (token.value === 'export' && (isPunct(index + 1, '{') || isPunct(index + 1, '*'))) {
      let k = index + 1;
      if (isPunct(k, '{')) k = skipBraces(k);
      else while (k < tokens.length && !isWord(k, 'from') && !isPunct(k, ';')) k += 1;
      if (isWord(k, 'from') && at(k + 1)?.type === 'string') specifiers.push(at(k + 1).value);
    }
  }
  return { specifiers, dynamicNonLiteral };
}

// Closure over a file reader. `read(relativePosixPath)` returns the source text, or null when absent.
// Returns {files, builtins, externals, errors}; `files` and the lists are sorted by UTF-16 code unit.
export function importClosure(read, roots) {
  const files = new Set();
  const builtins = new Set();
  const externals = new Set();
  const errors = [];
  const visit = (relative) => {
    if (files.has(relative)) return;
    const source = read(relative);
    if (source === null) { errors.push({ file: relative, code: 'MISSING_FILE', specifier: null }); return; }
    files.add(relative);
    const { specifiers, dynamicNonLiteral } = scanImports(source);
    if (dynamicNonLiteral > 0) errors.push({ file: relative, code: 'DYNAMIC_IMPORT_NON_LITERAL', specifier: null });
    for (const specifier of specifiers) {
      if (specifier.startsWith('node:')) builtins.add(specifier);
      else if (specifier.startsWith('./') || specifier.startsWith('../')) {
        visit(path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier)));
      } else externals.add(specifier);
    }
  };
  for (const root of roots) visit(root);
  const sorted = (set) => [...set].sort();
  return { files: sorted(files), builtins: sorted(builtins), externals: sorted(externals), errors };
}
