# Guide

## Using it

Open the app and log in. The bar has the places you go in the order of an
evening: **What do we eat?**, **When do I start?**, **Bad days**,
**Calm settings**, **Recipes** and **Dishes**. A recipe's own page and cook
mode open from a recipe.

**Dishes** is what lands on a plate, kept apart from the recipes: each dish
has a Dutch and an English name, a category and its parts. A part is a kind
from the "Kinds of part" list (potatoes and co., vegetables, sauce, …) with
the choices for this dish: stoofvlees comes with potatoes, fries, croquettes
or mash; spaghetti bolognese has no parts. The kinds and the categories
("Everyday", "Special", "Festive") are lists of their own on the same page,
so a new kind or category is one Add away. A dish, a kind, a category or a
choice without both names shows on neither wheel; the Wheel column says what
is missing.

**The parents' wheel** picks from the dishes with "On the parents' wheel"
switched on. The big wheel picks the dish; each of its parts with two or more
choices is then picked by the small wheel, one after the other, and the
sentence under the wheels says the whole dinner ("Vanavond: Biefstuk, met
frieten, sla en bearnaise."). A tap on the small wheel picks again for the
part it shows; the category chips narrow the big wheel. Kenny's parents open
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
directory. A new state directory is filled with sample dishes on first start.
The Storage page shows how much room the databases take.

On the homelab, `/etc/kitchen/kitchen.env` carries
`KITCHEN_TRUSTED_ADMINS=10.10.10.10`, so Kenny's PC is let in without a
login (Kenny, 22/10/2026). It only works for a request that reaches the
container straight from that address, not through Traefik.

`KITCHEN_PARENTS_HOST=eten.kp-soft.dev` keeps that host to the parents'
wheel: its root opens the Dutch wheel, `/eten…`, `/static/…` and `/healthz`
pass, and every other path leads back to the wheel, so the login page cannot
be reached there. The homelab points both hosts at the same container
(kitchen.kp-soft.dev with the login, eten.kp-soft.dev without), and
eten.kp-soft.dev must not sit behind Cloudflare Access. All the page reads is
`/eten/data`: the names, categories and parts of the dishes on the wheel,
nothing else.

`/healthz`, `/metrics` and the parents' wheel (`/eten`) are open; everything
else needs the login. The
kit's own parts (login, update, notifications) are described in
[KIT.md](KIT.md).
