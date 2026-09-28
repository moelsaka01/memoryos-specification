// Only the corrected combined CLI fixture and previously unexecuted guard cases.
process.argv.push('remaining');
await import('./environment.mjs');
