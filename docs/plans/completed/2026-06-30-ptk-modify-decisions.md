# Decisions: ptk-modify (Flavor B1 — localized behavior changes)

## Problem

pi-topdown-kit handles **greenfield** features cleanly: the `brainstorm → scaffold → execute → verify → finalize` pipeline builds a `stub()` frontier that's grep-queryable, keeps the tree green at every commit, and gates risky bits at checkpoints. But it has no story for **modifying existing working code**, and the gap is concrete:

- **No ceremony.** A medium-sized change to working code (tweak a function's behavior, fix a bug in live code, alter a signature) gets no ptk discipline today. The user falls back to unguarded editing.
- **No legal edit path that isn't greenfield-locked.** The guard only unlocks write access via `/skill:ptk-scaffold`, `ptk-execute`, or `ptk-finalizing` — all of which carry the "emit/fill a skeleton" frame. There is no unlocked phase whose *instructions* are oriented toward editing existing behavior. So after brainstorming a modification, the only sanctioned way to touch source is to invoke a skill with the wrong ceremony.
- **The danger in B1 is regressions, not shape.** When you change working code, the risk is silently breaking behavior that nothing pins. Greenfield's `stub()`/frontier mechanism doesn't apply — there's no new "place" to mark; the place already exists and already has behavior.

Scope is deliberately narrow: **B1 — localized changes** to one or a few known functions (behavior tweak, bug fix in working code, single-signature change). B2 (replacing/refactoring a whole live subsystem) is out of scope; that's closer to scaffold-and-swap and a separate future design. **Flavor A** (additive changes into existing modules) is also out of scope — it works with the current flow as-is, needing only a small wording patch to `ptk-scaffold` so it knows to emit into existing files rather than always creating new ones.

Constraints:
- Reuse ptk's **green-at-every-commit** and **checkpoint** discipline — that's the actual value.
- Do **not** force the `stub()`/frontier mechanism onto B1. It doesn't apply; pretending it does would be dishonest.
- Keep YAGNI: no separate characterize phase, no frontier, no progress file for B1.
- Guard change must be minimal.

## Approaches considered

- **Option A — New skill `ptk-modify`: a characterize → change → repin loop.** One new skill, one *unlocked* guard phase (one-line addition to `UNLOCKING_SKILLS`). Characterization tests pin current behavior (green) → make the change → pins that go red are either *intended* (update the pin to the new contract) or *regressions* (roll back) → checkpoint at the intentional-red moment → repin green → commit. Brainstorm optional before; `verify` reused after. Pro: honest to B1's shape, solves the edit-path complaint, minimal surface. Con: pin-first discipline is instructional (enforced by the checkpoint), not hard-blocked.
- **Option B — Extend `ptk-scaffold` with a "modify mode"** dispatching on existing-vs-new code. Rejected: scaffold's semantics are "emit shape with `stub()`s." B1 has no stubs, and conflating the *old* contract (pins) with the *new* contract (the plan) inside one artifact breaks the skeleton-is-the-plan metaphor. Stretches scaffold past its meaning.
- **Option C — Split into `ptk-characterize` (a protected "tests-only" step) + free edit + verify.** Rejected as over-build: the guard can't cheaply express "only `*.test.ts` writable" without a new phase rule, and once characterize is just "step 1 of the edit," folding it into Option A is simpler. B1 doesn't justify the extra phase machinery.

**Chosen:** Option A — it's the only one honest about B1's shape (tests as pins, not stubs), and it's minimal: one skill plus a one-line guard change. Pin-first-as-instruction is an accepted, documented limitation rather than a reason to add phase machinery.

## Decisions

# Characterization tests are B1's frontier-equivalent

Greenfield tracks progress with the `stub()` frontier — grep `stub("…")` call sites; empty output means done. B1 has no stubs (the code already exists and has behavior), so the frontier mechanism doesn't apply. Instead, **characterization tests** play the equivalent role: they pin *current* behavior (green), the change makes the relevant pins go red, and "done" is when the repinned tests are green again. This keeps ptk's green-at-every-commit discipline but swaps the progress marker from `stub()` calls to test pins — the right trade-off for behavior change, where regressions are the danger and a fresh pin on old behavior is the only thing that catches them.

# `ptk-modify` is a single unlocked skill, not a blocking phase

Brainstorm and verify are *blocking* phases (guard hard-blocks source writes outside `docs/plans/`). `ptk-modify` is **unlocked** — it writes source by design, so it joins `UNLOCKING_SKILLS` in the guard alongside scaffold/execute/finalize. Consequence: the guard cannot hard-enforce "write characterization tests before touching source." That ordering discipline is carried by the **skill's checkpoint** (pause at the intentional-red moment) instead of the hard block. This is weaker than brainstorm's block and is accepted as a known limitation — the alternative (a new "characterize" blocking phase + a "write any file" rule) is over-build for B1's small scope.

# Brainstorm is the kit's triage point

After brainstorm resolves the why/what, it recommends the next phase by the *nature* of the change — does it create new shape (→ scaffold), change existing behavior (→ modify), or fix something broken (→ diagnose)? This is the right place for triage: brainstorm is where you've just established what the change *is*, so you're best positioned to judge its nature. The recommendation is non-binding and read-only (brainstorm stays a blocking phase; the user still types the next `/skill:` command), so no guard change is needed for the routing itself.

# Flavor A gets a wording patch, not a new skill

Additive changes into existing modules work with the current flow as-is — the `stub()` frontier scopes to a directory and only matches the new stubs, the green invariant holds, and the diff is actually easier (tracked files). The only gap is that `ptk-scaffold`'s instructions assume *new files* ("Write the files. Top-down," "one file per module"). A small wording patch teaches scaffold that emitting into existing files (and wiring to existing code, e.g. registering a handler in an existing router) is allowed shape, not forbidden logic. This is low priority and orthogonal to B1, but captured here so scaffold's role for Flavor A is explicit.

## Module outline

- `skills/ptk-modify/SKILL.md` — the new skill. The characterize → change → repin loop for localized behavior changes to existing working code. Checkpoint at the intentional-red moment. Reuses the kit's green-commit discipline; no frontier, no sentinel, no marker helper. Unlocked phase.
- `extensions/workflow-guard.ts` — one-line addition: add `"ptk-modify"` to `UNLOCKING_SKILLS`. No new phase, no new blocking rule.
- `skills/ptk-brainstorming/SKILL.md` — replace the fixed "Ready to scaffold? Run `/skill:ptk-scaffold`" ending with a triage recommendation (scaffold for new shape / modify for behavior change / diagnose for broken). Read-only change; no guard implication.
- `skills/ptk-scaffold/SKILL.md` *(optional, low priority, orthogonal to B1)* — wording patch so scaffold knows additive changes into existing files (and wiring to existing code) are allowed shape. Covers Flavor A.