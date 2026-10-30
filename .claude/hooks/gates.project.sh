#!/usr/bin/env bash
# Project-owned gates (chassis 1.6.0, M1), run by .claude/hooks/gates.sh: the static checks of the web pages. No tests,
# no browser; each takes well under a second.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
node scripts/check-words.mjs
node scripts/check-wheels.mjs
node scripts/check-forms.mjs
