function finiteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function nullableKey(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function createGraphViewState(initial = {}) {
  return {
    selectedKey: nullableKey(initial.selectedKey),
    followedKey: nullableKey(initial.followedKey),
    filteredKind: nullableKey(initial.filteredKind),
    interactionMode: initial.interactionMode === "pan" ? "pan" : "select",
    camera: {
      scale: finiteNumber(initial.camera?.scale, 1),
      x: finiteNumber(initial.camera?.x, 0),
      y: finiteNumber(initial.camera?.y, 0),
    },
  };
}

export function reconcileGraphViewState(world, viewState = {}) {
  if (!world || !Array.isArray(world.nodes)) throw new TypeError("A semantic world is required.");
  const keys = new Set(world.nodes.map(({ key }) => key));
  const next = createGraphViewState(viewState);
  if (!keys.has(next.selectedKey)) next.selectedKey = null;
  if (!keys.has(next.followedKey)) next.followedKey = null;
  return next;
}

export function selectGraphNode(viewState, key) {
  if (typeof key !== "string" || key.length === 0) throw new TypeError("A graph node key is required.");
  const next = createGraphViewState(viewState);
  next.selectedKey = key;
  if (next.followedKey) next.followedKey = key;
  return next;
}

export function toggleGraphFollow(viewState) {
  const next = createGraphViewState(viewState);
  next.followedKey = next.followedKey ? null : next.selectedKey;
  return next;
}

export function endGraphFollow(viewState) {
  return { ...createGraphViewState(viewState), followedKey: null };
}

export function toggleGraphRegionIsolation(viewState, kind) {
  if (typeof kind !== "string" || kind.length === 0) {
    throw new TypeError("A cognitive region kind is required.");
  }
  const next = createGraphViewState(viewState);
  next.filteredKind = next.filteredKind === kind ? null : kind;
  return next;
}
