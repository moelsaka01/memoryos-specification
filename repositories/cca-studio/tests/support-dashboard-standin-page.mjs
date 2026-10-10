// MO-1309 Phase 2B test support: minimal stand-in page sources that meet the generator/page contract (the placeholder set and
// the single wording mark). The real page is the Phase 2A source (web/dashboard/); Phase 3 integration runs the generator over it.
export const STANDIN_SOURCES = Object.freeze({
  template: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="@@CSP@@">
<title>@@TITLE@@</title>
<style>@@STYLE@@</style>
</head>
<body>
<noscript>@@NOSCRIPT@@</noscript>
<div id="app"></div>
<footer><dl><dt>@@LABEL_GENERATOR@@</dt><dd id="generator-version">@@GENERATOR@@</dd><dt>@@LABEL_SNAPSHOT@@</dt><dd id="snapshot-digest">@@SNAPSHOT_DIGEST@@</dd></dl></footer>
<script type="application/json" id="memoryos-dashboard-data">@@DATA@@</script>
<script>@@SCRIPT@@</script>
</body>
</html>
`,
  style: "body { margin: 0; }\n",
  script: '"use strict";\n(() => {\n  const WORDING = null; /*@@WORDING@@*/\n  const data = JSON.parse(document.getElementById("memoryos-dashboard-data").textContent);\n  document.getElementById("app").textContent = String(data.entries.length) + WORDING["heading.page"];\n})();\n',
});
