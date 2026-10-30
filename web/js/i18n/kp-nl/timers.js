// The package's Dutch words for timers and discs, the days of the week, snooze.
// Part of kp-nl.js (split by component family on 30/10/2026, docs/agent/MODULARITY.md).

export const KP_NL_TIMERS = {
  // timers and discs
  timerStart: "Start",
  timerPause: "Pauze",
  timerResume: "Hervat",
  timerReset: "Terugzetten",
  timerAddMinute: (seconds) => (seconds % 60 === 0 ? `+${seconds / 60} min` : `+${seconds} s`),
  timerAddMinuteTitle: (seconds) => (seconds % 60 === 0 ? `Voeg ${seconds / 60} min toe` : `Voeg ${seconds} s toe`),
  timerPaused: "Gepauzeerd",
  timerEnded: "De tijd is om",
  timerEndedNamed: (name) => `${name}: de tijd is om`,
  timerStarted: "Gestart",
  timerResumed: "Loopt verder",
  timerLeft: (duration) => `nog ${duration}`,
  timerDuration: (seconds) => {
    if (seconds < 60) return `${seconds} s`;
    if (seconds >= 86400) {
      const d = Math.floor(seconds / 86400);
      const dh = Math.floor((seconds % 86400) / 3600);
      return dh ? `${d} d ${dh} u` : `${d} d`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h ? `${h} u` : "", m ? `${m} min` : "", s ? `${s} s` : ""].filter(Boolean).join(" ");
  },
  timerDiscLeft: (left, total) => `nog ${left} van ${total}`,
  timerUnderMinute: "minder dan een minuut",
  timerDiscCaption: (name, duration) => `${name} · ${duration}`,
  timerUntil: (when) => `tot ${when}`,
  countdownDays: (days, hours) => `${days} d ${hours} u`,
  timerRunning: "Loopt",
  timerDoneWord: "Klaar",
  timerDone: (name) => `${name} is klaar`,
  timerSpoken: (name) => `${name} is klaar`,
  timerStopRing: "Stop",
  timerAddMinuteTo: (name) => `Nog een minuut voor ${name}`,
  timerRemove: (name) => `${name} verwijderen`,
  timerEmpty: "Geen timers actief.",
  timersLoading: "De timers worden gelezen…",
  timersFailed: "De timers konden niet gelezen worden.",
  timerLastMinute: (name) => `${name}: nog één minuut`,
  timerStartedNamed: (name, clock) => `${name} gestart, ${clock}`,
  timerAlready: (name) => `${name} loopt al`,
  // days of the week (pickers)
  weekdaysGroup: "Dagen",
  weekdaysShort: ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
  weekdaysNarrow: ["M", "D", "W", "D", "V", "Z", "Z"],
  weekdaysLong: ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"],
  weekdaysLast: "Laatste",
  weekdaysLastDay: "laatste dag",
  weekdaysAnd: "en",
  weekdaysPresets: "Snelle keuzes",
  weekdaysPresetWeekdays: "Weekdagen",
  weekdaysPresetWeekend: "Weekend",
  weekdaysPresetEvery: "Elke dag",
  weekdaysNone: "Geen dag gekozen",
  weekdaysEvery: "Elke dag",
  weekdaysWeekdays: "Elke weekdag",
  weekdaysWeekend: "Elk weekend",
  weekdaysOrdinal: (n) => `${n}e`,
  weekdaysOnThe: (list) => `Op de ${list}`,
  weekdaysMin: (n) => (n === 1 ? "Kies minstens één dag." : `Kies minstens ${n} dagen.`),
  // snooze
  snoozeTrigger: "Herinner me later",
  snoozeChange: "Opnieuw uitstellen",
  snoozeChoicesLabel: "Herinner me",
  snoozeIn: (key) => {
    const m = /^(\d+)\s*([mhdw])$/.exec(key.trim().toLowerCase());
    if (!m) return key;
    const n = Number(m[1]);
    const unit = /** @type {Record<string, [string, string]>} */ ({ m: ["minuut", "minuten"], h: ["uur", "uur"], d: ["dag", "dagen"], w: ["week", "weken"] })[m[2]];
    return `Over ${n} ${n === 1 ? unit[0] : unit[1]}`;
  },
  snoozeTonight: (time) => `Vanavond ${time}`,
  snoozeTomorrow: (time) => `Morgen ${time}`,
  snoozeMonday: (time) => `Maandag ${time}`,
  snoozeNextWeek: (time) => `Volgende week ${time}`,
  snoozeLast: "Je vorige keuze",
  snoozePick: "Kies een datum en tijd…",
  snoozePickHint: "Elk moment in de komende dagen",
  snoozePickTitle: "Herinner me op",
  snoozeDateLabel: "Datum (dd/mm/jjjj)",
  snoozeTimeLabel: "Tijd (UU:MM, 24 uur)",
  snoozeApply: "Uitstellen",
  snoozeCancel: "Annuleren",
  snoozeUntil: (moment) => `Uitgesteld tot ${moment}`,
  snoozeNone: "Niet uitgesteld",
  snoozeEnd: "Uitstel beëindigen",
  snoozeSaving: "De herinnering wordt bewaard",
  snoozeErrorDate: "Typ een volledige datum, dd/mm/jjjj.",
  snoozeErrorTime: "Typ een tijdstip, 00:00 tot 23:59.",
  snoozeErrorPast: "Kies een moment in de toekomst.",
  snoozeErrorMax: (days) => `Een herinnering kan hoogstens ${days} dagen ver weg liggen.`,
};
