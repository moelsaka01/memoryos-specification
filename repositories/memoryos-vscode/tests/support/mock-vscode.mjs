import { EventEmitter as NodeEventEmitter } from "node:events";
import { isAbsolute, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

class MockDisposable {
  #callback;
  #disposed = false;

  constructor(callback = () => undefined) { this.#callback = callback; }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#callback();
  }
  static from(...values) {
    return new MockDisposable(() => {
      for (const value of values.reverse()) value?.dispose?.();
    });
  }
}

class MockEventEmitter {
  #events = new NodeEventEmitter();
  #disposed = false;
  event = (listener, thisArg, disposables) => {
    if (this.#disposed) return new MockDisposable();
    const bound = thisArg === undefined ? listener : listener.bind(thisArg);
    this.#events.on("event", bound);
    const disposable = new MockDisposable(() => this.#events.off("event", bound));
    disposables?.push(disposable);
    return disposable;
  };
  fire(value) { if (!this.#disposed) this.#events.emit("event", value); }
  dispose() { this.#disposed = true; this.#events.removeAllListeners(); }
}

class MockCancellationTokenSource {
  #emitter = new MockEventEmitter();
  #cancelled = false;
  #disposed = false;
  token;

  constructor() {
    const source = this;
    this.token = Object.freeze({
      get isCancellationRequested() { return source.#cancelled; },
      onCancellationRequested: (...args) => source.#emitter.event(...args),
    });
  }
  cancel() {
    if (this.#cancelled || this.#disposed) return;
    this.#cancelled = true;
    this.#emitter.fire(undefined);
  }
  dispose() { this.#disposed = true; this.#emitter.dispose(); }
}

function normalizeUriPath(value) {
  const text = String(value).replaceAll("\\", "/");
  return text.startsWith("/") ? text : `/${text}`;
}

class MockUri {
  constructor(scheme, authority, path, query = "", fragment = "", fsPath) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = path;
    this.query = query;
    this.fragment = fragment;
    this.fsPath = fsPath ?? (scheme === "file" ? path : "");
    Object.freeze(this);
  }
  static file(path) {
    const absolute = isAbsolute(path) ? resolve(path) : resolve(path);
    const url = pathToFileURL(absolute);
    return new MockUri("file", url.host, decodeURIComponent(url.pathname), "", "", absolute);
  }
  static from(value) {
    if (value instanceof MockUri) return value;
    return new MockUri(
      String(value.scheme ?? ""),
      String(value.authority ?? ""),
      normalizeUriPath(value.path ?? ""),
      String(value.query ?? ""),
      String(value.fragment ?? ""),
      value.fsPath === undefined ? undefined : String(value.fsPath),
    );
  }
  static parse(value) {
    const match = /^([A-Za-z][A-Za-z0-9+.-]*):(?:(?:\/\/)([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/u.exec(String(value));
    if (match === null) throw new TypeError("Invalid mock URI.");
    const [, scheme, authority = "", encodedPath = "", query = "", fragment = ""] = match;
    const path = decodeURIComponent(encodedPath || "/");
    const fsPath = scheme === "file"
      ? (process.platform === "win32" && /^\/[A-Za-z]:/u.test(path) ? path.slice(1).replaceAll("/", sep) : path)
      : "";
    return new MockUri(scheme, authority, path, query, fragment, fsPath);
  }
  static joinPath(base, ...parts) {
    return base.with({ path: `${base.path.replace(/\/$/u, "")}/${parts.map(String).join("/")}` });
  }
  with(changes) {
    return new MockUri(
      changes.scheme ?? this.scheme,
      changes.authority ?? this.authority,
      changes.path ?? this.path,
      changes.query ?? this.query,
      changes.fragment ?? this.fragment,
      changes.fsPath ?? this.fsPath,
    );
  }
  toString(skipEncoding = false) {
    const authority = this.authority.length === 0 ? "" : `//${this.authority}`;
    const path = skipEncoding
      ? this.path
      : this.path.split("/").map((part) => encodeURIComponent(part)).join("/");
    const query = this.query.length === 0 ? "" : `?${this.query}`;
    const fragment = this.fragment.length === 0 ? "" : `#${this.fragment}`;
    return `${this.scheme}:${authority}${path}${query}${fragment}`;
  }
  toJSON() {
    return {
      authority: this.authority,
      fragment: this.fragment,
      path: this.path,
      query: this.query,
      scheme: this.scheme,
    };
  }
}

const TreeItemCollapsibleState = Object.freeze({ None: 0, Collapsed: 1, Expanded: 2 });
const StatusBarAlignment = Object.freeze({ Left: 1, Right: 2 });
const ProgressLocation = Object.freeze({ SourceControl: 1, Window: 10, Notification: 15 });
const ViewColumn = Object.freeze({ Active: -1, Beside: -2, One: 1, Two: 2 });
const FileType = Object.freeze({ Unknown: 0, File: 1, Directory: 2, SymbolicLink: 64 });
const UIKind = Object.freeze({ Desktop: 1, Web: 2 });

class MockTreeItem {
  constructor(labelOrResourceUri, collapsibleState = TreeItemCollapsibleState.None) {
    if (labelOrResourceUri instanceof MockUri) this.resourceUri = labelOrResourceUri;
    else this.label = labelOrResourceUri;
    this.collapsibleState = collapsibleState;
  }
}
class MockThemeIcon {
  constructor(id, color) { this.id = id; this.color = color; Object.freeze(this); }
}
class MockThemeColor {
  constructor(id) { this.id = id; Object.freeze(this); }
}
class MockMarkdownString {
  constructor(value = "", supportThemeIcons = false) {
    this.value = String(value);
    this.supportThemeIcons = supportThemeIcons;
    this.isTrusted = false;
    this.supportHtml = false;
  }
  appendText(value) { this.value += String(value); return this; }
  appendMarkdown(value) { this.value += String(value); return this; }
}
class MockTextDocument {
  #text;
  constructor(uri, options = {}) {
    this.uri = uri;
    this.isDirty = options.isDirty === true;
    this.isUntitled = options.isUntitled === true || uri.scheme === "untitled";
    this.languageId = options.languageId ?? "json";
    this.fileName = uri.fsPath || uri.path;
    this.#text = String(options.text ?? "");
  }
  getText() { return this.#text; }
  setText(value) { this.#text = String(value); }
}

function makeStatusBarItem(current, id, alignment, priority) {
  const item = {
    alignment,
    command: undefined,
    disposed: false,
    id,
    name: undefined,
    priority,
    text: "",
    tooltip: undefined,
    visible: false,
    show() { this.visible = true; },
    hide() { this.visible = false; },
    dispose() { this.disposed = true; this.visible = false; },
  };
  current.statusBarItems.push(item);
  return item;
}

function makeOutputChannel(current, name) {
  const channel = {
    name,
    disposed: false,
    visible: false,
    lines: [],
    append(value) { this.lines.push({ kind: "append", value: String(value) }); },
    appendLine(value) { this.lines.push({ kind: "appendLine", value: String(value) }); },
    trace(value, ...args) { this.lines.push({ args, kind: "trace", value: String(value) }); },
    debug(value, ...args) { this.lines.push({ args, kind: "debug", value: String(value) }); },
    info(value, ...args) { this.lines.push({ args, kind: "info", value: String(value) }); },
    warn(value, ...args) { this.lines.push({ args, kind: "warn", value: String(value) }); },
    error(value, ...args) { this.lines.push({ args, kind: "error", value: String(value) }); },
    replace(value) { this.lines = [{ kind: "replace", value: String(value) }]; },
    clear() { this.lines = []; },
    show() { this.visible = true; },
    hide() { this.visible = false; },
    dispose() { this.disposed = true; this.visible = false; },
  };
  current.outputChannels.push(channel);
  return channel;
}

function makeTreeView(current, id, options) {
  const visibility = new MockEventEmitter();
  const selection = new MockEventEmitter();
  const view = {
    id,
    disposed: false,
    visible: true,
    selection: [],
    treeDataProvider: options.treeDataProvider,
    onDidChangeVisibility: visibility.event,
    onDidChangeSelection: selection.event,
    async reveal(element, revealOptions) {
      current.treeReveals.push({ element, id, options: revealOptions });
    },
    dispose() {
      this.disposed = true;
      visibility.dispose();
      selection.dispose();
      current.treeViews.delete(id);
    },
  };
  current.treeViews.set(id, view);
  return view;
}

function defaultState(options = {}) {
  return {
    activeTextEditor: options.activeTextEditor,
    commandCalls: [],
    commands: new Map(),
    documents: new Map(),
    errorMessages: [],
    informationMessages: [],
    inputBoxCalls: [],
    inputBoxQueue: [],
    isTrusted: options.isTrusted ?? true,
    openDialogCalls: [],
    openDialogQueue: [],
    openedExternalUris: [],
    openedTextDocuments: [],
    outputChannels: [],
    progressCalls: [],
    progressQueue: [],
    quickPickCalls: [],
    quickPickQueue: [],
    remoteName: options.remoteName,
    shownTextDocuments: [],
    statusBarItems: [],
    textProviders: new Map(),
    treeProviders: new Map(),
    textDocumentChanges: new MockEventEmitter(),
    treeReveals: [],
    treeViews: new Map(),
    warningMessages: [],
    workspaceFolders: options.workspaceFolders ?? [],
    uiKind: options.uiKind ?? UIKind.Desktop,
  };
}

let state = defaultState();

export function resetMockVSCode(options = {}) {
  for (const channel of state.outputChannels) channel.dispose();
  for (const item of state.statusBarItems) item.dispose();
  for (const view of state.treeViews.values()) view.dispose();
  state = defaultState(options);
  return state;
}
export function getMockVSCodeState() { return state; }
export function queueOpenDialog(result) { state.openDialogQueue.push(result); }
export function queueQuickPick(result) { state.quickPickQueue.push(result); }
export function queueInputBox(result) { state.inputBoxQueue.push(result); }
export function queueProgressControl(control) { state.progressQueue.push(control); }
export function registerMockDocument(uri, options = {}) {
  const normalized = uri instanceof MockUri ? uri : MockUri.parse(String(uri));
  const document = new MockTextDocument(normalized, options);
  state.documents.set(normalized.toString(), document);
  return document;
}
export function setActiveMockDocument(uri, options = {}) {
  const document = registerMockDocument(uri, options);
  state.activeTextEditor = { document, viewColumn: ViewColumn.One };
  return document;
}

function memoryMemento() {
  const values = new Map();
  return {
    get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    keys() { return [...values.keys()]; },
    async update(key, value) {
      if (value === undefined) values.delete(key);
      else values.set(key, value);
    },
  };
}
export function createMockExtensionContext(extensionPath) {
  return {
    extensionPath,
    extensionUri: MockUri.file(extensionPath),
    subscriptions: [],
    workspaceState: memoryMemento(),
    globalState: memoryMemento(),
  };
}

function resolveQueued(queue, offered, options) {
  if (queue.length === 0) return undefined;
  const choice = queue.shift();
  if (typeof choice === "function") return choice(offered, options);
  if (typeof choice === "number") return offered[choice];
  if (typeof choice === "string") {
    return offered.find((item) => item === choice || item?.label === choice || item?.value === choice);
  }
  return choice;
}

export const commands = Object.freeze({
  registerCommand(id, handler, thisArg) {
    if (state.commands.has(id)) throw new Error(`Duplicate command registration: ${id}`);
    const bound = thisArg === undefined ? handler : handler.bind(thisArg);
    state.commands.set(id, bound);
    return new MockDisposable(() => state.commands.delete(id));
  },
  async executeCommand(id, ...args) {
    state.commandCalls.push({ args, id });
    const handler = state.commands.get(id);
    return handler === undefined ? undefined : handler(...args);
  },
  getCommands() { return Promise.resolve([...state.commands.keys()]); },
});

export const workspace = {};
Object.defineProperties(workspace, {
  isTrusted: { enumerable: true, get: () => state.isTrusted },
  workspaceFolders: { enumerable: true, get: () => state.workspaceFolders },
  textDocuments: { enumerable: true, get: () => [...state.documents.values()] },
});
Object.assign(workspace, {
  onDidChangeTextDocument(listener, thisArg, disposables) {
    return state.textDocumentChanges.event(listener, thisArg, disposables);
  },
  registerTextDocumentContentProvider(scheme, provider) {
    if (state.textProviders.has(scheme)) throw new Error(`Duplicate content provider: ${scheme}`);
    state.textProviders.set(scheme, provider);
    return new MockDisposable(() => state.textProviders.delete(scheme));
  },
  async openTextDocument(value) {
    const uri = value instanceof MockUri ? value : MockUri.parse(String(value));
    let document = state.documents.get(uri.toString());
    if (document === undefined) {
      const provider = state.textProviders.get(uri.scheme);
      const text = provider === undefined ? "" : await provider.provideTextDocumentContent(uri, CancellationToken.None);
      document = new MockTextDocument(uri, { text });
      state.documents.set(uri.toString(), document);
    }
    state.openedTextDocuments.push(document);
    return document;
  },
  getWorkspaceFolder(uri) {
    return state.workspaceFolders.find(({ uri: root }) => uri.fsPath.startsWith(root.fsPath));
  },
  createFileSystemWatcher() {
    throw new Error("FileSystemWatcher is forbidden by the MO-1303 contract.");
  },
});

export const window = {};
Object.defineProperties(window, {
  activeTextEditor: { enumerable: true, get: () => state.activeTextEditor },
  visibleTextEditors: { enumerable: true, get: () => (state.activeTextEditor ? [state.activeTextEditor] : []) },
});
Object.assign(window, {
  registerTreeDataProvider(id, provider) {
    if (state.treeProviders.has(id)) throw new Error(`Duplicate tree provider: ${id}`);
    state.treeProviders.set(id, provider);
    return new MockDisposable(() => state.treeProviders.delete(id));
  },
  async showOpenDialog(options) {
    state.openDialogCalls.push(options);
    return resolveQueued(state.openDialogQueue, [], options);
  },
  async showQuickPick(items, options, token) {
    const offered = await items;
    state.quickPickCalls.push({ items: offered, options, token });
    return resolveQueued(state.quickPickQueue, offered, options);
  },
  async showInputBox(options, token) {
    state.inputBoxCalls.push({ options, token });
    return resolveQueued(state.inputBoxQueue, [], options);
  },
  async withProgress(options, task) {
    const source = new MockCancellationTokenSource();
    const reports = [];
    const entry = { options, reports, source };
    state.progressCalls.push(entry);
    const control = state.progressQueue.shift();
    if (control === "cancel") queueMicrotask(() => source.cancel());
    else if (typeof control === "function") queueMicrotask(() => control(source, entry));
    try {
      return await task({ report(value) { reports.push(value); } }, source.token);
    } finally {
      source.dispose();
    }
  },
  createTreeView(id, options) { return makeTreeView(state, id, options); },
  createStatusBarItem(...args) {
    if (typeof args[0] === "string") return makeStatusBarItem(state, args[0], args[1], args[2]);
    return makeStatusBarItem(state, undefined, args[0], args[1]);
  },
  createOutputChannel(name) { return makeOutputChannel(state, name); },
  async showTextDocument(document, options) {
    const editor = { document, options, viewColumn: options?.viewColumn ?? ViewColumn.One };
    state.activeTextEditor = editor;
    state.shownTextDocuments.push(editor);
    return editor;
  },
  async showInformationMessage(message, ...items) {
    state.informationMessages.push({ items, message: String(message) });
    return items[0];
  },
  async showWarningMessage(message, ...items) {
    state.warningMessages.push({ items, message: String(message) });
    return items[0];
  },
  async showErrorMessage(message, ...items) {
    state.errorMessages.push({ items, message: String(message) });
    return items[0];
  },
  createWebviewPanel() { throw new Error("Webviews are forbidden by the MO-1303 contract."); },
});

export const env = {};
Object.defineProperties(env, {
  remoteName: { enumerable: true, get: () => state.remoteName },
  uiKind: { enumerable: true, get: () => state.uiKind },
});
Object.assign(env, {
  async openExternal(uri) { state.openedExternalUris.push(uri); return true; },
});
export const languages = Object.freeze({
  createDiagnosticCollection() {
    throw new Error("DiagnosticCollection is forbidden by the MO-1303 contract.");
  },
});
export const CancellationToken = Object.freeze({
  None: Object.freeze({ isCancellationRequested: false, onCancellationRequested: () => new MockDisposable() }),
  Cancelled: Object.freeze({
    isCancellationRequested: true,
    onCancellationRequested(listener) { queueMicrotask(listener); return new MockDisposable(); },
  }),
});

export {
  FileType,
  MockCancellationTokenSource as CancellationTokenSource,
  MockDisposable as Disposable,
  MockEventEmitter as EventEmitter,
  MockMarkdownString as MarkdownString,
  MockTextDocument,
  MockThemeColor as ThemeColor,
  MockThemeIcon as ThemeIcon,
  MockTreeItem as TreeItem,
  MockUri as Uri,
  ProgressLocation,
  StatusBarAlignment,
  TreeItemCollapsibleState,
  UIKind,
  ViewColumn,
};
