# Guide

## Using it

Open the app and log in. The bar has the places you go in the order of an
evening: **What do we eat?**, **When do I start?**, **Bad days**,
**Calm settings** and **Recipes**. A dish's own page and cook mode open
from a dish.

**Parents' wheel** is a page with only the wheel, for Kenny's parents: it
holds the dinners whose recipe has "On the parents' wheel" switched on. A tap
on the big wheel picks a dinner; when that recipe lists sides, the small
wheel spins with it and picks one, and a tap on the small wheel picks another
side. Both are set in a recipe's Edit dialog.

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

`/healthz` and `/metrics` are open; everything else needs the login. The
kit's own parts (login, update, notifications) are described in
[KIT.md](KIT.md).
