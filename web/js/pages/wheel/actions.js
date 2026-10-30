// What the wheel page writes: letting go of the constraint that holds the most dishes back, setting a dish aside for a week
// ("Not this one, not again this week"; a `resting` item with an `until` date) and bringing it back.

import { create, remove } from "../../api.js";
import { t } from "../../i18n/index.js";
import { dmyDate, localIso } from "../../format.js";
import { restUntil } from "./logic.js";
import { byId, onWheel, pickToLoosen, track } from "./model.js";
import { paintEasy } from "./easy.js";
import { paintChips } from "./filters.js";

/** @param {unknown} e */
const why = (e) => (e instanceof Error ? e.message : String(e));

/** Let go of the one constraint that frees the most dishes. @param {import("./index.js").WheelCtx} ctx @param {(text: string) => void} say */
export async function loosenOne(ctx, say) {
  const pick = pickToLoosen(ctx);
  if (!pick) return;
  if (pick.key.startsWith("rest:")) {
    const item = ctx.restItems.get(pick.key.slice(5));
    if (!item) return;
    try {
      await remove("resting", item.id);
    } catch (e) {
      say(t("wheel.letGoFailed", pick.label, why(e)));
      return;
    }
  } else {
    pick.release();
    if (pick.key === "easy" || pick.key.startsWith("kind:")) paintEasy(ctx);
  }
  ctx.M.order = ctx.M.order.filter((k) => k !== pick.key);
  paintChips(ctx);
  say(t("wheel.letGo", pick.label, onWheel(ctx, ctx.M).length));
}

/**
 * Run one write with the buttons held (`ctx.writing`) and say how it went.
 * @param {import("./index.js").WheelCtx} ctx @param {() => Promise<unknown>} write @param {() => void} repaint
 * @param {(text: string) => void} say @param {() => string} done @param {(reason: string) => string} failed
 */
async function writing(ctx, write, repaint, say, done, failed) {
  ctx.writing = true;
  repaint();
  try {
    await write();
    say(done());
  } catch (e) {
    say(failed(why(e)));
  } finally {
    ctx.writing = false;
    repaint();
  }
}

/** The chosen dish rests for a week. @param {import("./index.js").WheelCtx} ctx @param {string | null} chosen @param {() => void} repaint @param {(text: string) => void} say */
export async function setAside(ctx, chosen, repaint, say) {
  if (!chosen || ctx.writing) return;
  const d = byId(ctx, chosen);
  if (!d) return;
  const until = restUntil();
  await writing(ctx, () => create("resting", { dish_id: d.id, until: localIso(until) }), repaint, say, () => t("wheel.setAside", d.label, dmyDate(until)), (r) => t("wheel.setAsideFailed", d.label, r));
}

/** @param {import("./index.js").WheelCtx} ctx @param {any} item @param {string} name @param {() => void} repaint @param {(text: string) => void} say */
export async function bringBack(ctx, item, name, repaint, say) {
  if (ctx.writing) return;
  await writing(ctx, () => remove("resting", item.id), repaint, say, () => t("wheel.backOn", name), (r) => t("wheel.bringBackFailed", name, r));
}
