// Minutes in words, with the calling page's own two words (moved out of format.js so that module stays free of the
// browser-only i18n import and node tests can load it).

import { t } from "./index.js";

/** Minutes in words with the page's own two words: "50 minutes" or "1 h 18 min". @param {number} m @param {string} hmKey @param {string} minKey */
export const minutesWords = (m, hmKey, minKey) => (m >= 60 ? t(hmKey, Math.floor(m / 60), m % 60) : t(minKey, m));
