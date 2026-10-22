// The kitchen server's JSON routes, answered inside the browser for the
// preview: the same answers as src/routes.rs, kept in localStorage.
(function () {
  var KEY = "kitchen-preview-v1";
  var SEED = __SEED__;
  var LISTS = ["recipes", "freezer", "shelf", "log", "resting"];
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
    ["settings", "Calm settings", "/settings"], ["recipes", "Recipes", "/recipes"], ["parents", "Parents' wheel", "/parents"]
  ].map(function (p) { return { id: p[0], title: p[1], path: p[2], group: null, order: 0, nav: true, source: "app", render: "app" }; }) };
  var real = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    var url = new URL(typeof input === "string" ? input : input.url, location.href);
    var path = url.pathname;
    if (path === "/api/kit/pages") return json(PAGES);
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
