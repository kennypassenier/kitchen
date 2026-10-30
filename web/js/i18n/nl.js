// Every word Kitchen's own screens show, in Dutch (Kenny, 24/10/2026 05:12). The same keys as ./en.js; a key missing
// here falls back to English (js/i18n/index.js).

import { NL_SHELL } from "./nl/shell.js";
import { NL_RECORDS } from "./nl/records.js";
import { NL_ITEM } from "./nl/item.js";
import { NL_ARTICLE } from "./nl/article.js";
import { NL_LOG } from "./nl/log.js";
import { NL_SOURCES } from "./nl/sources.js";
import { NL_INGREDIENTS_DISHES } from "./nl/ingredients-dishes.js";
import { NL_DISH_EDITOR } from "./nl/dish-editor.js";
import { NL_LATER } from "./nl/later.js";

export const NL = {
  ...NL_SHELL,
  ...NL_RECORDS,
  ...NL_ITEM,
  ...NL_ARTICLE,
  ...NL_LOG,
  ...NL_SOURCES,
  ...NL_INGREDIENTS_DISHES,
  ...NL_DISH_EDITOR,
  ...NL_LATER,
};
