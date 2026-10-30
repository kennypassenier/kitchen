// The package's Dutch words for the editable timeline (sequencer, kp-themes 11.3.0).
// Part of kp-nl.js (split by component family on 30/10/2026, docs/agent/MODULARITY.md).

export const KP_NL_SEQUENCER = {
  // editable timeline (sequencer, kp-themes 11.3.0): every `sequencer…` word of the package, so none stays English
  sequencerLabel: "Tijdlijn",
  sequencerLoading: "De tijdlijn wordt gelezen",
  sequencerEmpty: "Nog niets op de tijdlijn",
  sequencerEmptyText: "Voeg een stap toe en hij wordt hier neergelegd.",
  sequencerFailed: "De tijdlijn kon niet gelezen worden",
  sequencerZoomLabel: "Zoom",
  sequencerZoomIn: "Inzoomen",
  sequencerZoomOut: "Uitzoomen",
  sequencerZoomFit: "Passend",
  sequencerZoomValue: (percent) => `${percent}%`,
  sequencerSpan: (value, unit) => {
    const seconds = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 }[unit] ?? 60;
    const words = [["w", 604800], ["d", 86400], ["u", 3600], ["min", 60], ["s", 1]];
    let rest = Math.round(Math.abs(value) * seconds);
    if (rest === 0) return `0 ${words.find(([, size]) => size === seconds)?.[0] ?? "min"}`;
    const parts = [];
    for (const [word, size] of words) {
      const n = Math.floor(rest / size);
      rest -= n * size;
      if (n) parts.push(`${n} ${word}`);
    }
    return `${value < 0 ? "-" : ""}${parts.join(" ")}`;
  },
  sequencerTotal: (span) => `Totaal ${span}`,
  sequencerNow: (span) => `Nu, ${span}`,
  sequencerHint: "Sleep een stap om hem te verplaatsen, sleep aan de randen om de duur te veranderen · Enter pakt een stap op voor het toetsenbord",
  sequencerHintReadonly: "Kies een stap voor zijn tijden",
  sequencerItemHelp: "Druk op Enter om hem op te pakken en gebruik dan de pijltjestoetsen.",
  sequencerItem: (label, lane, start, length, partner) => `${label}, ${lane}, begint op ${start}, duurt ${length}${partner ? `, loopt samen met ${partner}` : ""}`,
  sequencerGrabbed: (label) => `${label} opgepakt. Pijltjes verplaatsen hem, Shift en pijltjes veranderen de duur, Alt en omhoog of omlaag wisselen van onderdeel, Enter zet hem neer, Escape zet hem terug.`,
  sequencerDropped: (summary) => `Neergezet. ${summary}`,
  sequencerCancelled: (label) => `${label} teruggezet.`,
  sequencerRefusedOverlap: (label, other) => `${label} kan daar niet heen: hij zou ${other} overlappen.`,
  sequencerRefusedEdge: (label) => `${label} kan die kant niet verder op.`,
  sequencerRefusedLocked: (label) => `${label} ligt vast.`,
  sequencerRefusedLink: (label) => `${label} kan niet samen lopen met die stap.`,
  sequencerPushed: (n) => (n === 1 ? "1 andere stap schoof mee." : `${n} andere stappen schoven mee.`),
  sequencerLinkStart: (label) => `Kies de stap waarmee ${label} samen loopt en druk op Enter. Escape stopt.`,
  sequencerLinked: (label, partner) => `${label} loopt nu samen met ${partner}.`,
  sequencerUnlinked: (label) => `${label} loopt weer los.`,
  sequencerSelectedNone: "Geen stap gekozen.",
  sequencerLinkButton: "Loopt samen met…",
  sequencerUnlinkButton: "Loopt los",
  sequencerLinkCancel: "Annuleren",
  sequencerReadout: (start, length) => `Op ${start}, ${length}`,
  sequencerReadoutRefused: "Niet hier",
};
