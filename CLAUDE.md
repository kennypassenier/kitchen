# Kitchen

AuDHD-friendly recipe app (Life sub-project): Rust on chassis-rs + plain
ES modules on kp-themes, which comes only through chassis-rs (`/static/kp/`, Kenny 19/10/2026). Owner Kenny; chat Dutch, code and docs English.

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

Commits carry an ID in brackets (`[app-wheel-1]`, `[meta]`); hooks:
`git config core.hooksPath .githooks`.
