import { rm } from "node:fs/promises";

export const HOST_PROFILE_CLEANUP_MAX_RETRIES = 10;
export const HOST_PROFILE_CLEANUP_RETRY_DELAY_MS = 50;

const WINDOWS_TRANSIENT_CLEANUP_CODES = new Set(["EBUSY", "EPERM"]);

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

export async function removeHostProfile(profilePath, options = {}) {
  const platform = options.platform ?? process.platform;
  const remove = options.remove ?? rm;
  const wait = options.wait ?? delay;
  for (let retry = 0; ; retry += 1) {
    try {
      await remove(profilePath, { force: true, recursive: true });
      return;
    } catch (error) {
      const transientWindowsCleanup = platform === "win32"
        && WINDOWS_TRANSIENT_CLEANUP_CODES.has(error?.code);
      if (!transientWindowsCleanup || retry >= HOST_PROFILE_CLEANUP_MAX_RETRIES) throw error;
      await wait(HOST_PROFILE_CLEANUP_RETRY_DELAY_MS * (retry + 1));
    }
  }
}

export async function withHostProfileCleanup(profilePath, operation, options = {}) {
  try {
    return await operation();
  } finally {
    await removeHostProfile(profilePath, options);
  }
}
