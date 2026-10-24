# Guide

## Using it

Open the app and log in. The bar has the places you go in the order of an
evening: **What do we eat?**, **When do I start?**, **Bad days**,
**Calm settings**, **Recipes** and **Dishes**. A recipe's own page and cook
mode open from a recipe.

**Dishes** is what lands on a plate, kept apart from the recipes: each dish
has a Dutch and an English name, a category, the ingredients that always
come with it and its sides. A side is one or more ingredients that go
together, with an optional label of its own: stoofvlees comes with salad
every time and with "frieten en mayonaise" or "kroketten met mayonaise" as
its two sides; spaghetti bolognese has none. The categories ("Everyday",
"Special") are a list of their own on the same page.

**Ingredients** is one list for the whole kitchen: a dish's ingredients and
sides and a recipe's lines are picked from it, and a name that is not there
yet is added right in the field ("Add “…” as a new ingredient", with its
category). An ingredient's page shows every dish and recipe with it, with a
search and filters, and a wheel that picks among those dishes. A name only needs one language: a dish
without a Dutch name is missing only from the Dutch wheel, one without an
English name only from the English wheel. The Wheel column says on which
wheels the dish shows.

**The parents' wheel** picks from the dishes with "On the parents' wheel"
switched on. The big wheel picks the dish; the small wheel then picks one
of its sides, when there are two or more. The ingredients that always come
with the dish are never spun. The sentence under the wheels says the whole
dinner ("Vanavond: Biefstuk, met frieten, sla en
bearnaise."). A tap on the small wheel picks the side again; the category chips narrow the big wheel. Kenny's parents open
it in Dutch on **eten.kp-soft.dev**, without an account; Kitchen shows the
same wheel in English under **Parents' wheel**.

## Running it

kitchen is one binary with its screens built in. Configuration comes from
flags, `KITCHEN_*` environment variables and `<state dir>/config.toml`
(`kitchen --help` lists every knob, `kitchen --check` validates). The
admin token and the secret key come from the environment only
(`kitchen gen-secret`).

The recipes, the bad-days freezer and the calm settings are
`<state dir>/kitchen.json`. Next to it the kit keeps two databases:
`kitchen-kit.db` (login sessions and passkeys) and `kitchen.db` (the browser
choices that follow you between devices, such as the timing page's numbers
and where cook mode stands). The homelab's backup takes the whole state
directory. A new state directory starts with no recipes or dishes: only the two categories
("Dagelijkse kost", "Speciaal"); Kenny enters the real recipes and dishes.
The Storage page shows how much room the databases take.

On the homelab, `/etc/kitchen/kitchen.env` carries
`KITCHEN_TRUSTED_ADMINS=10.10.10.10`, so Kenny's PC is let in without a
login (Kenny, 22/10/2026). It only works for a request that reaches the
container straight from that address, not through Traefik.

`KITCHEN_PARENTS_HOST=eten.kp-soft.dev` keeps that host to the parents'
wheel: its root opens the Dutch wheel, `/eten…`, `/static/…` and `/healthz`
pass, and every other path leads back to the wheel, so the login page cannot
be reached there. The wheel only answers the home network:
`KITCHEN_PARENTS_ALLOW` (default `10.10.10.0/24`, a comma list of addresses
and ranges) names who may open it, everyone else gets a short Dutch
"only at home" page. Behind Traefik that check needs the real visitor's
address, so `KITCHEN_TRUSTED_PROXIES` must list Traefik's address; without
it Traefik's own home address would let everyone in.

The homelab points both hosts at the same container. kitchen.kp-soft.dev is
for Kenny, with the login, behind Cloudflare Access. eten.kp-soft.dev is
for his parents, without an account and without Cloudflare: it has no public
DNS record, only a host override on the home router pointing it at Traefik,
and Traefik allows only 10.10.10.0/24 on that router (Kenny, 22/10/2026).
All the page reads is `/eten/data`: the names, categories and parts of the
dishes on the wheel, nothing else.

`/healthz`, `/metrics` and the parents' wheel (`/eten`) are open; everything
else needs the login. The
kit's own parts (login, update, notifications) are described in
[KIT.md](KIT.md).
