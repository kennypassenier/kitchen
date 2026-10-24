# Kitchen

A recipe app for someone with AuDHD who forgets how dishes go, freezes on
"what do we eat?", loses the thread while cooking and has days with no
energy at all. It takes over choice, sequence and time, without pressure.

Release 0.1 holds five things, each approved as a screen design by Kenny on
19/10/2026:

| Screen | What it does for you |
|---|---|
| What do we eat? (`/`) | A wheel picks tonight's dish; filters, "no energy today", and "not this one this week" |
| Cook mode (`/cook`) | Gather everything first, then one step at a time, with parallel tracks (pasta while the sauce cooks), timers and a band that says what to do when one ends |
| When do I start? (`/timing`) | Counts back from dinner time: when each track starts, a disc that shrinks, one gentle nudge |
| Bad days (`/bad-days`) | Safe dishes, the freezer with Undo, a zero-prep shelf, mini recipes |
| Recipe and calm settings (`/recipe`, `/recipes`, `/settings`) | The recipe with scaling, QR to the phone, print, the cooking log; calm mode, theme, kitchen settings |

The name is Kenny's own answer to the name form (19/10/2026).

## Run it locally

```bash
kitchen gen-secret            # on a terminal: two lines for the env file
KITCHEN_TOKEN=… KITCHEN_SECRET_KEY=… KITCHEN_STATE_DIR=/tmp/kitchen \
  KITCHEN_WEB_DIR=$PWD/web cargo run -- --listen 127.0.0.1:8080
```

Log in on http://127.0.0.1:8080 with the token. A new state directory is
empty but for the two dish categories and the default dinner time. `KITCHEN_WEB_DIR` serves the screens from disk
so a changed file shows on reload; without it the copy in the binary is
served.

More: [docs/GUIDE.md](docs/GUIDE.md) (using and running it),
[docs/DECISIONS.md](docs/DECISIONS.md), [docs/OPEN.md](docs/OPEN.md), and
for the kit's own parts [docs/KIT.md](docs/KIT.md).
