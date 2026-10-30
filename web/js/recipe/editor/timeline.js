// The timeline: the steps as clips on lanes, the other view of the step list.

import { setSequencerItems, setSequencerState, SEQUENCER_CHANGE_EVENT } from "/static/kp/js/sequencer.js";
import { h } from "../../dom.js";
import { t } from "../../i18n/index.js";
import { toItems, fromItems } from "../sequence.js";
import { settle } from "../meet.js";
import { pick } from "../bilingual.js";
import { lang } from "../../i18n/index.js";

/** @typedef {{ host: HTMLElement, tracks: ReturnType<typeof import("../../ui/form-parts.js").rows>, steps: ReturnType<typeof import("./steps.js").stepFields>, syncing: boolean, paintQueued: boolean, seqState: string }} TimelineState */

/** @param {TimelineState} s */
const namedTracks = (s) => s.tracks.get().map(([tk]) => tk).filter((tk) => tk.name);

/** Paint the clips from the step fields. @param {TimelineState} s */
function paintTimeline(s) {
  if (s.syncing) return;
  const named = namedTracks(s);
  const number = new Map(s.steps.list.map((e, i) => [e.id, i + 1]));
  const { items, lanes } = toItems(settle(s.steps.live().map((e) => e.get()), named), named, {
    meet: t("edit.tracksMeet"),
    all: t("edit.timelineAll"),
    unnamed: t("edit.unnamedTrack"),
    label: (st, n) => `${number.get(st.id) ?? n}. ${pick(st.text, lang())}`,
  });
  setSequencerItems(s.host, items, lanes);
  const state = items.length ? "ready" : "empty";
  if (state !== s.seqState) {
    s.seqState = state;
    setSequencerState(s.host, state, t("edit.timelineEmpty"), { text: t("edit.timelineEmptyText") });
  }
}

/** Several events in a row (a typed number, a removed step) paint the timeline once. @param {TimelineState} s @param {Event} ev */
function queuePaint(s, ev) {
  if (s.paintQueued || s.host.contains(/** @type {Node} */ (ev.target))) return;
  s.paintQueued = true;
  queueMicrotask(() => {
    s.paintQueued = false;
    paintTimeline(s);
  });
}

/** An edit dropped on the timeline: write it to the step fields, put the list in the order of the starts, and let the normal form events carry it on (the two times, the draft). The timeline is then painted again from the fields. @param {TimelineState} s @param {CustomEvent} ev */
function applyDrop(s, ev) {
  s.syncing = true;
  try {
    // The meeting lane then follows the steps before it (recipe/meet.js, Kenny, 30/10/2026).
    const named = namedTracks(s);
    const after = settle(fromItems(s.steps.list.map((e) => e.get()), named, ev.detail.items), named);
    const byId = new Map(s.steps.list.map((e) => [e.id, e]));
    for (const st of after) /** @type {any} */ (byId.get(st.id))?.set(st);
    s.steps.list = after.map((st) => /** @type {any} */ (byId.get(st.id)));
    s.steps.renumber();
  } finally {
    s.syncing = false;
  }
  paintTimeline(s);
}

/** @param {{ tracks: ReturnType<typeof import("../../ui/form-parts.js").rows>, steps: ReturnType<typeof import("./steps.js").stepFields> }} o */
export function timelineFields({ tracks, steps }) {
  // The steps as clips on lanes, one lane per track (Kenny, 30/10/2026: a draggable timeline, "like a video editor"): drag to
  // move, drag between lanes to run things in parallel, drag an edge to change how long a step takes. It is the kit's
  // sequencer (kp-themes 11.3.0); recipe/sequence.js maps the step fields to its items and back, and the list above stays the
  // other view: a change in either one is written to the same four fields (track, mins, start, with) and shown in the other.
  const host = h("section", { class: "kp-gantt kp-sequencer rl-timeline", "data-kp-sequencer": true, "data-kp-sequencer-unit": "minute", "data-kp-sequencer-snap": "1", "aria-label": t("edit.timelineLabel") });
  /** @type {TimelineState} */
  const s = { host, tracks, steps, syncing: false, paintQueued: false, seqState: "" };
  host.addEventListener(SEQUENCER_CHANGE_EVENT, (ev) => applyDrop(s, /** @type {CustomEvent} */ (ev)));
  return {
    host,
    paint: () => paintTimeline(s),
    queuePaint: (/** @type {Event} */ ev) => queuePaint(s, ev),
    namedTracks: () => namedTracks(s),
    get syncing() {
      return s.syncing;
    },
  };
}
