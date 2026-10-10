"use strict";
/* MO-1309 dashboard page script (Freeze sections 5, 7, 8, 9). A classic, dependency-free script: it reads only the embedded */
/* data block, writes untrusted strings only as text, shows only registry wording, and issues no request of any kind. */
/* Under a host without a document it only exposes its pure filter, sort and page logic (used by the differential tests). */
(() => {
  const WORDING = null; /*@@WORDING@@*/
  const PAGE_SIZE = 100;
  const SHORTEN_AT = 72;
  const DATA_ID = "memoryos-dashboard-data";

  /* ---- Pure logic: the same semantics as the MO-1308 query for record kind, subject and retention (DB12) ---- */
  const tombstoneTargets = (entries) => {
    const targets = new Map();
    for (const entry of entries) if (entry.entryType === "RECORD" && entry.tombstoneIndex !== null) targets.set(entry.tombstoneIndex, entry);
    return targets;
  };
  const targetOf = (entry, targets) => (entry.entryType === "RECORD" ? entry : (targets.get(entry.index) ?? null));
  const matchesFilter = (entry, filter, targets) => {
    const target = targetOf(entry, targets); /* a tombstone matches on its target's kind and subjects */
    if (filter.recordKinds.length > 0 && (target === null || !filter.recordKinds.includes(target.recordKind))) return false;
    if (filter.subject !== null && (target === null || !target.subjects.some((s) => s.type === filter.subject.type && s.value === filter.subject.value))) return false;
    const purged = entry.entryType === "TOMBSTONE" || entry.tombstoneIndex !== null;
    if (filter.retention !== "ANY" && (filter.retention === "PURGED") !== purged) return false;
    if (filter.decisionConsistency !== null && entry.decisionConsistency !== filter.decisionConsistency) return false;
    return true;
  };
  const filterEntries = (entries, filter) => {
    const targets = tombstoneTargets(entries);
    return entries.filter((entry) => matchesFilter(entry, filter, targets));
  };
  const orderEntries = (entries, order) => (order === "DESCENDING" ? [...entries].reverse() : [...entries]);
  const pageOf = (entries, requested) => {
    const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    const page = Math.min(Math.max(1, requested), pages);
    return { page, pages, total: entries.length, items: entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
  };
  const NO_FILTER = Object.freeze({ recordKinds: Object.freeze([]), subject: null, retention: "ANY", decisionConsistency: null });

  if (typeof document === "undefined") {
    globalThis.MemoryOSDashboardLogic = Object.freeze({ PAGE_SIZE, NO_FILTER, filterEntries, orderEntries, pageOf });
    return;
  }

  /* ---- Wording and safe DOM construction ---- */
  const say = (key) => {
    if (!Object.hasOwn(WORDING, key)) throw new TypeError("Unknown wording key.");
    return WORDING[key];
  };
  /* The closed set of attribute names the page may set. No event handler, address, style or markup-bearing attribute. */
  const SAFE_ATTRIBUTES = new Set(["id", "class", "role", "scope", "type", "colspan", "value", "for", "tabindex", "data-cell", "data-label", "data-action",
    "aria-label", "aria-labelledby", "aria-expanded", "aria-controls", "aria-live", "aria-atomic"]);
  let serial = 0;
  const nextId = (prefix) => { serial += 1; return `${prefix}-${serial}`; };
  const h = (tag, attributes = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (!SAFE_ATTRIBUTES.has(name)) throw new TypeError("Attribute not allowed.");
      node.setAttribute(name, String(value));
    }
    for (const child of children) node.append(typeof child === "string" ? document.createTextNode(child) : child);
    return node;
  };
  const w = (tag, key, attributes = {}) => h(tag, attributes, say(key)); /* an element holding one registry string */
  /* Untrusted text only ever enters through textContent. */
  const data = (value, tag = "span", extra = {}) => {
    const node = h(tag, { "data-cell": "", ...extra });
    node.textContent = String(value);
    return node;
  };

  const status = h("div", { role: "status", "aria-live": "polite", "aria-atomic": "true", class: "note" });
  const announce = (key) => { status.replaceChildren(say(key)); };

  const copyText = async (text) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fall through to the selection route */ }
    try {
      const area = h("textarea", { class: "sr-only", "aria-label": say("action.copy"), "data-action": "copy" });
      area.value = text;
      document.body.append(area);
      area.select();
      const done = document.execCommand("copy");
      area.remove();
      return done === true;
    } catch { return false; }
  };
  const copyButton = (text, targetId) => {
    const id = nextId("copy");
    const button = h("button", { type: "button", id, "aria-labelledby": `${id} ${targetId}`, "data-action": "copy" }, say("action.copy"));
    button.addEventListener("click", async () => { announce((await copyText(text)) ? "action.copied" : "action.copyUnavailable"); });
    return button;
  };
  const shorten = (text) => (text.length <= SHORTEN_AT ? text : `${Array.from(text).slice(0, SHORTEN_AT - 1).join("")}…`);
  /* A value with a copy action; long values are shortened for display with a visible note (section 9.1). */
  const valueWithCopy = (text) => {
    const id = nextId("value");
    const shown = shorten(String(text));
    const nodes = [data(shown, "span", { id })];
    if (shown !== text) nodes.push(w("span", "text.truncated", { class: "note" }));
    nodes.push(copyButton(String(text), id));
    return h("span", {}, ...nodes.flatMap((node) => [node, " "]));
  };
  const labelled = (group, value) => (value === null ? say("text.notApplicable") : say(`${group}.${value}`));

  /* ---- Page sections ---- */
  const defRows = (rows) => {
    const list = h("dl");
    for (const [labelKey, valueNode] of rows) list.append(w("dt", labelKey), h("dd", {}, valueNode));
    return list;
  };

  const renderHeader = () => {
    const header = h("header", {}, w("h1", "heading.page"));
    const box = h("section", { class: "box", "aria-labelledby": "h-integrity" }, w("h2", "heading.integrity", { id: "h-integrity" }));
    const list = h("ul");
    for (const key of ["statement.integrityOnly", "statement.notAuthenticated", "statement.anchor", "statement.asOfGeneration",
      "statement.metadataDisclosure", "statement.noDecision", "statement.readOnly", "statement.membersNotShown"]) list.append(w("li", key));
    box.append(list);
    header.append(box);
    return header;
  };

  const renderSource = (vm) => {
    const section = h("section", { "aria-labelledby": "h-source" }, w("h2", "heading.source", { id: "h-source" }));
    section.append(defRows([
      ["label.ledgerIdentifier", valueWithCopy(vm.source.ledgerIdentifier)],
      ["label.workspaceIdentifier", valueWithCopy(vm.source.workspaceIdentifier)],
      ["label.entryCount", data(vm.source.entryCount)],
      ["label.headDigest", valueWithCopy(vm.source.headDigest)], /* the full value is wrapped, never shortened (it is 71 characters) */
      ["label.manifestSha256", valueWithCopy(vm.source.manifestSha256)],
    ]));
    return section;
  };

  const tallyTable = (labelKey, group, rows, field) => {
    const table = h("table", { class: "small" }, h("caption", {}, say(labelKey)));
    const body = h("tbody");
    for (const row of rows) body.append(h("tr", {}, w("th", `${group}.${row[field]}`, { scope: "row" }), h("td", {}, data(row.count))));
    table.append(body);
    return table;
  };

  const renderCounts = (vm) => {
    const section = h("section", { "aria-labelledby": "h-counts" }, w("h2", "heading.counts", { id: "h-counts" }));
    section.append(defRows([
      ["label.retainedRecords", data(vm.verification.retainedRecords)],
      ["label.purgedRecords", data(vm.verification.purgedRecords)],
      ["label.tombstones", data(vm.verification.tombstones)],
    ]));
    section.append(tallyTable("label.byRecordKind", "recordKind", vm.summary.byRecordKind, "recordKind"));
    section.append(tallyTable("label.byRetention", "retention", vm.summary.byRetention, "retention"));
    section.append(tallyTable("label.byDecisionConsistency", "observation", vm.summary.byDecisionConsistency, "value"));
    return section;
  };

  const listOrNone = (values) => {
    if (values.length === 0) return w("span", "label.none");
    const list = h("ul");
    for (const value of values) list.append(h("li", {}, data(value)));
    return list;
  };
  const renderAnomalies = (vm) => {
    const section = h("section", { "aria-labelledby": "h-anomalies" }, w("h2", "heading.anomalies", { id: "h-anomalies" }), w("p", "statement.anomalyCounts"));
    section.append(defRows([
      ["label.purgePending", listOrNone(vm.verification.purgePending)],
      ["label.unreferencedRecords", listOrNone(vm.verification.unreferencedRecords)],
      ["label.pendingArtifacts", data(vm.verification.pendingArtifacts)],
    ]));
    return section;
  };

  /* ---- Entries: filters, table, paging ---- */
  const renderEntriesSection = (vm) => {
    const state = { filter: NO_FILTER, order: "ASCENDING", page: 1, expanded: new Set(), subjectType: "", subjectValue: "" };
    const section = h("section", { id: "entries", "aria-labelledby": "h-entries" });
    const heading = w("h2", "heading.entries", { id: "h-entries", tabindex: "-1" });
    section.append(heading);

    const select = (id, labelKey, options) => {
      const control = h("select", { id, "data-action": id === "f-sort" ? "sort" : "filter" });
      for (const [value, text] of options) control.append(h("option", { value }, text));
      return [h("div", {}, w("label", labelKey, { for: id }), control), control];
    };
    const anyOption = ["", say("filter.any")];
    const [kindBox, kindSelect] = select("f-kind", "filter.recordKind", [anyOption, ...vm.summary.byRecordKind.map((r) => [r.recordKind, say(`recordKind.${r.recordKind}`)])]);
    const [retentionBox, retentionSelect] = select("f-retention", "filter.retention", [anyOption, ...vm.summary.byRetention.map((r) => [r.retention, say(`retention.${r.retention}`)])]);
    const [observationBox, observationSelect] = select("f-observation", "filter.decisionConsistency",
      [anyOption, ...vm.summary.byDecisionConsistency.map((r) => [r.value, say(`observation.${r.value}`)])]);
    const subjectTypes = Object.keys(WORDING).filter((key) => key.startsWith("subjectType.")).map((key) => key.slice("subjectType.".length));
    const [subjectTypeBox, subjectTypeSelect] = select("f-subject-type", "filter.subjectType", [anyOption, ...subjectTypes.map((t) => [t, say(`subjectType.${t}`)])]);
    const subjectInput = h("input", { id: "f-subject-value", type: "text", "data-action": "filter" });
    const subjectValueBox = h("div", {}, w("label", "filter.subjectValue", { for: "f-subject-value" }), subjectInput);
    const [sortBox, sortSelect] = select("f-sort", "sort.label", [["ASCENDING", say("sort.ascending")], ["DESCENDING", say("sort.descending")]]);
    const clear = w("button", "filter.clear", { type: "button", "data-action": "filter" });
    const tools = h("div", { class: "tools", role: "group", "aria-label": say("a11y.landmark.filters") },
      kindBox, retentionBox, observationBox, subjectTypeBox, subjectValueBox, sortBox, h("div", {}, clear));
    section.append(tools, status);

    const previous = w("button", "page.previous", { type: "button", "data-action": "page" });
    const next = w("button", "page.next", { type: "button", "data-action": "page" });
    const position = h("span");
    const pager = h("nav", { "aria-label": say("a11y.landmark.pagination"), class: "pager" }, previous, position, next);
    const tableHost = h("div");
    section.append(pager, tableHost);

    const readFilter = () => {
      const subject = subjectTypeSelect.value !== "" && subjectInput.value !== "" ? { type: subjectTypeSelect.value, value: subjectInput.value } : null;
      return {
        recordKinds: kindSelect.value === "" ? [] : [kindSelect.value], subject,
        retention: retentionSelect.value === "" ? "ANY" : retentionSelect.value,
        decisionConsistency: observationSelect.value === "" ? null : observationSelect.value,
      };
    };

    const detailRow = (entry) => {
      const cell = h("td", { colspan: "6", class: "detail", role: "cell" });
      const items = [["column.entryDigest", valueWithCopy(entry.entryDigest)]];
      if (entry.entryType === "RECORD") {
        items.push(["column.recordDigest", valueWithCopy(entry.recordDigest)], ["column.admission", say(`admission.${entry.admission}`)],
          ["column.workspaceAssociation", say(`workspaceAssociation.${entry.workspaceAssociation}`)],
          ["column.tombstoneIndex", entry.tombstoneIndex === null ? say("text.notApplicable") : data(entry.tombstoneIndex)]);
        if (entry.decisionConsistency !== null) items.push(["column.decisionConsistency", say(`decisionConsistency.${entry.decisionConsistency}`)]);
      }
      cell.append(defRows(items));
      if (entry.entryType === "RECORD") {
        cell.append(w("h3", "heading.subjects"));
        if (entry.subjects.length === 0) cell.append(w("p", "label.none"));
        else {
          const list = h("ul");
          for (const subject of entry.subjects) list.append(h("li", {}, w("strong", `subjectType.${subject.type}`), " ", valueWithCopy(subject.value)));
          cell.append(list);
        }
        cell.append(w("h3", "heading.members"), w("p", "statement.membersNotShown"));
        if (entry.members.length === 0) cell.append(w("p", "label.none"));
        else {
          const table = h("table", { "aria-label": say("a11y.membersTable") });
          table.append(h("thead", {}, h("tr", {}, w("th", "column.memberName", { scope: "col" }), w("th", "column.memberLength", { scope: "col" }), w("th", "column.memberDigest", { scope: "col" }))));
          const body = h("tbody");
          for (const member of entry.members) body.append(h("tr", {}, h("td", {}, data(member.name)), h("td", {}, data(member.byteLength)), h("td", {}, valueWithCopy(member.sha256))));
          table.append(body);
          cell.append(table);
        }
      }
      return h("tr", { id: `detail-${entry.index}`, role: "row" }, cell);
    };

    const renderTable = () => {
      const matched = orderEntries(filterEntries(vm.entries, state.filter), state.order);
      const view = pageOf(matched, state.page);
      state.page = view.page;
      position.replaceChildren(say("page.position"), " ", data(view.page), " ", say("page.of"), " ", data(view.pages), " ", say("page.rows"), " ", data(view.items.length));
      previous.disabled = view.page <= 1;
      next.disabled = view.page >= view.pages;
      if (view.total === 0) {
        tableHost.replaceChildren(w("p", vm.entries.length === 0 ? "page.empty" : "page.noMatch", { role: "note" }));
        return;
      }
      const table = h("table", { role: "table", "aria-label": say("a11y.table") });
      table.append(h("thead", { role: "rowgroup" }, h("tr", { role: "row" },
        ...["column.index", "column.entryType", "column.recordKind", "column.retention", "column.decisionConsistency"].map((key) => w("th", key, { scope: "col", role: "columnheader" })),
        w("th", "action.expand", { scope: "col", role: "columnheader", class: "sr-only" }))));
      const body = h("tbody", { role: "rowgroup" });
      for (const entry of view.items) {
        const open = state.expanded.has(entry.index);
        const rowCell = (labelKey, child) => h("td", { role: "cell", "data-label": say(labelKey) }, child);
        const toggle = h("button", { type: "button", "data-action": "expand", "aria-expanded": String(open), "aria-controls": `detail-${entry.index}` }, say(open ? "action.collapse" : "action.expand"));
        toggle.addEventListener("click", () => {
          if (state.expanded.has(entry.index)) state.expanded.delete(entry.index); else state.expanded.add(entry.index);
          renderTable();
          const again = tableHost.querySelector(`button[aria-controls="detail-${entry.index}"]`);
          if (again) again.focus();
        });
        const observation = entry.decisionConsistency === null ? say("text.notApplicable") : say(`observation.${entry.decisionConsistency}`);
        const retention = entry.entryType === "TOMBSTONE" ? say("text.notApplicable") : say(`retention.${entry.retention}`);
        body.append(h("tr", { role: "row" },
          rowCell("column.index", data(entry.index)),
          rowCell("column.entryType", say(`entryType.${entry.entryType}`)),
          rowCell("column.recordKind", labelled("recordKind", entry.recordKind)),
          rowCell("column.retention", retention),
          rowCell("column.decisionConsistency", observation),
          h("td", { role: "cell" }, toggle)));
        if (open) {
          body.append(detailRow(entry));
        }
      }
      table.append(body);
      tableHost.replaceChildren(table);
    };

    const refilter = () => { state.filter = readFilter(); state.page = 1; state.expanded = new Set(); renderTable(); announce("page.updated"); };
    for (const control of [kindSelect, retentionSelect, observationSelect, subjectTypeSelect]) control.addEventListener("change", refilter);
    subjectInput.addEventListener("input", refilter);
    sortSelect.addEventListener("change", () => { state.order = sortSelect.value; state.page = 1; state.expanded = new Set(); renderTable(); announce("page.updated"); });
    clear.addEventListener("click", () => {
      for (const control of [kindSelect, retentionSelect, observationSelect, subjectTypeSelect]) control.value = "";
      subjectInput.value = "";
      refilter();
    });
    const go = (delta) => { state.page += delta; state.expanded = new Set(); renderTable(); heading.focus(); };
    previous.addEventListener("click", () => go(-1));
    next.addEventListener("click", () => go(1));
    renderTable();
    return section;
  };

  /* ---- Start ---- */
  const root = document.getElementById("app");
  try {
    const block = document.getElementById(DATA_ID);
    const vm = JSON.parse(block.textContent);
    if (vm === null || typeof vm !== "object" || vm.kind !== "MemoryOSDashboardViewModel" || vm.version !== "1.0.0" || !Array.isArray(vm.entries)) throw new TypeError("data");
    const main = h("main", { "aria-label": say("a11y.landmark.main") }, renderSource(vm), renderCounts(vm), renderAnomalies(vm), renderEntriesSection(vm));
    root.replaceChildren(renderHeader(), main);
  } catch {
    root.replaceChildren(w("p", "error.dataUnreadable", { role: "alert" }));
  }
})();
