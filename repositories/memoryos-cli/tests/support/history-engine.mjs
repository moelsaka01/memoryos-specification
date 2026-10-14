// The real SDK history functions (Contract Freeze 1 section 13.2), as the `engine` handed to the file store. Stream 2C
// was built against the frozen signatures with a stand-in (history-engine-double.mjs, now used only by the 2C
// characterization tool); Stream 2D replaced it in every test with these.
import {
  MemoryOSHistoryError, admitHistoryRecord, appendHistoryEntry, buildHistoryExport, createHistoryLedger, queryHistoryLedger,
  tombstoneHistoryEntry, verifyHistoryExport, verifyHistoryLedger,
} from "../../../cca-studio/web/js/memoryos-sdk.js";

export const createHistoryEngine = () => Object.freeze({
  MemoryOSHistoryError, admitHistoryRecord, appendHistoryEntry, buildHistoryExport, createHistoryLedger, queryHistoryLedger,
  tombstoneHistoryEntry, verifyHistoryExport, verifyHistoryLedger,
});
