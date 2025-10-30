# Static Analysis Lab Report

Project: SL8.ai Whiteboard

Repository URL: https://github.com/2Dsa3/sl8-ai-whiteboard.git

## Tool Setup Summary
- Tool: ESLint 9.38.0 (Flat Config)
- Plugins: eslint-plugin-sonarjs 3.x, eslint-plugin-security 3.x, eslint-plugin-import 2.x
- Language: JavaScript (ESM/Browser), Node.js (CommonJS for scripts)
- Config file: `eslint.config.mjs`
- Helper scripts: `scripts/run-eslint-report.cjs`, `scripts/generate-eslint-html.cjs`
- Commands:
  - Run analysis: `npm run lint`
  - Generate reports (JSON + HTML): `npm run lint:report`

## Reports (Before and After)
- Initial snapshot (HTML/JSON): `reports/eslint-report.initial.html`, `reports/eslint-report.initial.json`
- Final snapshot (HTML/JSON): `reports/eslint-report.final.html`, `reports/eslint-report.final.json`
- Tip: open the HTML files above in a browser and add screenshots to:
  - `reports/screenshots/initial.png`
  - `reports/screenshots/final.png`

Results summary (CLI stylish): final run shows `0 errors, 123 warnings`.
## Notable Findings (Initial Scan)
- sonarjs/no-nested-conditional — `SL8-AI (MVP)/main.js:284` — Nested ternary reduced readability; refactor into if/else.
- sonarjs/no-gratuitous-expressions — `feedback-collector.js:76` — Expression always truthy; remove redundant sub‑expression.
- sonarjs/pseudo-random — `golden-dataset.js:55` — Insecure `Math.random()` used for IDs; replace with crypto.
- no-unreachable — `SL8-AI (MVP)/main.js:748` — Logging after `throw` was unreachable; reorder.
- no-unused-vars — `SL8-AI (MVP)/draw.js:109` — Unused event parameters in handlers; remove.
- sonarjs/no-dead-store — `feedback-collector.js:108` — Variable assigned but never read; remove.
- sonarjs/no-duplicate-string — `SL8-AI (MVP)/main.js:529` — Repeated literals; consider extracting constants.
- sonarjs/cognitive-complexity — `SL8-AI (MVP)/main.js:467` — Function exceeds complexity threshold; consider refactor.
- security/detect-object-injection — multiple spots (e.g., `SL8-AI (MVP)/main.js:603, 606`) — Dynamic property access; validate keys.

## Fixes Implemented
- fix(ui): Refactor nested ternary for token color to if/else. File: `SL8-AI (MVP)/main.js:284`.
- fix(bug): Move error logging before `throw` to avoid unreachable code. File: `SL8-AI (MVP)/main.js:748`.
- fix(bug): Remove redundant truthy check and drop unused `outcome` assignment. File: `feedback-collector.js:76,108`.
- fix(security): Replace `Math.random()` with `crypto.getRandomValues` for ID generation; add deterministic fallback without `Math.random`; refactor nested assignment; simplify nested conditional; remove unused param. File: `golden-dataset.js`.
- fix(draw): Remove unused event parameters to satisfy `no-unused-vars`. File: `SL8-AI (MVP)/draw.js`.
- chore(lint): Configure ESLint with SonarJS & Security and add HTML report generator; add Node overrides for scripts and Vite config; avoid PATH dependency in runner.
 - fix(security): Replace `Math.random()` with crypto‑grade IDs in `analytics.js` and `experiments.js`.
 - fix(dashboard): Declare global `Chart` (CDN) to satisfy `no-undef`; improve catch blocks to address `sonarjs/no-ignored-exceptions`; keep dashboard instance on `window` to avoid side‑effect‑only constructor warning.
 - fix(dashboard): Localized disable for `sonarjs/no-nested-conditional` inside one template string with justification (see “Justified rule disables”).

Commits covering the above:
- `fix(ui): refactor nested ternary for token color; move logging before throw to avoid unreachable code`
- `fix(bug): remove redundant truthy check and drop unused 'outcome' assignment in feedback collector`
- `fix(security): replace Math.random with crypto.getRandomValues for ID; refactor nested assignment and nested conditional; remove unused index param`
- `fix(draw): remove unused event parameters to satisfy no-unused-vars`
- `chore(lint): add ESLint (flat config) with SonarJS, Security, and Import plugins; add HTML report generator`
- `chore(lint): add Node overrides for scripts and vite config; avoid PATH usage in report runner`

## Remaining/Deferred Items
- Repeated literals flagged by `sonarjs/no-duplicate-string` in `SL8-AI (MVP)/main.js` could be extracted into constants for clarity.
- Several `security/detect-object-injection` warnings stem from dynamic indexing; can mitigate by whitelisting keys or validating input sources before access.
- One function exceeds the cognitive complexity threshold and can be refactored into smaller units.

Justified rule disables:
- `sonarjs/no-nested-conditional` — one localized instance in `dashboard.js` within a UI template string to avoid bloating the view code. A small helper renderer would remove the need for the disable; deferred to a follow‑up.

## Reflection
- The static analysis surfaced several maintainability issues (nested ternaries, unreachable code, unused variables) that were easy to miss during feature work. Refactoring improved readability and reduced potential for future defects.
- The most surprising findings were the number of duplicated strings and the breadth of “object injection” warnings — good prompts to add lightweight key validation and centralize repeated UI strings.
- Replacing `Math.random()` with crypto-grade randomness was a quick yet meaningful hardening step.
 - After the second pass, I found that some UI helper code (template strings with ternaries) benefits from small extraction functions to satisfy readability rules without disables. Also, dashboards relying on CDN globals (e.g., Chart.js) need explicit global declarations for static analysis.

## Configuration Files Included
- `eslint.config.mjs`
- `scripts/run-eslint-report.cjs`
- `scripts/generate-eslint-html.cjs`

## How to Reproduce
1) `npm ci` (or `npm install`)
2) Run analysis: `npm run lint`
3) Generate final reports: `npm run lint:report` (outputs to `reports/`)
