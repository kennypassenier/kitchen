// The offline copy (feat-offline-kitchen): the kit's band toasts and logout question, the settings row, the recipe
// page's toggle and the list of edits the kitchen refused, in English. Part of en.js; js/i18n/index.js merges the parts.

export const EN_OFFLINE = {
  // the kit's own words (offline/config.js kitMessages)
  "off.kitConflict": "An edit made offline was refused: it was changed elsewhere in the meantime. It waits in the list of refused edits; the other edits were sent.",
  "off.kitConflictHeld": "An edit made offline was refused: it was changed elsewhere in the meantime. Later edits wait until you decide.",
  "off.kitReview": "Review",
  "off.kitNearCap": (pct) => `The offline copy uses ${pct}% of its space on this device.`,
  "off.kitFull": "The offline copy is full: nothing new is kept offline until you clear it in Settings.",
  "off.kitRefused": "The kitchen answered with an error; your edits will be sent again.",
  "off.kitExpired": "You are signed out; your edits are sent once you sign in again.",
  "off.logoutTitle": "Sign out with edits that were not sent?",
  "off.logoutBody": (n) => `${n} ${n === 1 ? "edit was" : "edits were"} not sent to the kitchen yet. Signing out deletes ${n === 1 ? "it" : "them"} from this device.`,
  "off.logoutAccept": "Sign out anyway",
  "off.logoutStay": "Stay signed in",
  // a POST (new item, draft, import, freezer portion, Undo's restore) without a connection (api/http.js)
  "api.needsConnection": "This needs a connection: something new gets its number from the kitchen. Nothing you typed is lost; try again once you are online.",
  // the refused edits (offline/failed-list.js)
  "off.failedTitle": "Edits the kitchen refused",
  "off.failedText": "These edits were made without a connection. When they were sent, the kitchen already had a newer version, so they were not saved. Keep the kitchen's version, or save yours over it.",
  "off.failedEmpty": "No refused edits. Everything you changed reached the kitchen.",
  "off.failedClose": "Close the list of refused edits",
  "off.failedWhen": (when) => `Made ${when}`,
  "off.failedWhyStale": "Changed elsewhere after you read it.",
  "off.failedWhyOther": (words) => `The kitchen said: ${words}`,
  "off.failedDrop": "Keep the kitchen's version",
  "off.failedDropHint": "Your edit is thrown away; the page shows what the kitchen has.",
  "off.failedResave": "Save mine over it",
  "off.failedResaveHint": "Your edit is sent again and replaces the kitchen's newer version.",
  "off.failedDropped": "Your edit was thrown away.",
  "off.failedResaved": "Your edit is being sent again.",
  "off.failedActionFailed": (words) => `That did not work. ${words}`,
  "off.failedReadFailed": "The list of refused edits could not be read on this device.",
  "off.whatSettings": "Your settings",
  "off.whatChange": (what) => `Change to ${what}`,
  "off.whatDelete": (what) => `Delete of ${what}`,
  "off.whatItem": (list, name) => `${list} “${name}”`,
  "off.whatUnknown": "An item that is no longer in the kitchen",
};
