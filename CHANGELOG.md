# Changelog
## Unreleased

- **Guard: robust repo-scoped command detection.** `workflow-guard` now recognizes wrapped/prefixed repo-scoped commands (inline env assignments, `env`, `command`, absolute git binary paths) before applying root-lock logic.
- **Guard: CWD-check command parity fixed.** Blocking-phase allowlist now permits `git rev-parse --show-toplevel`, matching skill CWD-check instructions.
- **Tests: integration coverage for `tool_call` root-lock flow.** Added end-to-end guard tests for rewrite behavior, interactive root switch confirmation, and non-interactive fail-closed handling.
## 0.3.0

- **New: replace a whole live subsystem.** `ptk-finalizing` gains a Swap step — repoint callers from old X to new X', suite goes green, delete old. Brainstorm's triage now routes subsystem replacements: scaffold the replacement, then finalize swaps it in. Big-bang cutover is documented; large or contract-changing swaps point at incremental cutover via `ptk-modify`.
- **Language-agnostic frontier gate.** Execute and finalize no longer grep for `it.todo`/`t.Skip` to confirm the frontier is empty — the stub-call-site grep is the complete signal (a filled stub converts its own placeholder in the same increment; a skipped stub keeps both call site and placeholder). The gate now works unchanged across JS/Go/Python/etc.
- **`ptk-diagnose` names its fix routing.** Phase 6 now states where a discovered fix goes: existing working code → `/skill:ptk-modify`; an unfilled stub → `/skill:ptk-execute`. Closes the kit's weakest handoff seam.
- **Skills trimmed for clarity (~130 lines net).** Every `description` trigger preserved byte-for-byte; no behavior change. Highlights: scaffold's 4-case resume prose → a decision table; verify's report template defined once instead of thrice; finalize's parent-branch detection shell-golf → just ask the user.
- **Killed undefined jargon.** The internal "B1/B2" scope labels (used 10×, never defined) → plain phrases ("localized 1–3 functions" / "replacing a whole live subsystem").

## 0.2.0

- **New skill: `ptk-modify`** — characterize→change→repin loop for localized behavior changes (B1: 1–3 functions) to existing working code. Characterization tests are the frontier-equivalent of `stub()`; the tree stays green at every commit; a checkpoint gates the intentional-red moment.
- **Brainstorm now triages** — recommends the next skill by the nature of the change: `/skill:ptk-scaffold` (new shape), `/skill:ptk-modify` (change existing behavior), or `/skill:ptk-diagnose` (broken).
- Guard registers `ptk-modify` as an unlocking skill (writes source by design).
- Remediation: `ptk-verify` step 1 handles the no-sentinel case (after `ptk-modify`); `ptk-execute` step 2 keys resume on durable artifacts (sentinel + stub call sites) instead of the fragile commit-message prefix.

## 0.1.0

- Initial release.
- Skills: brainstorming, scaffold, execute, verify, finalizing, diagnose
- Extension: workflow guard (enforces read-only during brainstorm/verify)
- Marker protocol: `stub()` helpers, `.ptk-scaffold` sentinels with per-tree ERE patterns
- Hazard checkpoints on scaffolded production risks
- Recursive re-stubbing for stepwise refinement
- Multi-feature support via sentinel scoping