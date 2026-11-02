// What the timing page says when its recipe cannot be counted back, as i18n keys. Pure: no DOM, no words
// (scripts/timing-plates.test.mjs).

/**
 * The plate's title and text keys. A recipe without step times asks for them; a recipe that is not in the kitchen says
 * why in the words of how the page got it: an address followed ("?id=", the link may be old) or tonight's wheel answer
 * (no link was followed, so the link wording would be wrong; feat-stale-answer-1).
 * @param {{ found: boolean, fromWheel: boolean }} how
 * @returns {{ title: string, text: string }}
 */
export function notCountableKeys({ found, fromWheel }) {
  if (found) return { title: "timing.thisNoTimes", text: "timing.giveEveryStep" };
  return { title: "timing.notInKitchen", text: fromWheel ? "timing.wheelAnswerGone" : "timing.linkOld" };
}
