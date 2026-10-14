// MO-1308 Phase 3A Windows harness: a preload that shifts the process clock (Date) by P3A_CLOCK_SHIFT_MS milliseconds, for 3A-L4.
// The harness may not change the host's system clock or time zone (a system setting, and a privileged one), so the case runs the product
// with Date.now() and new Date() moved by years, and with a different TZ, and compares every byte. Disarmed (no variable) it does nothing.
const shift = Number(process.env.P3A_CLOCK_SHIFT_MS ?? 0);
if (Number.isFinite(shift) && shift !== 0) {
  const RealDate = Date;
  class ShiftedDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(RealDate.now() + shift); else super(...args); }
    static now() { return RealDate.now() + shift; }
  }
  globalThis.Date = ShiftedDate;
}
