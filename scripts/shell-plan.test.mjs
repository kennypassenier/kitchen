// The bar's split between the five daily places and the More menu. Run: node scripts/shell-plan.test.mjs
import assert from "node:assert/strict";
import { splitBar, FALLBACK } from "../web/js/shell/plan.js";

const page = (id, group, nav, secondary) => ({ id, title: id, path: `/${id}`, group, nav, secondary });

{
  const { bar, more } = splitBar([page("wheel"), page("dishes", null, true, true), page("recipe", "Recipes", false), page("storage", null, true, true), page("log")]);
  assert.deepEqual(bar.map((p) => p.id), ["wheel", "log"], "a hidden page and a More page are not in the bar");
  assert.deepEqual(more.map((p) => p.id), ["dishes", "storage"], "More keeps the registry order");
}
{
  // A page of a group (the hidden recipe pages are "Recipes") that is listed and not secondary stays in the bar.
  assert.deepEqual(splitBar([page("x", "Recipes")]).bar.map((p) => p.id), ["x"]);
  // The group no longer decides: only the kit's `secondary` flag puts a page behind More (chassis-rs 4.2.0).
  assert.deepEqual(splitBar([page("y", "More")]).more.map((p) => p.id), []);
}
{
  const { bar, more } = splitBar(FALLBACK);
  assert.equal(bar.length, 5);
  assert.equal(more.length, 5);
}
console.log("shell-plan: ok");
