const MATCH = 0;
const FROM_ONLY = 1;
const TO_ONLY = 2;

function requireSequence(value, label) {
  if (!Array.isArray(value) || value.some((step) => !step || typeof step.identity !== "string")) {
    throw new TypeError(`${label} must be an array of steps with exact string identities.`);
  }
}

function isSubsequence(candidate, sequence, offset) {
  let candidateIndex = offset;
  for (let index = offset; index < sequence.length && candidateIndex < candidate.length; index += 1) {
    if (candidate[candidateIndex].identity === sequence[index].identity) candidateIndex += 1;
  }
  return candidateIndex === candidate.length;
}

function alignInserted(fromSteps, toSteps, offset, aligned) {
  let fromIndex = offset;
  let toIndex = offset;
  while (fromIndex < fromSteps.length || toIndex < toSteps.length) {
    const from = fromSteps[fromIndex] ?? null;
    const to = toSteps[toIndex] ?? null;
    if (from && to && from.identity === to.identity) {
      aligned.push({ from, to });
      fromIndex += 1;
      toIndex += 1;
    } else {
      aligned.push({ from: null, to });
      toIndex += 1;
    }
  }
}

function alignRemoved(fromSteps, toSteps, offset, aligned) {
  let fromIndex = offset;
  let toIndex = offset;
  while (fromIndex < fromSteps.length || toIndex < toSteps.length) {
    const from = fromSteps[fromIndex] ?? null;
    const to = toSteps[toIndex] ?? null;
    if (from && to && from.identity === to.identity) {
      aligned.push({ from, to });
      fromIndex += 1;
      toIndex += 1;
    } else {
      aligned.push({ from, to: null });
      fromIndex += 1;
    }
  }
}

function setDirection(directions, index, direction) {
  const byteIndex = index >>> 2;
  const shift = (index & 3) << 1;
  directions[byteIndex] = (directions[byteIndex] & ~(3 << shift)) | (direction << shift);
}

function directionAt(directions, index) {
  return (directions[index >>> 2] >>> ((index & 3) << 1)) & 3;
}

function alignPacked(fromSteps, toSteps, offset, aligned) {
  const fromLength = fromSteps.length - offset;
  const toLength = toSteps.length - offset;
  const cells = fromLength * toLength;
  if (!Number.isSafeInteger(cells)) throw new RangeError("The alignment matrix exceeds safe indexing.");
  const directions = new Uint8Array(Math.ceil(cells / 4));
  const Row = Math.min(fromLength, toLength) <= 0xffff ? Uint16Array : Uint32Array;
  let next = new Row(toLength + 1);
  let current = new Row(toLength + 1);

  for (let fromIndex = fromLength - 1; fromIndex >= 0; fromIndex -= 1) {
    current[toLength] = 0;
    const from = fromSteps[offset + fromIndex];
    for (let toIndex = toLength - 1; toIndex >= 0; toIndex -= 1) {
      const cell = (fromIndex * toLength) + toIndex;
      if (from.identity === toSteps[offset + toIndex].identity) {
        current[toIndex] = next[toIndex + 1] + 1;
        setDirection(directions, cell, MATCH);
      } else if (next[toIndex] >= current[toIndex + 1]) {
        current[toIndex] = next[toIndex];
        setDirection(directions, cell, FROM_ONLY);
      } else {
        current[toIndex] = current[toIndex + 1];
        setDirection(directions, cell, TO_ONLY);
      }
    }
    [current, next] = [next, current];
  }

  let fromIndex = 0;
  let toIndex = 0;
  while (fromIndex < fromLength || toIndex < toLength) {
    if (fromIndex >= fromLength) {
      aligned.push({ from: null, to: toSteps[offset + toIndex++] });
      continue;
    }
    if (toIndex >= toLength) {
      aligned.push({ from: fromSteps[offset + fromIndex++], to: null });
      continue;
    }
    const direction = directionAt(directions, (fromIndex * toLength) + toIndex);
    if (direction === MATCH) {
      aligned.push({ from: fromSteps[offset + fromIndex++], to: toSteps[offset + toIndex++] });
    } else if (direction === FROM_ONLY) {
      aligned.push({ from: fromSteps[offset + fromIndex++], to: null });
    } else {
      aligned.push({ from: null, to: toSteps[offset + toIndex++] });
    }
  }
}

// Equivalent to the former full LCS table: match immediately and prefer A on
// equal-cost ties. Directions consume two bits per cell; common production
// cases (identical, insertion-only, removal-only) remain linear.
export function alignDeterministicSequences(fromSteps, toSteps) {
  requireSequence(fromSteps, "Observation A steps");
  requireSequence(toSteps, "Observation B steps");
  const aligned = [];
  let prefix = 0;
  while (prefix < fromSteps.length && prefix < toSteps.length
    && fromSteps[prefix].identity === toSteps[prefix].identity) {
    aligned.push({ from: fromSteps[prefix], to: toSteps[prefix] });
    prefix += 1;
  }
  if (prefix === fromSteps.length) {
    toSteps.slice(prefix).forEach((to) => aligned.push({ from: null, to }));
  } else if (prefix === toSteps.length) {
    fromSteps.slice(prefix).forEach((from) => aligned.push({ from, to: null }));
  } else if (fromSteps.length <= toSteps.length && isSubsequence(fromSteps, toSteps, prefix)) {
    alignInserted(fromSteps, toSteps, prefix, aligned);
  } else if (toSteps.length <= fromSteps.length && isSubsequence(toSteps, fromSteps, prefix)) {
    alignRemoved(fromSteps, toSteps, prefix, aligned);
  } else {
    alignPacked(fromSteps, toSteps, prefix, aligned);
  }
  return aligned;
}
