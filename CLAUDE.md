# Kitchen

AuDHD-friendly recipe app (Life sub-project): Rust on chassis-rs + plain
ES modules on kp-themes, which comes only through chassis-rs (`/static/kp/`, Kenny 19/10/2026). Owner Kenny; chat Dutch, code and docs English.

State (02/11/2026): 5.0.0 released and signed (chassis 4.0.0, kp-themes 12.0.0); main is on chassis 4.2.0 (pinned to rev b08ecab for `kp_modules()` and the gzip prefs fix) / kp-themes 12.2.0 split delivery, unreleased; live is still 4.1.0,
the deploy waits on the homelab thread (docs/OPEN.md).

Read first: README.md, docs/OPEN.md, docs/DECISIONS.md. Data shapes:
docs/agent/DATA.md. Screen designs (approved, implement exactly):
kp-themes `research/audhd-recepten/` with `grid-fix/` winning.

Rules that keep breaking:
- Every kp-themes component with its standard loading, empty and failed
  states; loading in the theme's own animation. No home-made UI; a missing
  component is a kp-themes gap.
- Every view a CSS grid; forms, settings, fact lists and button groups on
  `.kp-formgrid`. Measure each screen at 1280 and 390 (measure-align and
  measure-gaps from kp-themes `research/_review/`): zero findings.
- No test runs without Kenny's ok; a commit runs fmt and clippy only.
- Choices for Kenny go in one form, never a question in prose.
- Modular code, one responsibility per file, aim at 400 lines / 20 KB at most: see `docs/agent/MODULARITY.md` (standing rule 30/10/2026 plus the split plan).

Commits carry an ID in brackets (`[app-wheel-1]`, `[meta]`); hooks:
`git config core.hooksPath .githooks`.
