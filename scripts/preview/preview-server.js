// The kitchen server's JSON routes, answered inside the browser for the
// preview: the same answers as src/routes.rs, kept in localStorage.
(function () {
  var KEY = "kitchen-preview-v5";
  var SEED = __SEED__;
  var LISTS = ["recipes", "freezer", "shelf", "log", "resting", "dishes", "dish_categories", "ingredients", "ingredient_categories"];
  function load() {
    try { var s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
    return JSON.parse(JSON.stringify(SEED));
  }
  var data = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  function now() { return new Date().toISOString(); }
  function json(body, status) {
    return new Response(JSON.stringify(body), { status: status || 200, headers: { "Content-Type": "application/json" } });
  }
  function err(msg, status) { return json({ error: msg }, status); }
  var PAGES = { app: "kitchen", brand: { title: "Kitchen", href: "/" }, home: "/", pages: [
    ["wheel", "What do we eat?", "/"], ["timing", "When do I start?", "/timing"], ["baddays", "Bad days", "/bad-days"],
    ["settings", "Calm settings", "/settings"], ["recipes", "Recipes", "/recipes"], ["dishes", "Dishes", "/dishes"], ["parents", "Parents' wheel", "/parents"]
  ].map(function (p) { return { id: p[0], title: p[1], path: p[2], group: null, order: 0, nav: true, source: "app", render: "app" }; }) };
  // The parents' wheel in one language, as src/parents.rs `wheel` makes it: a dish or a side's ingredient shows in
  // each language it has a name in; a side keeps its Choice mark.
  function both(v, lang) {
    var s = v && String(v[lang] || "").trim();
    return s || null;
  }
  function byOrder(a, b) { return (a.order == null ? 1e9 : a.order) - (b.order == null ? 1e9 : b.order); }
  function wheel(lang) {
    var cats = data.dish_categories || [];
    var dishes = (data.dishes || []).filter(function (d) { return d.parents === true && both(d.name, lang); }).map(function (d) {
      var named = function (ids) {
        return (ids || []).map(function (id) {
          var ing = (data.ingredients || []).find(function (i) { return i.id === id; });
          return ing && both(ing.name, lang);
        }).filter(Boolean);
      };
      var and = lang === "nl" ? " en " : " and ";
      var sides = (d.sides || []).map(function (s) {
        var shown = named(s.ingredients);
        if (!shown.length) return null;
        var small = shown.map(function (n, i) { return i ? n.charAt(0).toLowerCase() + n.slice(1) : n; });
        var joined = small.length < 2 ? small[0] : small.slice(0, -1).join(", ") + and + small[small.length - 1];
        return { name: both(s.label, lang) || joined, ingredients: s.ingredients };
      }).filter(Boolean);
      var c = cats.find(function (x) { return x.id === d.category && both(x.name, lang); });
      return { id: d.id, name: both(d.name, lang), category: c ? c.id : null, ingredients: named(d.ingredients), sides: sides };
    }).sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
    var categories = cats.filter(function (c) { return both(c.name, lang); }).sort(byOrder).map(function (c) {
      return { id: c.id, name: both(c.name, lang), count: dishes.filter(function (d) { return d.category === c.id; }).length };
    }).filter(function (c) { return c.count > 0; });
    return { lang: lang, dishes: dishes, categories: categories };
  }
  var real = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    var url = new URL(typeof input === "string" ? input : input.url, location.href);
    var path = url.pathname;
    if (path === "/api/kit/pages") return json(PAGES);
    if (path === "/eten/data") return json(wheel("nl"));
    if (path === "/data/wheel/en") return json(wheel("en"));
    if (path.indexOf("/data/") !== 0) return real(input, init);
    var method = ((init && init.method) || "GET").toUpperCase();
    var body = init && init.body ? JSON.parse(init.body) : undefined;
    var parts = path.split("/").slice(2).map(decodeURIComponent);
    await new Promise(function (r) { setTimeout(r, 250); });
    if (parts[0] === "kitchen") return json(data);
    if (parts[0] === "settings") {
      if (method === "PATCH") { for (var k in body) { if (body[k] === null) delete data.settings[k]; else data.settings[k] = body[k]; } save(); }
      return json(data.settings);
    }
    if (parts[0] === "freezer" && parts[2] === "take") {
      var f = data.freezer.find(function (x) { return x.id === parts[1]; });
      if (!f) return err("that item does not exist (any more)", 404);
      var left = (f.portions || 0) - ((body && body.portions) || 1);
      if (left < 0) return err("there are no portions of that dish left", 409);
      f.portions = left; save(); return json(f);
    }
    var list = data[parts[0]];
    if (LISTS.indexOf(parts[0]) < 0) return err("there is no list called " + parts[0], 404);
    if (parts.length === 1) {
      if (method === "POST") { var item = Object.assign({}, body, { id: crypto.randomUUID(), created: now() }); list.push(item); save(); return json(item); }
      return json(list);
    }
    var at = list.findIndex(function (x) { return x.id === parts[1]; });
    if (at < 0) return err("that item does not exist (any more)", 404);
    if (method === "DELETE") { var gone = list.splice(at, 1)[0]; save(); return json(gone); }
    if (method === "PUT") { var next = Object.assign({}, body, { id: parts[1], created: list[at].created, updated: now() }); list[at] = next; save(); return json(next); }
    return err("unknown request", 400);
  };
})();
