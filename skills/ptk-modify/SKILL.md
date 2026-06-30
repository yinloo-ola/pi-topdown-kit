---
name: ptk-modify
description: "Use this to change the behavior of existing working code safely — a localized change to one or a few known functions (behavior tweak, bug fix in live code, signature change, refactor of a small surface). Pins current behavior with characterization tests FIRST (green), makes the change (intentional red), then repins the intended changes to the new contract (green) — keeping the tree green at every commit. Use when the user says 'modify', 'change', 'refactor', 'fix the behavior of', 'update this function', or after ptk-brainstorming routes a behavior change here. For NEW code/modules use ptk-scaffold instead; for replacing a whole live subsystem this is the wrong tool."
---

# Modify

Change the behavior of **existing working code** without losing what it already does. The danger in modifying live code is silent regression — breaking behavior that nothing pins. `ptk-modify` solves it with a **characterize → change → repin** loop: pin *current* behavior as tests (green), make the change (the relevant pins go red), separate *intended* reds (the behavior you meant to change) from *regressions* (unexpected breaks), then repin the intended reds to the new contract (green again).

> **What ptk-modify is NOT:** not for new code (that's `ptk-scaffold` + `ptk-execute` — the `stub()` frontier), and not for replacing a whole live subsystem (build the new version alongside, then swap — see `ptk-finalizing`'s swap step). It is for **localized** changes — one or a few known functions whose current behavior you can capture in tests before touching them. There is no `stub()` frontier here; **characterization tests are the frontier-equivalent** — they pin old behavior the way `stub()` pins intended new behavior.

> **Scope is localized.** If the change spreads across many files or replaces a layer, stop and re-brainstorm (likely a whole-subsystem replacement — see `ptk-finalizing`'s swap step).

## Before you start

1. **Check git state** — `git status` and `git log --oneline -5`. Resolve or set aside uncommitted work first — you don't want unrelated changes mixed into a characterization commit.
2. **Commit the decisions doc if uncommitted** — if `docs/plans/*-decisions.md` exists and is uncommitted, commit it first (brainstorm is read-only and can't have committed it). Persist the handoff before touching source, same discipline as `ptk-scaffold`. If you came here with no brainstorm, skip.
3. **Find the new contract** — if a brainstorm produced a decisions doc, read `docs/plans/*-decisions.md` for it. Otherwise the "design" is the user's stated new contract — restate it in **one sentence** and confirm before proceeding. A behavior change with no crisp target contract is a signal to brainstorm first.
4. **Confirm scope is localized** — the change should touch **1–3 known functions**. If it spreads across many files, replaces a layer, or you can't name the target functions up front, stop: that's a whole-subsystem replacement or new architecture. Point the user to `/skill:ptk-brainstorming` (re-scope) or `/skill:ptk-scaffold` (new shape).
5. **Identify the test harness** — confirm the test framework and the exact command to run **just the affected test file** (e.g. `npx vitest run path/to/file.test.ts`, `go test ./pkg/...`). You'll run it repeatedly across the three phases. If the target functions have **no existing tests**, note it — phase 1 creates them from scratch.

## The loop

Every change runs three phases, kept green at the commit boundaries:

1. **Characterize** — write characterization tests that pass against the *current* (unmodified) code. → commit **green**.
2. **Change** — make the edit. Run the tests. Some go red. Classify each red as **intended** (behavior you meant to change) or **regression** (unexpected break). → do **not** commit yet.
3. **Repin** — for each *intended*-red test, rewrite its expectation to the **new** contract. A *regression*-red means roll back the change, not the test. Run green → commit **green**.

The invariant: **green at every commit.** The only red is the transient, uncommitted state in phase 2, gated by a checkpoint.

### 1. Characterize — pin current behavior

Write tests that capture **what the code does today**, against the unmodified functions. This is the safety net — if a test fails *here*, the code was already broken (go to `/skill:ptk-diagnose`) or the test is wrong. Fix before proceeding.

- **Run them green on the unchanged code.** A characterization test that doesn't pass before the change is useless. Confirm green first.
- **Cover the behavior you're changing AND the behavior you're not** — other code paths in the same function, edge cases, caller assumptions. Adjacent behavior is where silent regressions hide; pin it now.
- **Mock external dependencies** — no real DB, network, filesystem, or wall-clock. Inject fakes, set `NODE_ENV=test`, deterministic seeds. A flaky characterization test erodes the whole loop.
- **Assert what the code DOES, not what it SHOULD.** Resist writing "good" tests. If the current behavior is ugly (returns `null` on error, mutates input, off-by-one), pin the ugly behavior — that's exactly what a regression would break. The repin phase will rewrite these to the new contract.

Commit green: `test: characterize <fn> current behavior`.

### 2. Change — make the edit

Make the edit — the new behavior, the signature change, the fix. Then run the characterization tests. **Do not commit.**

- **Classify every red** as one of:
  - **Intended-red** — the test pinned old behavior you deliberately changed. Expected. It gets repinned in phase 3.
  - **Regression-red** — the test pinned behavior you did **not** mean to touch. Unexpected. This is what the characterization was for.
- **The red set is the behavioral delta.** If **zero** tests went red, something is wrong: either the change isn't observable (is it real?), or the characterization in phase 1 was incomplete — go back and pin more. A green run here (no reds at all) is suspicious, not reassuring.

### ⏸ CHECKPOINT: intentional red

The one hard pause — working code has been edited and is sitting red. Stop. Do not commit. Present:

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

A regression-red is resolved by **changing the code** (narrow or roll back), **never by editing the test** to silence it. Editing a test to turn a regression green is exactly the failure mode this skill exists to prevent.

### 3. Repin — update the contract

For each **intended-red** test, rewrite its expectation to the **new contract** (the one-line note from the checkpoint). The test now asserts the new behavior.

- **Do not touch regression-red tests.** If any remain, the change is wrong — go back to phase 2 and narrow or roll back. A regression-red is never repinned; it's either eliminated by fixing the code or it blocks the commit.
- Run the **full affected suite** → must be green. Not just the repinned tests — everything, to catch second-order effects.
- The characterization tests now encode the **new** contract and stay in the codebase, protecting the next modification to this same code.

Commit: `feat: change <fn> to <new behavior> (<N> pins repinned)`.

### Commit

One commit per change increment, **every commit green.** Two legal commit states:

- **After characterize** (phase 1) — green, all pins passing on old code. `test: characterize <fn> current behavior`.
- **After repin** (phase 3) — green, repinned pins passing on new code. `feat: change <fn> to <new behavior> (<N> pins repinned)`.

The phase-2 red is **never committed** — it lives only in the working tree between the checkpoint and the repin.

### If the change is too big

If the change touches more than 1–3 functions, spans responsibilities, or produces a red set you **cannot cleanly classify** into intended vs regression — **do not force it.** This mirrors `ptk-execute`'s recursive re-stub, but for behavior changes.

**Split instead:** pick one sub-behavior, run the full **characterize → change → repin** loop on *just that* (commit green), then move to the next sub-behavior. Repeat.

The red set being un-classifiable is itself the signal — it means the change is not localized. Either split it into independent sub-changes you can loop on one at a time, or **re-brainstorm** (it may be a whole-subsystem replacement — which needs scaffold + the swap step in `ptk-finalizing`, not modify).

## After all changes

When the user's stated changes are all done:

```
✅ All changes complete.

| Function | Behavior changed | Pins added/repinned |
|----------|------------------|---------------------|
| <fn>     | <old> → <new>    | <N>                 |
| ...      | ...              | ...                 |
```

Next:
- **Review the change:** `/skill:ptk-verify` — security, optimization, and traceability passes against the new contract.
- **Ship:** there is no separate finalize for `ptk-modify` (no sentinels or marker helper to strip). The characterization tests you added are the permanent artifact — they stay and guard the new behavior.

> **If this change touched the kit's own skills or guard** (a meta-change to pi-topdown-kit), re-run the guard contract tests (`npm test`) — the guard's phase logic is the trust boundary.

## Principles

- **Pin FIRST.** Never edit working code without a green characterization of what it currently does. You can't tell intended from regression if you never pinned the starting state.
- **Intended-red vs regression is the core judgment.** A regression is fixed by changing the code, **never by editing the test** — that is the failure mode this skill exists to prevent.
- **The characterization test IS the contract.** After repin it documents the new behavior and stays in the codebase, guarding the next modification to this same code.

## Known limitation

`ptk-modify` runs **unlocked** (`phase=null` — it writes source by design, like `ptk-scaffold` / `ptk-execute` / `ptk-finalizing`). So the guard **cannot hard-enforce "characterize before you change"** the way `ptk-brainstorming` hard-blocks source writes.

Pin-first ordering is carried by **the checkpoint** (the intentional-red pause) and the green-commit invariant instead. This is weaker than brainstorm's hard block and is **accepted** — the alternative (a separate blocking "characterize" phase + "only test files writable" rule) is over-build for modify's small scope, and the guard can't cheaply express "only `*.test.*` writable" anyway. A user who skips phase 1 and edits working code directly has **bypassed the skill, not the guard** — the discipline is instructional; the safety net is the checkpoint.