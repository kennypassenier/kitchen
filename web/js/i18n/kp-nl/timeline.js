// The package's Dutch words for the run timeline (gantt).
// Part of kp-nl.js (split by component family on 30/10/2026, docs/agent/MODULARITY.md).

export const KP_NL_TIMELINE = {
  // run timeline (gantt)
  ganttGroup: "Tijdlijn",
  ganttRange: "Bereik",
  ganttRangeTitle: (label) => `Toon ${label}`,
  ganttNow: "nu",
  ganttSelection: "Geselecteerd",
  ganttClear: "Wissen",
  ganttClearTitle: "Heft het geselecteerde bereik op",
  ganttSelected: (from, to) => `${from} tot ${to}`,
  ganttEmpty: "Geen uitvoering in dit venster.",
  ganttLoading: "De geschiedenis wordt gelezen",
  ganttQueued: "wacht",
  ganttRunning: "loopt",
  ganttOk: "gelukt",
  ganttFailed: "mislukt",
  ganttAnnounce: (label, state) => `${label}: ${state}`,
  ganttBar: (label, when, state) => `${label}, ${when}, ${state}`,
  ganttLive: "Live",
  ganttLiveTitle: "Volg nu: het venster beweegt met de klok",
  ganttZoom: "Inzoomen",
  ganttZoomTitle: "Maak het geselecteerde bereik het venster",
  ganttDuration: (seconds) => {
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} u ${rest} min` : `${hours} u`;
  },
  ganttHint: "Klik op een balk om hem te openen · sleep over de tijd om een bereik te selecteren",
  ganttHintOpen: "Klik op een balk om hem te openen",
  ganttAll: "Alles",
  ganttAllTitle: "Toon alles op de tijdlijn",
  ganttPoint: (label, when) => `${label}, ${when}`,
  ganttPlanned: "gepland",
  ganttCluster: (count, labels) => `${count} gebeurtenissen: ${labels}`,
  ganttClusterMore: (more) => `+${more}`,
  ganttPointsHint: "Wijs een merkteken aan om het te lezen · pijlen lopen langs de tekens · Enter opent er een",
};
