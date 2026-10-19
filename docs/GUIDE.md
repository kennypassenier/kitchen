# Guide

## Using it

Open the app and log in. The bar has the places you go in the order of an
evening: **What do we eat?**, **When do I start?**, **Bad days**,
**Calm settings** and **Recipes**. A dish's own page and cook mode open
from a dish.

## Running it

kitchen is one binary with its screens built in. Configuration comes from
flags, `KITCHEN_*` environment variables and `<state dir>/config.toml`
(`kitchen --help` lists every knob, `kitchen --check` validates). The
admin token and the secret key come from the environment only
(`kitchen gen-secret`).

Everything the app knows is `<state dir>/kitchen.json`: back up that one
file. A new state directory is filled with sample dishes on first start.

`/healthz` and `/metrics` are open; everything else needs the login. The
kit's own parts (login, update, notifications) are described in
[KIT.md](KIT.md).
