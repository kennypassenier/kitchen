// Every word Kitchen's own screens show, in English (the default). Keys are "<place>.<what>"; a word that depends on a
// number or a name is a function. ./nl.js has the same keys in Dutch; js/i18n/index.js reads both.

import { EN_SHELL } from "./en/shell.js";
import { EN_RECORDS } from "./en/records.js";
import { EN_ITEM } from "./en/item.js";
import { EN_ARTICLE } from "./en/article.js";
import { EN_LOG } from "./en/log.js";
import { EN_SOURCES } from "./en/sources.js";
import { EN_INGREDIENTS_DISHES } from "./en/ingredients-dishes.js";
import { EN_DISH_EDITOR } from "./en/dish-editor.js";
import { EN_LATER } from "./en/later.js";

export const EN = {
  ...EN_SHELL,
  ...EN_RECORDS,
  ...EN_ITEM,
  ...EN_ARTICLE,
  ...EN_LOG,
  ...EN_SOURCES,
  ...EN_INGREDIENTS_DISHES,
  ...EN_DISH_EDITOR,
  ...EN_LATER,
};
