---
name: ptk-modify
description: "Use this to change the behavior of existing working code safely — a localized change to one or a few known functions (behavior tweak, bug fix in live code, signature change, refactor of a small surface). Pins current behavior with characterization tests FIRST (green), makes the change (intentional red), then repins the intended changes to the new contract (green) — keeping the tree green at every commit. Use when the user says 'modify', 'change', 'refactor', 'fix the behavior of', 'update this function', or after ptk-brainstorming routes a behavior change here. For NEW code/modules use ptk-scaffold instead; for replacing a whole live subsystem this is the wrong tool."
---

# Modify

Change the behavior of **existing working code** without losing what it already does. The danger in modifying live code is silent regression — breaking behavior that nothing pins. `ptk-modify` solves it with a **characterize → change → repin** loop: pin *current* behavior as tests (green), make the change (the relevant pins go red), separate *intended* reds (the behavior you meant to change) from *regressions* (unexpected breaks), then repin the intended reds to the new contract (green again). The tree is green at every commit.

> **What ptk-modify is NOT:** it is not for new code (that's `ptk-scaffold` + `ptk-execute` — the `stub()` frontier). It is not for replacing a whole live subsystem (B2 — build new alongside, then swap). It is for **localized** changes — one or a few known functions whose current behavior you can capture in tests before touching them. There is no `stub()` frontier here; **characterization tests are the frontier-equivalent** — they pin old behavior the way `stub()` pins intended new behavior.

> **Scope is B1 — localized.** If the change spreads across many files or replaces a layer, stop and re-brainstorm (likely scaffold-and-swap, a separate design).

## Before you start

1. **Check git state** — run `git status` and `git log --oneline -5`. Note any uncommitted work; resolve or set it aside before changing behavior — you don't want unrelated changes mixed into a characterization commit.

2. **Commit the decisions doc if present and uncommitted** — if `docs/plans/*-decisions.md` exists and is uncommitted, commit it first. `ptk-brainstorming` is read-only and cannot have committed it; persist the handoff before touching source (same discipline as `ptk-scaffold`). If you came here with no brainstorm, skip this step.

3. **Find the design / new contract** — if a brainstorm produced a decisions doc, read `docs/plans/*-decisions.md` for the new contract. If you came here directly, the "design" is the user's stated new contract — restate it in **one sentence** and confirm with the user before proceeding. A behavior change with no crisp target contract is a signal to brainstorm first.

4. **Confirm scope is B1 — localized** — the change should touch **one to three known functions**. If it spreads across many files, replaces a layer, or you cannot name the target functions up front, stop: that's B2 or new architecture. Point the user to `/skill:ptk-brainstorming` (re-scope) or `/skill:ptk-scaffold` (new shape) instead. Forcing a large change through `ptk-modify` defeats the characterize→change→repin loop.

5. **Identify the test harness** — confirm the project's test framework (vitest/jest/Go testing/etc.) and the exact command to run **just the affected test file** (e.g. `npx vitest run path/to/file.test.ts`, `go test ./pkg/...`). You'll run this repeatedly across the three phases; knowing the scoped command keeps the loop fast. If the target functions have **no existing tests**, note it — phase 1 (characterize) creates them from scratch.

## The loop

Every change runs three phases, kept green at the commit boundaries:

1. **Characterize** — write characterization tests that pass against the *current* (unmodified) code. → commit **green**.
2. **Change** — make the edit. Run the tests. Some go red. Classify each red as **intended** (behavior you meant to change) or **regression** (unexpected break). → do **not** commit yet.
3. **Repin** — for each *intended*-red test, rewrite its expectation to the **new** contract. A *regression*-red means roll back the change, not the test. Run green → commit **green**.

The invariant: **green at every commit.** The only red is the transient, uncommitted state in phase 2, and it is gated by a checkpoint.

### 1. Characterize — pin current behavior

Write tests that capture **what the code does today**, against the unmodified functions. This is the safety net — if a test fails *here*, the code was already broken (go to `/skill:ptk-diagnose`) or the test is wrong. Fix before proceeding.

- **Run them green on the unchanged code.** A characterization test that doesn't pass before the change is useless — it tells you nothing about regressions. Confirm green first.
- **Cover the behavior you're changing** AND the behavior you're **not** — other code paths in the same function, edge cases, and caller assumptions. Adjacent behavior is where silent regressions hide; pin it now.
- **Mock external dependencies** — no real DB, network, filesystem, or wall-clock. Same sandboxing discipline as `ptk-execute`: inject fakes, set `NODE_ENV=test`, deterministic seeds. A flaky characterization test erodes the whole loop.
- **Assert what the code DOES, not what it SHOULD.** Resist writing "good" tests. If the current behavior is ugly (returns `null` on error, mutates input, off-by-one), pin the ugly behavior — that's exactly what a regression would break. The repin phase will rewrite these to the new contract.

Commit green: `test: characterize <fn> current behavior`.

### 2. Change — make the edit

Make the edit — the new behavior, the signature change, the fix. Then run the characterization tests. **Do not commit.**

- **Classify every red** as one of:
  - **Intended-red** — the test pinned old behavior you deliberately changed. Expected. It gets repinned in phase 3.
  - **Regression-red** — the test pinned behavior you did **not** mean to touch. Unexpected. This is what the characterization was for.
- **The red set is the behavioral delta.** If **zero** tests went red, something is wrong: either the change isn't observable (is it real?), or the characterization in phase 1 was incomplete — go back and pin more before proceeding. A change that breaks nothing it pinned is a change you can't trust.
- A green run here (no reds at all) is suspicious, not reassuring.

### ⏸ CHECKPOINT: intentional red

This is the one hard pause in `ptk-modify` — the moment working code has been edited and is sitting red. Stop. Do not commit. Present:

```
⏸ Paused at checkpoint: intentional red

**Change:** <one-line summary of the new behavior>
**Diff:** [paste the change diff]

**Red tests:**
  INTENDED (will repin to new contract):
    - <test name> → <new expected behavior>
  REGRESSION (unexpected — must resolve before proceeding):
    - <test name> — <what broke>

What would you like to do?
- **approve** — repin the intended-reds, then commit
- **narrow** — roll back part of the change to eliminate regressions, retry
- **revert** — undo the change entirely
- **stop** — pause here
```

A regression-red is resolved by **changing the code** (narrow or roll back the change), **never by editing the test** to silence it. Editing a test to turn a regression green is exactly the failure mode this skill exists to prevent.

### 3. Repin — update the contract

For each **intended-red** test, rewrite its expectation to the **new contract** (the one-line note from the checkpoint). The test now asserts the new behavior.

- **Do not touch regression-red tests.** If any remain, the change is wrong — go back to phase 2 and narrow or roll back. A regression-red is never repinned; it's either eliminated by fixing the code or it blocks the commit.
- Run the **full affected suite** → must be green. Not just the repinned tests — everything, to catch second-order effects.
- The characterization tests now encode the **new** contract and stay in the codebase, protecting the next modification to this same code.

Commit: `feat: change <fn> to <new behavior> (<N> pins repinned)`.

### Commit

One commit per change increment, and **every commit is green.** There are exactly two legal commit states:

- **After characterize** (phase 1) — green, all pins passing on old code. Message: `test: characterize <fn> current behavior`.
- **After repin** (phase 3) — green, repinned pins passing on new code. Message: `feat: change <fn> to <new behavior> (<N> pins repinned)`.

The phase-2 red is **never committed.** It lives only in the working tree between the checkpoint and the repin. Small, reviewable commits — same discipline as `ptk-execute`.

### If the change is too big

<!-- spec: Recursive splitting (mirrors ptk-execute's recursive re-stub, but for behavior changes). If the change is too big — touches more than ~3 functions, spans responsibilities, or produces a large/confused red set you cannot cleanly classify into intended vs regression — do NOT force it. Split: pick one sub-behavior, run the full characterize→change→repin loop on JUST that (commit green), then move to the next. The red set being un-classifiable is the signal that the change is not B1 — either split it, or re-brainstorm (it may be B2). -->
<!-- ptk:stub "modify.too-big" -->

## After all changes

<!-- spec: When the user's stated changes are all done (no more functions to modify). Summarize: N functions changed, M characterization pins added/repinned. Suggest /skill:ptk-verify to review the behavior change (security/optimization/traceability against the new contract), same as after ptk-execute. If the change touched the kit's own skills/guard, note that the guard contract tests should be re-run. -->
<!-- ptk:stub "modify.after" -->

## Principles

<!-- spec: The discipline's rules, ptk-modify flavor. (1) Pin FIRST — never edit working code without a green characterization of what it currently does; the red set is meaningless without it. (2) Green at every commit — the only red is the transient, checkpoint-gated phase-2 state. (3) Intended-red vs regression — the core judgment; a regression is fixed by changing the code, never by editing the test. (4) The characterization test IS the contract — after repin it documents the new behavior and guards the next modification. (5) Characterization asserts what the code DOES, not what it SHOULD — resist writing "good" tests in phase 1; capture actual behavior, even ugly behavior. -->
<!-- ptk:stub "modify.principles" -->

## Known limitation

<!-- spec: Honest disclosure of the guard limitation. ptk-modify runs UNLOCKED (phase=null — it writes source by design, like scaffold/execute/finalize). Therefore the guard CANNOT hard-enforce "characterize before you change" the way brainstorm hard-blocks source writes. The pin-first ordering is carried by THIS skill's checkpoint (the intentional-red pause) instead of by a hard block. This is weaker than brainstorm's enforcement and is accepted — the alternative (a separate blocking "characterize" phase + a "only *.test.* writable" rule) is over-build for B1's small scope. A user who skips phase 1 and edits directly has bypassed the skill, not the guard. -->
<!-- ptk:stub "modify.known-limitation" -->