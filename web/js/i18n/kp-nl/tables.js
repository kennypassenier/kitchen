// The package's Dutch words for the data table.
// Part of kp-nl.js (split by component family on 30/10/2026, docs/agent/MODULARITY.md).

export const KP_NL_TABLES = {
  // data table
  tableSelectAll: "Selecteer elke rij op deze pagina",
  tableSelectRow: (key) => `Selecteer rij ${key}`,
  tableEmpty: "Niets gevonden.",
  tablePage: (at, of) => `${at} / ${of}`,
  tableRegion: "Tabel",
  tableSearchScope: "Zoek in",
  tableSearchAllColumns: "Alle kolommen",
  tableFilters: (active) => (active > 0 ? `Filters (${active})` : "Filters"),
  tableFiltersLabel: "Filters",
  tableActiveFilters: "Actieve filters",
  tableFilterValue: (column, value) => `${column}: ${value}`,
  tableFilterRange: (column, from, to) => `${column}: ${from}–${to}`,
  tableFilterOpenEnd: "elk",
  tableFilterFrom: (column) => `${column}, van`,
  tableFilterTo: (column) => `${column}, tot`,
  tableRemoveFilter: (label) => `Filter ${label} verwijderen`,
  tableClearFilters: "Wis alle filters",
  keysLabel: "Sneltoetsen",
  tableAddFilter: (active) => (active > 0 ? `+ Filter toevoegen (${active} actief)` : "+ Filter toevoegen"),
  tableAddFilterMenu: "Filter op kolom",
  tableAddFilterItem: (column) => `Filter op ${column}`,
  tableAddFilterItemActive: (column) => `${column}, al gefilterd: pas dat filter aan`,
  tableFilterMarked: "gefilterd",
  tableFilterEditor: (column) => `Filter op ${column}`,
  tableFilterChoicesLegend: (column) => `Toon rijen waarvan ${column.toLowerCase()} gelijk is aan`,
  tableFilterBound: (kind, bound, column) => {
    if (kind === "date") return bound === "from" ? `${column} op of na` : `${column} op of voor`;
    return bound === "from" ? "Van" : "Tot";
  },
  tableFilterChoicePill: (column, values) => `${column}: ${values.join(", ")}`,
  tableFilterSpanPill: (column, from, to, kind) => {
    if (from !== "" && to !== "") return `${column}: ${from}${kind === "date" ? " tot " : "–"}${to}`;
    if (from !== "") return `${column}: vanaf ${from}`;
    return `${column}: tot ${to}`;
  },
  tableEditFilter: (label) => `Filter ${label} aanpassen`,
  tableFilterApply: "Toepassen",
  tableFilterCancel: "Annuleren",
  tableFilterClearAll: "Alles wissen",
  tableFilterNotNumber: (label, value) => `${label} neemt een getal, zoals 10; "${value}" is er geen.`,
  tableFilterNotDate: (label, value) => `${label}: "${value}" is geen datum die dit veld kan lezen; schrijf hem zoals het veld hem toont, of gebruik de kalender.`,
  tableFilterBackwards: (from, to) => `Het bereik loopt achterstevoren: van ${from} tot ${to}. Wissel de twee waarden om.`,
  tableDensity: "Dichtheid",
  tableDensityComfortable: "Ruim",
  tableDensityCompact: "Compact",
  tableRowsPerPage: "Rijen per pagina",
  tableShowing: (from, to, count, total) => {
    if (count === 0) return `Toont 0 van ${total}`;
    if (count === total) return `Toont ${from}–${to} van ${total}`;
    return `Toont ${from}–${to} van ${count} (gefilterd uit ${total})`;
  },
  tableSelected: (n) => `${n} geselecteerd`,
  tableSortBy: "Sorteer op",
  tableSortNone: "Geen",
  tableSortAscending: "Oplopend",
  tableSortDescending: "Aflopend",
  tableFailed: "De rijen konden niet geladen worden.",
  tableRetry: "Probeer opnieuw",
  tableSortKey: (column, direction, kind) => {
    const up = direction === "ascending";
    if (kind === "number" || kind === "order") return `${column} ${up ? "laag naar hoog" : "hoog naar laag"}`;
    if (kind === "date") return `${column} ${up ? "oudste eerst" : "nieuwste eerst"}`;
    return `${column} ${up ? "A tot Z" : "Z tot A"}`;
  },
  tableSortedBy: (keys) => `Gesorteerd op ${keys.join(", dan ")}.`,
  tableNotSorted: "Niet gesorteerd.",
  tableSortReset: "Sortering herstellen",
  tableBusyElapsed: (seconds) => (seconds < 60 ? `${seconds} s tot nu toe` : `${Math.floor(seconds / 60)} min ${seconds % 60} s tot nu toe`),
  tableColumns: "Kolommen",
  tableColumnsLabel: "Zichtbare kolommen",
  tableColumnLocked: (column) => `${column} (altijd zichtbaar)`,
  tableShowAllColumns: "Toon elke kolom",
  tableColumnsShown: (shown, total) => `${shown} van ${total} kolommen getoond`,
  tableDetailsColumn: "Details",
  tableRowDetails: (key) => `Details van ${key}`,
  tableReorderColumn: "Rij verplaatsen",
  tableReorderRow: (name) => `Verplaats ${name} (Alt+Omhoog of Alt+Omlaag)`,
  tableReorderOff: "Wis de sortering, de filters en de zoekopdracht om de rijen te herordenen",
  tableGroupRows: (group, count) => `${group}: ${count} ${count === 1 ? "rij" : "rijen"}`,
  tableEdit: (column, key, value) => `${column} van ${key}: ${value}. Bewerken`,
  tableEditField: (column, key) => `${column} van ${key}`,
  tableEditing: (column, key) => `${column} van ${key} wordt bewerkt. Druk op Enter om te bewaren, of op Escape om te annuleren.`,
  tableEdited: (key, column, before, after) => `${key}: ${column} veranderd van ${before} naar ${after}.`,
  tableEditUndone: (key, column, value) => `Ongedaan gemaakt: ${key} ${column} is weer ${value}.`,
  tableEditCancelled: "Bewerking geannuleerd; er is niets veranderd.",
  tableEditRequired: "Een waarde is verplicht.",
  tableEditInvalid: "Deze waarde kan niet bewaard worden.",
  tableGridStart: "Tab de tabel in om te beginnen.",
  tableGridPosition: (row, rows, column, text) => `${row === 0 ? "Kopregel" : `Rij ${row} van ${rows}`}, kolom ${column}: ${text}`,
};
