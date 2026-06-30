# Verification Report: ptk-modify (B1 localized behavior changes)

**Date:** 2026-06-30
**Scope:** New `skills/ptk-modify/SKILL.md` skill + wiring — guard registration (`extensions/workflow-guard.ts`), guard contract test (`tests/workflow-guard.test.ts`), brainstorm triage ending (`skills/ptk-brainstorming/SKILL.md`). Meta-change: the artifact is a skill doc + config, not application code. Review depth scaled accordingly (verify principle: *be proportional*).
**Reviewer:** AI verify skill (security + optimization + traceability)

## Summary

| Pass | Critical | High | Medium | Low |
|------|----------|------|--------|-----|
| Security | 0 | 0 | 0 | 0 |
| Optimization | — | 0 | 0 | 5 (all doc drift) |
| Traceability | 0 | 0 | 1 | 2 |
| **Total** | **0** | **0** | **1** | **7** |

No critical or high findings. The guard contract holds end-to-end (verified by test + traced manually). The one Medium is a real seam gap between `ptk-modify` and `ptk-verify`; the Lows are doc/comment drift that `ptk-finalizing` is responsible for but are enumerated here so nothing is missed.

---

## 🔴 Security Findings

**No findings.** This is not a rubber-stamp — here is why it's clean:

- **The trust boundary is the guard.** `ptk-modify` joins `UNLOCKING_SKILLS` (guard line 163) via the *exact same mechanism* as `ptk-scaffold` / `ptk-execute` / `ptk-finalizing`. No new code path, no escalation: a user invoking `/skill:ptk-modify` gets the same access they already had via `/skill:ptk-scaffold`. The phase logic (`phaseForInput`, lines 173-188) is unchanged — `ptk-modify` matches the existing `UNLOCKING_SKILLS.some(name => skill === name)` branch.
- **No runtime attack surface introduced.** There is no input parsing, no network, no DB, no file-system mutation logic in the added code — it is a Markdown skill doc + one array entry + one test. There is nothing to inject into, no auth to bypass, no secret to leak.
- **The skill's own safety property is well-reinforced.** The dangerous failure mode (editing a test to silence a regression) is explicitly forbidden twice (lines 80, 136) and is the centerpiece of the Principles section. This is the property that *would* be a security/correctness hole if missing, and it is present.

---

## 🟡 Optimization Findings

All five are documentation drift caused by adding a 7th skill without updating the docs that enumerate the skills. **`ptk-finalizing`'s job description includes "update README/CHANGELOG"** — these are flagged here so finalize knows exactly what to touch, not because execute did anything wrong (execute fills stubs; README isn't a stub).

### [O-001] P1 — README skill table omits ptk-modify row

**Location:** `README.md:51-59`

**Issue:** The skill table (Phase | Trigger | What Happens) is the primary user-facing reference for choosing a skill. It lists Brainstorm/Scaffold/Execute/Verify/Finalize/Diagnose but not Modify. Brainstorm now *routes* users to `/skill:ptk-modify`, but the README never documents that ptk-modify exists or what it does. A user who reads the README to understand the kit will not learn about the new capability.

**Fix:** Add a row: `| **Modify** | /skill:ptk-modify | Change behavior of existing working code: pin current behavior with characterization tests (green), make the change (intentional red), repin to the new contract (green). B1 — localized changes only. |` (Place it after Diagnose or after Execute; the linear diagram doesn't capture it, so the table is where it belongs.)

### [O-002] P2 — README "6 Workflow Skills" header is now wrong

**Location:** `README.md:42`

**Issue:** Header says "🧠 6 Workflow Skills" — now 7.

**Fix:** "🧠 7 Workflow Skills".

### [O-003] P2 — README flow diagram omits modify branch

**Location:** `README.md:45-49`

**Issue:** The ASCII flow `brainstorm → scaffold → execute → [verify?] → finalize` with `diagnose (anytime)` branching off is linear and doesn't show that brainstorm can branch to `modify`. Modify is a peer of scaffold off the brainstorm triage point, not a stage in the main line.

**Fix:** Add a branch, e.g.:
```
brainstorm → scaffold → execute → [verify?] → finalize
 (why/what)   (shape)    (behavior)  (review)    (ship)
    │ ↘
    │  modify (change existing behavior: characterize → change → repin)
    ↘
     diagnose (anytime)
```

### [O-004] P2 — README project tree omits ptk-modify/SKILL.md

**Location:** `README.md:202-208`

**Issue:** The `skills/` tree in the "Project" section lists the six original skills but not `ptk-modify/SKILL.md`.

**Fix:** Add `│   ├── ptk-modify/SKILL.md         # Change existing behavior (characterize→change→repin)` to the tree.

### [O-005] P2 — CHANGELOG skill list omits modify

**Location:** `CHANGELOG.md:6`

**Issue:** Under 0.1.0, "Skills: brainstorming, scaffold, execute, verify, finalizing, diagnose" — omits modify. (If ptk-modify ships in 0.2.0, add a new 0.2.0 section instead of editing 0.1.0; the 0.1.0 line is historical.)

**Fix:** Add an unreleased/0.2.0 section: `- ptk-modify: characterize→change→repin loop for localized behavior changes to existing working code`, plus a line noting brainstorm now triages to scaffold/modify/diagnose.

---

## 🔵 Traceability Findings

### [T-001] Medium — ptk-modify → ptk-verify handoff: verify's frontier check assumes a scaffold sentinel

**Entry point:** `skills/ptk-modify/SKILL.md:127` ("Review the change: /skill:ptk-verify")
**Call chain:** ptk-modify (completes) → ptk-verify (step 1: "Confirm the frontier is empty for that feature")
**Broken at:** the ptk-modify → ptk-verify seam

**Issue:** `ptk-modify`'s "After all changes" section hands off to `/skill:ptk-verify`. But `ptk-verify` step 1 is scaffold-centric: *"Confirm the frontier is empty for that feature: find every stub call site under its sentinel directory... If stubs remain, say 'Frontier is not empty — run ptk-execute first.' and stop."* A `ptk-modify` session creates **no `.ptk-scaffold` sentinel and no `stub()` call sites** — by design (characterization tests are the frontier-equivalent, per the ADR). So after a pure ptk-modify session, verify finds zero sentinels: its frontier check has no sentinel directory to scope to and is vacuous. Verify still *works* (it falls through to reviewing `git log`/`git diff --stat`, which captures the modify session's commits), so this is not a hard break — but the sentinel-centric frontier logic is a confusing no-op for ptk-modify sessions, and verify's multi-feature "which sentinel?" question never applies.

**Fix:** Add a short clause to `ptk-verify` step 1 acknowledging the no-sentinel case: *"If no `.ptk-scaffold` sentinel exists (e.g. after a `ptk-modify` session, which uses no frontier), skip the frontier check and scope the review to the recent `git diff` instead."* (This is a one-line edit to ptk-verify — out of ptk-modify's own module outline, but the seam is introduced by this feature, hence flagged here.)

### [T-002] Low — Guard JSDoc comments omit ptk-modify (code + test correct; comments stale)

**Location:** `extensions/workflow-guard.ts:13` and `:170`

**Issue:** Two JSDoc comments enumerate the unlocking skills without `ptk-modify`:
- Line 13 (file header): *"Unlocked (full access, they write source): ptk-scaffold, ptk-execute, ptk-finalizing → null"*
- Line 170 (`phaseForInput` doc): *"- /skill:ptk-scaffold | ptk-execute | ptk-finalizing → null (unlocked)"*

The code (line 163 `UNLOCKING_SKILLS`) and the contract test (lines 296-299) are both correct and include ptk-modify. Only the comments are stale. A future reader trusting the comment over the code could be confused about why ptk-modify unlocks.

**Fix:** Add `ptk-modify` to both comment lists. (The inline comment at lines 161-162, added by scaffold, *does* mention ptk-modify — so this is just the two overview doc comments lagging behind.)

### [T-003] Low — Scope vocabulary slightly inconsistent across skills

**Location:** `skills/ptk-brainstorming/SKILL.md:81` ("one or a few functions"), `skills/ptk-modify/SKILL.md:22` ("one to three known functions"), `skills/ptk-modify/SKILL.md:103` ("more than ~3 functions")

**Issue:** The B1 scope bound is expressed three ways: "one or a few", "one to three", "~3". They don't contradict, but a user could wonder whether "a few" means 3 or 5. Minor.

**Fix:** Pick one canonical phrasing (e.g. "1–3 functions") and echo it in brainstorm's triage table and both ptk-modify spots. Optional — the current text is not wrong, just loose.

---

## Contract trace (passed — recorded for confidence)

The guard↔test↔brainstorm↔modify contracts were traced end-to-end. All hold:

| Seam | From → To | Result |
|------|-----------|--------|
| Guard ↔ Test | `UNLOCKING_SKILLS` includes "ptk-modify" (line 163) ← asserted by test (lines 296-299) from *both* brainstorm and verify phases | ✅ holds; ptk-modify test is more thorough than execute/finalizing (tests verify→null too) |
| Brainstorm ↔ Modify | brainstorm routes "behavior change, localized" → /skill:ptk-modify (line 81) ↔ ptk-modify scope guard (lines 12, 22) | ✅ vocabulary consistent ("localized", "existing working code", "behavior") |
| Modify ↔ Guard | ptk-modify "runs unlocked, phase=null" (line 143) ↔ guard returns null for ptk-modify (line 163/183) | ✅ holds |
| Modify ↔ Brainstorm handoff | brainstorm "next skill commits the decisions doc" (line 72) ↔ ptk-modify step 2 commits uncommitted decisions doc (line 18) | ✅ holds — handoff picked up correctly |
| Modify ↔ Finalize | ptk-modify "no separate finalize" (line 128) — correctly *not* a handoff | ✅ correctly handled |

The guard's exact-match logic (`skill === name`) is also correct: `/skill:ptk-modify` unlocks but a hypothetical `/skill:ptk-modifyXYZ` would not (falls through to currentPhase) — same safety as siblings. ✅

---

## Remediation Task List

| ID | Priority | Finding | Estimated Effort |
|----|----------|---------|-----------------|
| O-001 | P1 | README skill table missing ptk-modify row | small |
| T-001 | Medium | ptk-verify step-1 frontier check assumes sentinel; add no-sentinel clause | small |
| O-002 | P2 | README "6 Workflow Skills" → 7 | tiny |
| O-003 | P2 | README flow diagram missing modify branch | small |
| O-004 | P2 | README project tree missing ptk-modify/SKILL.md | tiny |
| O-005 | P2 | CHANGELOG missing ptk-modify (add 0.2.0 section) | small |
| T-002 | Low | Guard JSDoc comments (lines 13, 170) omit ptk-modify | tiny |
| T-003 | Low | Unify B1 scope vocabulary ("1–3 functions") | tiny |

**Recommended disposition:**
- **T-001** is the only finding that touches *behavior* (a seam in the kit's own contract). Recommend fixing it before finalize — it's a one-line addition to `ptk-verify` step 1. Since we're in verify (read-only), this would be a re-execute on `ptk-verify` or a direct edit in a follow-up.
- **O-001 through O-005** are `ptk-finalizing`'s explicit job ("update README/CHANGELOG"). Finalize will address them; this report enumerates the exact spots.
- **T-002, T-003** are tiny cleanups; fold into finalize or a quick follow-up edit.

## Principles check

- **Be specific** — every finding has a file:line. ✅
- **Be adversarial** — security actively probed (trust boundary, failure modes); the "edit-test-to-silence-regression" property was specifically checked for. ✅ (It's present.)
- **Be proportional** — review depth scaled to a doc+config meta-change; security pass is necessarily thin and says why. ✅
- **Don't fix anything** — read-only; report only. ✅
- **Focus on seams** — the traceability pass (T-001) found the one real cross-skill gap. ✅