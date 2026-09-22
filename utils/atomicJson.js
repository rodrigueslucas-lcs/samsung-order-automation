const fs = require("node:fs");

const RETRYABLE_WINDOWS_ERRORS = new Set(["EBUSY", "EPERM", "EACCES"]);
const retrySignal = new Int32Array(new SharedArrayBuffer(4));

function wait(milliseconds) {
  Atomics.wait(retrySignal, 0, 0, milliseconds);
}

function writeJsonAtomically(destination, value, { attempts = 7 } = {}) {
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  const descriptor = fs.openSync(temporary, "w", 0o600);
  try {
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2), "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.chmodSync(temporary, 0o600);

  try {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        fs.renameSync(temporary, destination);
        return;
      } catch (error) {
        if (!RETRYABLE_WINDOWS_ERRORS.has(error.code) || attempt === attempts) throw error;
        wait(25 * (2 ** (attempt - 1)));
      }
    }
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

module.exports = { writeJsonAtomically };
