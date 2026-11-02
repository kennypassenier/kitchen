// The offline copy (feat-offline-kitchen): the kit's band toasts and logout question, the settings row and the recipe
// page's toggle, in English. Part of en.js; js/i18n/index.js merges the parts.

export const EN_OFFLINE = {
  // the kit's own words (offline/config.js kitMessages)
  "off.kitConflict": "An edit made offline was refused: it was changed elsewhere in the meantime. It waits in the list of refused edits; the other edits were sent.",
  "off.kitConflictHeld": "An edit made offline was refused: it was changed elsewhere in the meantime. Later edits wait until you decide.",
  "off.kitReview": "Review",
  "off.kitNearCap": (pct) => `The offline copy uses ${pct}% of its space on this device.`,
  "off.kitFull": "The offline copy is full: nothing new is kept offline until you clear it in Settings.",
  "off.kitRefused": "The kitchen answered with an error; your edits will be sent again.",
  "off.kitExpired": "You are signed out; your edits are sent once you sign in again.",
  // the kit's failed-edits drawer (chassis-rs 073273f; offline/config.js kitMessages)
  "off.kitFailedTitle": "Edits the kitchen refused",
  "off.kitFailedIntro": "These edits were made without a connection. When they were sent, the kitchen already had a newer version, so they were not saved. Discard one to keep the kitchen's version, or save it again to replace it.",
  "off.kitFailedClose": "Close the list of refused edits",
  "off.kitDiscard": "Discard",
  "off.kitSaveAgain": "Save again",
  "off.kitDiscardAll": "Discard all",
  "off.kitEmptyTitle": "No refused edits",
  "off.kitEmptyBody": "Everything you changed reached the kitchen.",
  "off.kitWhen": "Made",
  "off.kitWhy": "Why",
  "off.kitState": "Status",
  "off.kitStateFailed": "Set aside; later edits were sent",
  "off.kitStateHeld": "Waiting for you; later edits wait too",
  "off.kitReasonStale": "Changed elsewhere after you read it.",
  "off.kitReasonOther": "The kitchen did not accept this edit.",
  "off.kitVerbAdd": "Add",
  "off.kitVerbChange": "Change",
  "off.kitVerbDelete": "Delete",
  "off.kitConfirmTitle": (n) => `Discard ${n === 1 ? "this edit" : `all ${n} edits`}?`,
  "off.kitConfirmBody": "They are removed from this device and cannot be sent later.",
  "off.kitConfirmAccept": "Discard",
  "off.kitConfirmCancel": "Keep them",
  "off.kitCount": (n) => `${n} ${n === 1 ? "edit" : "edits"}`,
  "off.logoutTitle": "Sign out with edits that were not sent?",
  "off.logoutBody": (n) => `${n} ${n === 1 ? "edit was" : "edits were"} not sent to the kitchen yet. Signing out deletes ${n === 1 ? "it" : "them"} from this device.`,
  "off.logoutAccept": "Sign out anyway",
  "off.logoutStay": "Stay signed in",
  // a POST (new item, draft, import, Undo's restore) without a connection (api/http.js); a freezer take queues instead
  "api.needsConnection": "This needs a connection: something new gets its number from the kitchen. Nothing you typed is lost; try again once you are online.",
  // a kept recipe whose dish the kitchen no longer holds was dropped from the offline copy (api/recipe-gone.js)
  "off.goneRecipe": "This recipe is no longer in the kitchen and has been removed from your offline copy.",
};
