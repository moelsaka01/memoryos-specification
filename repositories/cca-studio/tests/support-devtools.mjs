// MO-1309 Phase 2A test support: a minimal Chrome DevTools Protocol client built only on Node built-ins
// (child_process, http, fs, os, path and the global WebSocket). No browser-automation package is used or added anywhere.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const CANDIDATES = [
  process.env.MO1309_BROWSER,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
export const findBrowser = () => CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;

export async function launchBrowser() {
  const executable = findBrowser();
  if (executable === null) throw new Error("No Chromium-family browser found (set MO1309_BROWSER).");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-browser-"));
  const child = spawn(executable, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-extensions", "--no-first-run",
    "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"], detached: process.platform !== "win32" });
  const endpoint = await new Promise((resolve, reject) => {
    let text = "";
    const timer = global.setTimeout(() => reject(new Error("browser start timeout")), 30000);
    child.stderr.on("data", (chunk) => {
      text += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/u.exec(text);
      if (match) { global.clearTimeout(timer); resolve(match[1]); }
    });
    child.on("exit", () => reject(new Error("browser exited early")));
  });
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let nextId = 0;
  const pending = new Map();
  const listeners = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`)); else entry.resolve(message.result);
    } else for (const listener of listeners) listener(message);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    nextId += 1;
    pending.set(nextId, { resolve, reject, method });
    socket.send(JSON.stringify({ id: nextId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  async function openPage({ width = 1280, height = 900, colorScheme = null, reducedMotion = false, forcedColors = false } = {}) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const call = (method, params) => send(method, params, sessionId);
    const requests = [];
    const messages = [];
    listeners.push((message) => {
      if (message.sessionId !== sessionId) return;
      const { method, params } = message;
      if (method === "Network.requestWillBeSent") requests.push(params.request.url);
      else if (method === "Runtime.exceptionThrown") messages.push({ kind: "exception", text: params.exceptionDetails.text + (params.exceptionDetails.exception?.description ?? "") });
      else if (method === "Runtime.consoleAPICalled") messages.push({ kind: `console.${params.type}`, text: params.args.map((a) => a.value ?? a.description ?? "").join(" ") });
      else if (method === "Log.entryAdded") messages.push({ kind: `log.${params.entry.level}`, text: params.entry.text, source: params.entry.source });
    });
    for (const domain of ["Page", "Runtime", "Network", "Log", "Accessibility", "DOM"]) await call(`${domain}.enable`);
    const features = [];
    if (colorScheme) features.push({ name: "prefers-color-scheme", value: colorScheme });
    if (reducedMotion) features.push({ name: "prefers-reduced-motion", value: "reduce" });
    if (forcedColors) features.push({ name: "forced-colors", value: "active" });
    if (features.length > 0) await call("Emulation.setEmulatedMedia", { features });
    const resize = (w, h = height) => call("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await resize(width);

    const evaluate = async (expression) => {
      const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(`evaluate failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
      return result.result.value;
    };
    const navigate = async (url) => {
      const loaded = new Promise((resolve) => { const l = (m) => { if (m.sessionId === sessionId && m.method === "Page.loadEventFired") { listeners.splice(listeners.indexOf(l), 1); resolve(); } }; listeners.push(l); });
      await call("Page.navigate", { url });
      await loaded;
    };
    const key = async (name, code, vk, text) => {
      await call("Input.dispatchKeyEvent", { type: "keyDown", key: name, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) });
      await call("Input.dispatchKeyEvent", { type: "keyUp", key: name, code, windowsVirtualKeyCode: vk });
    };
    const keys = {
      tab: () => key("Tab", "Tab", 9),
      enter: () => key("Enter", "Enter", 13, "\r"),
      space: () => key(" ", "Space", 32, " "),
    };
    const axTree = async () => (await call("Accessibility.getFullAXTree")).nodes;
    const close = async () => { await send("Target.closeTarget", { targetId }); };
    return { call, evaluate, navigate, keys, resize, axTree, requests, messages, close };
  }

  const close = async () => {
    try { socket.close(); } catch { /* already closed */ }
    killTree(child);
    await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.on("exit", resolve); });
    removeProfile(profile);
  };
  return { openPage, close, executable };
}

// Phase 3 harness fix (HARNESS_DEFECT): SIGKILL stops only the main browser process, so helper processes may still be writing
// the profile directory when it is removed (ENOTEMPTY). Removal is retried with a delay; a persistent failure still throws.
// Phase 3 harness fix: the browser spawns helper processes that outlive a kill of the main process and keep writing the profile.
// The whole tree is killed (process group on POSIX, taskkill /T on Windows).
export function killTree(child) {
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-child.pid, "SIGKILL");
  } catch { child.kill("SIGKILL"); }
}

export function removeProfile(directory, remove = fs.rmSync) {
  remove(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}

// A static HTTP host (no security headers) serving fixed files; the page must behave identically here and from file:// (DB25).
export function serveStatic(files) {
  const server = http.createServer((request, response) => {
    const body = files.get(new URL(request.url, "http://x").pathname);
    if (body === undefined) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(body);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((done) => server.close(done)),
  })));
}
