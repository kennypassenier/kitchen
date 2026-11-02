// What this device keeps offline (feat-offline-kitchen). Kenny, 02/11/2026: "Hele keuken offline", with one general
// setting "Alles offline bewaren" that is ON by default. The kit keeps the setting per device (`keepAll`, in
// localStorage) and starts it OFF, so Kitchen turns it on once, the first time the kit runs on a device, and marks that
// it did: a person who turns it off later keeps it off.
//
// `needsDefault` and `markDefault` take the storage as an argument (no globals), so scripts/offline-keep.test.mjs drives
// them with a fake one.

/** Kenny's default for "Alles offline bewaren" (02/11/2026). */
export const KEEP_ALL_DEFAULT = true;

/**
 * The localStorage key that says the default was applied on this device. Outside the `kitchen:` prefix the kit syncs to
 * the login (src/main.rs `sync_browser_keys`): a synced mark arrived on every new device with the login, so the default
 * was never applied there and nothing was kept offline (found at the 6.0.0 release checks, fix-offline-default-1).
 */
export const DEFAULT_MARK = "kitchen-device:offline-default-applied";

/**
 * Whether the default still has to be applied on this device. A storage that cannot be read counts as "not yet":
 * applying the default again is harmless, never applying it would leave the copy off. The failure is reported.
 * @param {Pick<Storage, "getItem"> | null} storage @returns {boolean}
 */
export function needsDefault(storage) {
  try {
    return storage?.getItem(DEFAULT_MARK) !== "1";
  } catch (err) {
    console.warn("Kitchen: could not read whether the offline default was applied; applying it again.", err);
    return true;
  }
}

/**
 * Remember that the default was applied. Answers whether that could be stored (a private window cannot, and then the
 * default is applied again on the next page load, which the kit also forgets there).
 * @param {Pick<Storage, "setItem"> | null} storage @returns {boolean}
 */
export function markDefault(storage) {
  try {
    storage?.setItem(DEFAULT_MARK, "1");
    return Boolean(storage);
  } catch (err) {
    console.warn("Kitchen: could not store that the offline default was applied.", err);
    return false;
  }
}

/** The browser's localStorage, or null when the browser blocks it. @returns {Storage | null} */
export function deviceStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // blocked (a private window, a policy): needsDefault/markDefault report what follows
  }
}

/**
 * Apply Kenny's default once per device: "keep everything offline" on.
 * @param {{ keepAll: (on: boolean) => Promise<boolean> }} kit @param {Storage | null} storage
 */
export async function applyKeepDefault(kit, storage) {
  if (!needsDefault(storage)) return;
  await kit.keepAll(KEEP_ALL_DEFAULT);
  markDefault(storage);
}
