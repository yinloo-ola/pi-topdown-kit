# Changelog

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