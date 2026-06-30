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

<!-- spec: Phase 1. Write characterization tests capturing CURRENT behavior of the functions you are about to change. They MUST pass against unmodified code (run them, confirm green) — if one fails before the change, either the code is already broken (diagnose first) or the test is wrong. Cover: the exact behavior being changed, PLUS adjacent/branching behavior that could regress (other code paths in the same function, callers' assumptions). External deps must be mocked/deterministic (no real DB/network/clock — same sandboxing discipline as ptk-execute). Commit green: "test: characterize <fn> current behavior". Note: these tests assert what the code DOES today, not what it SHOULD do — that is the point. -->
<!-- ptk:stub "modify.characterize" -->

### 2. Change — make the edit

<!-- spec: Phase 2. Make the change (edit the function body / signature). Run the characterization tests. Classify every red test: INTENDED-red = the behavior you deliberately changed (expected, will be repinned in phase 3); REGRESSION-red = an unexpected break (a test for behavior you did NOT intend to change). Do NOT commit. If ZERO tests went red, you either changed nothing observable (consider whether the change is real) or the characterization was incomplete (go back to phase 1 and pin more before proceeding). The red set is the signal — it is exactly the behavioral delta of your change. -->
<!-- ptk:stub "modify.change" -->

### ⏸ CHECKPOINT: intentional red

<!-- spec: The checkpoint gate. Pause (do not commit). Present: the diff of the change, the list of red tests split into INTENDED vs REGRESSION, and for each intended-red a one-line note of the new contract it will be repinned to. Ask the user to approve. A regression-red must be resolved by rolling back part of the change (or narrowing it), never by editing the test to silence it. This is the dangerous moment — editing working code — so it is the one hard pause in the skill. -->
<!-- ptk:stub "modify.checkpoint-intentional-red" -->

### 3. Repin — update the contract

<!-- spec: Phase 3. For each INTENDED-red test, rewrite its expectation to the NEW contract (the one-line note from the checkpoint). Do NOT touch regression-red tests — those mean the change is wrong; if any remain, go back to phase 2 and narrow/roll back the change. Run the full affected suite → must be green. Commit: "feat: change <fn> to <new behavior> (<N> pins repinned)". The characterization tests now encode the NEW contract and protect future modifications to this same code. -->
<!-- ptk:stub "modify.repin" -->

### Commit

<!-- spec: One commit per change increment, always green (either phase-1 characterize-green or phase-3 repin-green; phase-2 red is never committed). Commit messages distinguish characterization ("test: characterize ...") from the behavior change ("feat: change ..."). Small, reviewable commits — same discipline as ptk-execute. -->
<!-- ptk:stub "modify.commit" -->

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