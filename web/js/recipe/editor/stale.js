// A save refused because the recipe was saved elsewhere since this editor opened it (fix-stale-save-1): two tabs on one
// recipe, the second Save no longer wins silently. The server answers 409 with `"code": "stale"` (src/routes.rs); the
// editor turns that into its own result so the page can offer Reload or Keep as a draft (pages/recipe-edit/stale.js).
// Pure: tested by scripts/stale-save.test.mjs.

/** Whether an error is the server's stale refusal. @param {unknown} e */
export const isStale = (e) => {
  const err = /** @type {{ status?: unknown, code?: unknown } | null} */ (e && typeof e === "object" ? e : null);
  return err?.status === 409 && err?.code === "stale";
};

/**
 * The editor's save result for a stale refusal, else null (the caller maps any other error as before).
 * @param {unknown} e @param {(key: string) => string} t
 * @returns {{ ok: false, stale: true, section: string, message: string } | null}
 */
export const staleResult = (e, t) => (isStale(e) ? { ok: false, stale: true, section: "dish", message: t("ep.staleTitle") } : null);
