// The package's own words in Dutch, for kp's `setStrings` (js/i18n/index.js). kp-themes ships English only; this holds
// the words of the components Kitchen uses (tables, forms, dialogs, toasts, card states, the wheel, pickers, the
// calendar, focus steps, the timeline, the heat grid, checklists, galleries, menus, the theme picker and the bar). A
// key not here stays English: the package's developer diagnostics (console warnings) and the components Kitchen does
// not draw. A function keeps the parameters of the English one.

import { DEFAULT_STRINGS } from "/static/kp/dist/kp-themes.min.js";
import { KP_NL_BASICS } from "./kp-nl/basics.js";
import { KP_NL_TABLES } from "./kp-nl/tables.js";
import { KP_NL_FORMS } from "./kp-nl/forms.js";
import { KP_NL_CALENDAR } from "./kp-nl/calendar.js";
import { KP_NL_TIMELINE } from "./kp-nl/timeline.js";
import { KP_NL_TIMERS } from "./kp-nl/timers.js";
import { KP_NL_VIEWERS } from "./kp-nl/viewers.js";
import { KP_NL_CONTROLS } from "./kp-nl/controls.js";
import { KP_NL_STEPS } from "./kp-nl/steps.js";
import { KP_NL_WHEEL_QR } from "./kp-nl/wheel-qr.js";
import { KP_NL_SEQUENCER } from "./kp-nl/sequencer.js";

const NL_WORDS = {
  ...KP_NL_BASICS,
  ...KP_NL_TABLES,
  ...KP_NL_FORMS,
  ...KP_NL_CALENDAR,
  ...KP_NL_TIMELINE,
  ...KP_NL_TIMERS,
  ...KP_NL_VIEWERS,
  ...KP_NL_CONTROLS,
  ...KP_NL_STEPS,
  ...KP_NL_WHEEL_QR,
  ...KP_NL_SEQUENCER,
};

export const KP_NL = Object.freeze({
  ...DEFAULT_STRINGS,
  ...NL_WORDS,
});
