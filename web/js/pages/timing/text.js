// The sentences of the timing page that name a time or a plan.

import { t } from "../../i18n/index.js";
import { cap } from "../../format.js";
import { minutesWords } from "../../i18n/minutes.js";
import { hm } from "./plan.js";

/** @typedef {import("./plan.js").Plan} Plan */

/** @param {number} minutes @returns {string} "50 minutes" or "1 h 18 min" */
export const words = (minutes) => minutesWords(minutes, "timing.hm", "timing.minutes");

/** "Chop the onion at 17:40, switch the oven on at 18:00 and …", in one sentence. @param {Plan} p */
export function startsInWords(p) {
  const sorted = [...p.lanes].sort((a, b) => a.start - b.start);
  const parts = sorted.map((l) => t("timing.sayAt", l.steps[0].say, hm(l.start)));
  if (parts.length === 1) return `${cap(parts[0])}.`;
  return `${cap(parts[0])}, ${parts.slice(1).join(` ${t("timing.and")} `)}.`;
}
