// The facts of an item, as [key, value] rows, per list.

import { ingredientName } from "../../api.js";
import { h } from "../../dom.js";
import { externalLink, hostOf } from "../../links.js";
import { itemLink, energies, feelings, logWhat, sideName, dishHas } from "../../records/index.js";
import { t, textOf } from "../../i18n/index.js";
import { dmy, brusselsDay } from "../../format.js";
import { names, languages, ordered } from "../../dishes/editor.js";
import { ingLink, linkList, dishLink, stamps, inRecipe } from "./links.js";

/** @typedef {import("../../api.js").Kitchen} Kitchen */
/** @typedef {import("../../records/index.js").List} List */
/** @typedef {Record<string, any>} Item */

/**
 * The facts of an item, as [key, value] rows.
 * @param {Exclude<List, "recipes">} list @param {Item} item @param {Kitchen} k
 * @returns {[string, Node | string][]}
 */
export function facts(list, item, k) {
  switch (list) {
    case "dishes": {
      const n = names(item);
      const cat = k.dish_categories.find((c) => c.id === item.category);
      const on = languages(item);
      const sides = /** @type {Item[]} */ (item.sides ?? []);
      return [
        [t("rec.dutchName"), n.nl || "–"],
        [t("rec.englishName"), n.en || "–"],
        [t("rec.category"), cat ? itemLink("dish_categories", cat) : t("it.noCategory")],
        [t("it.parentsWheel"), t(item.parents !== true ? "it.wheelOff" : on === "both" ? "it.wheelBoth" : on === "nl" ? "it.wheelNl" : "it.wheelEn")],
        [t("nav.recipes"), String((item.recipes ?? []).length)],
        [t("it.always"), linkList(/** @type {string[]} */ (item.ingredients ?? []).map((id) => ingLink(k, id)), t("it.nothingFixed"))],
        [
          t("it.sides"),
          sides.length
            ? h(
                "ol",
                { class: "it-links" },
                ...sides.map((s) => {
                  const own = String(s.label?.en || s.label?.nl || "").trim();
                  const ids = /** @type {string[]} */ (s.ingredients ?? []);
                  return h("li", null, own ? `${own}: ` : "", ...ids.flatMap((id, i) => [i ? (i === ids.length - 1 ? ` ${t("common.and")} ` : ", ") : "", ingLink(k, id)]));
                }),
              )
            : t("it.noSides"),
        ],
        [t("it.smallWheel"), sides.length > 1 ? t("it.picksOne", sides.length, sides.map(sideName).join("; ")) : t(sides.length === 1 ? "it.oneSide" : "it.noSpin")],
        ...stamps(item),
      ];
    }
    case "dish_categories": {
      const n = names(item);
      const dishes = k.dishes.filter((d) => d.category === item.id);
      return [
        [t("rec.dutchName"), n.nl || "–"],
        [t("rec.englishName"), n.en || "–"],
        [t("it.position"), String(ordered(k.dish_categories).findIndex((c) => c.id === item.id) + 1)],
        [t("nav.dishes"), linkList(dishes.map((d) => itemLink("dishes", d)), t("it.noDishUses"))],
        ...stamps(item),
      ];
    }
    case "ingredients": {
      const n = names(item);
      const cat = k.ingredient_categories.find((c) => c.id === item.category);
      return [
        [t("rec.dutchName"), n.nl || "–"],
        [t("rec.englishName"), n.en || "–"],
        [t("rec.category"), cat ? itemLink("ingredient_categories", cat) : t("it.noCategory")],
        [t("nav.dishes"), String(k.dishes.filter((d) => dishHas(d, item.id)).length)],
        [t("it.inRecipes"), String(k.dishes.filter((d) => inRecipe(d, item.id)).length)],
        ...stamps(item),
      ];
    }
    case "ingredient_categories": {
      const n = names(item);
      const ings = k.ingredients.filter((i) => i.category === item.id).sort((a, b) => ingredientName(a.id).localeCompare(ingredientName(b.id)));
      return [
        [t("rec.dutchName"), n.nl || "–"],
        [t("rec.englishName"), n.en || "–"],
        [t("it.position"), String(ordered(k.ingredient_categories).findIndex((c) => c.id === item.id) + 1)],
        [t("nav.ingredients"), linkList(ings.map((i) => itemLink("ingredients", i)), t("it.noIngIn"))],
        ...stamps(item),
      ];
    }
    case "freezer": {
      const at = Date.parse(item.frozen_on);
      const days = Math.floor((Date.now() - at) / 86_400_000);
      return [
        [t("rec.dish"), textOf(item.dish)],
        [t("rec.dishLink"), item.dish_id ? dishLink(item.dish_id) : t("rec.noDish")],
        [t("it.portionsLeft"), String(item.portions)],
        [t("rec.frozenOn"), dmy(brusselsDay(item.frozen_on))],
        [t("it.inFreezerFor"), Number.isFinite(days) ? t("it.days", Math.max(0, days)) : "–"],
        ...stamps(item),
      ];
    }
    case "shelf": {
      const eaten = k.log.filter((e) => e.shelf_id === item.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return [
        [t("rec.name"), textOf(item.title)],
        [t("rec.whatToDo"), textOf(item.text) || "–"],
        [t("rec.minutes"), String(item.minutes ?? 0)],
        [t("rec.gear"), textOf(item.gear) || "–"],
        [t("rec.energy"), energies()[item.energy] ?? "–"],
        [t("it.eaten"), linkList(eaten.map((e) => itemLink("log", e, dmy(e.date))), t("it.notLogged"))],
        ...stamps(item),
      ];
    }
    case "recipe_sources": {
      return [
        [t("src.name"), item.name],
        [t("src.url"), externalLink(item.url, hostOf(item.url))],
        [t("src.language"), t(`src.${item.language === "nl" ? "nl" : "en"}`)],
        [t("src.comes"), textOf(item.note) || "–"],
        [t("src.verified"), item.verified ? dmy(item.verified) : t("src.none")],
        [t("src.how"), item.verified_by || "–"],
        ...stamps(item),
      ];
    }
    case "log": {
      const shelf = item.shelf_id ? k.shelf.find((s) => s.id === item.shelf_id) : null;
      return [
        [t("rec.what"), item.shelf_id ? (shelf ? itemLink("shelf", shelf) : logWhat(item)) : dishLink(item.dish_id)],
        [t("it.kind"), t(item.shelf_id ? "it.kindShelf" : "it.kindRecipe")],
        [t("rec.day"), dmy(item.date)],
        [t("rec.howFelt"), item.feeling ? (feelings()[item.feeling] ?? item.feeling) : t("rec.noAnswer")],
        [t("rec.note"), item.note || "–"],
        ...stamps(item),
      ];
    }
    case "resting": {
      const back = item.until ? new Date(Date.parse(`${item.until}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : "";
      return [
        [t("rec.dish"), dishLink(item.dish_id)],
        [t("rec.restingUntil"), dmy(item.until)],
        [t("it.back"), back ? dmy(back) : "–"],
        ...stamps(item),
      ];
    }
  }
}

