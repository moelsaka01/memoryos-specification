"use strict";

exports.activate = function activate() {
  return Object.freeze({ kind: "MemoryOSPrivateHostTestRunner" });
};

exports.deactivate = function deactivate() {};
