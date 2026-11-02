// The package's Dutch words for the connection band (kp-themes connection.js), which shows the offline copy's state
// (feat-offline-kitchen). Part of kp-nl.js; a function keeps the parameters of the English one.

export const KP_NL_CONNECTION = {
  connOffline: "Je bent offline",
  connOfflineWhy: "Wijzigingen worden hier bewaard en verstuurd zodra de verbinding terug is.",
  connReconnecting: "Opnieuw verbinden…",
  connReconnectingWhy: "De keuken wordt nu opnieuw geprobeerd.",
  connAttempt: (n) => `Poging ${n}`,
  connNextTry: (duration) => `volgende poging over ${duration}`,
  connPending: (n) => `${n} ${n === 1 ? "wijziging wacht" : "wijzigingen wachten"}`,
  connBack: "Weer verbonden",
  connBackWhy: "Alles is bijgewerkt.",
  connBackSending: (n) => `${n} ${n === 1 ? "wijziging wordt" : "wijzigingen worden"} verstuurd.`,
  connRefused: "De keuken nam dit niet aan",
  connRefusedWhy: "Je bent online, maar de keuken weigerde het verzoek. Er is niets verloren; probeer zo opnieuw.",
  connRetry: "Nu opnieuw proberen",
};
