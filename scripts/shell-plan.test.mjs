// The bar's split between the five daily places and the More menu. Run: node scripts/shell-plan.test.mjs
import assert from "node:assert/strict";
import { splitBar, FALLBACK, MORE_GROUP } from "../web/js/shell/plan.js";

const page = (id, group, nav) => ({ id, title: id, path: `/${id}`, group, nav });

{
  const { bar, more } = splitBar([page("wheel"), page("dishes", MORE_GROUP), page("recipe", "Recipes", false), page("storage", MORE_GROUP), page("log")]);
  assert.deepEqual(bar.map((p) => p.id), ["wheel", "log"], "a hidden page and a More page are not in the bar");
  assert.deepEqual(more.map((p) => p.id), ["dishes", "storage"], "More keeps the registry order");
}
{
  // A page of another group (the hidden recipe pages are "Recipes") that is listed stays in the bar.
  assert.deepEqual(splitBar([page("x", "Recipes")]).bar.map((p) => p.id), ["x"]);
}
{
  const { bar, more } = splitBar(FALLBACK);
  assert.equal(bar.length, 5);
  assert.equal(more.length, 5);
}
console.log("shell-plan: ok");
