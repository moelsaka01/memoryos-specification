import { main } from "./vendor/repositories/memoryos-cli/src/main.js";

const records = [];
const errors = [];
const io = Object.freeze({
  stdin: () => { throw new Error("The bundled Policy CLI transport does not accept stdin."); },
  stdout: (value) => records.push(value),
  stderr: (value) => errors.push(value),
});

try {
  const exitCode = await main(process.argv.slice(2), io);
  const selected = records.length === 1 && errors.length === 0
    ? records
    : (records.length === 0 && errors.length === 1 ? errors : null);
  if (selected === null || typeof selected[0] !== "string") {
    throw new Error("The bundled Policy CLI emitted an invalid transport record count.");
  }
  process.stdout.write(selected[0]);
  process.exitCode = exitCode;
} catch {
  process.stderr.write("MemoryOS bundled Policy CLI transport failed.\n");
  process.exitCode = 125;
}
