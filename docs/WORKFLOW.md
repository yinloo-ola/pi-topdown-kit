# The Workflow in Detail

This is the reference manual for how the kit actually works internally — the marker protocol, frontier mechanics, hazard gates, and key invariants. For the 30-second pitch and install steps, see the [README](../README.md).

## Phase Control

You control each phase — the agent never advances on its own:

```
/skill:ptk-brainstorming   → discuss and decide      (writes only docs/plans/)
/skill:ptk-scaffold         → emit the skeleton       (writes source), then pause for review
/skill:ptk-execute          → fill the stubs          layer by layer
/skill:ptk-verify           → review the filled code  (3 expert passes)
/skill:ptk-finalizing       → ship it                 (clean, archive, PR)
```

## The Marker Protocol — drift-free progress

This is the kit's core mechanism. Every scaffolded stub calls a marker helper:

```ts
// emitted once by scaffold, e.g. src/_ptk/stub.ts
export function stub(path: string): never {
  throw new Error(`[ptk-stub] ${path}`);
}

// every stub:
/** Registers a user. Returns User. Throws DuplicateEmail on conflict. */
export async function signup(input: SignupInput): Promise<User> {
  return stub("auth.service.signup");
}
```

**The frontier** (what's left to fill) is found by grepping `stub()` call sites — no progress file to maintain or drift from. Each `.ptk-scaffold` sentinel's first non-comment line is the ERE pattern for its tree's stub call sites:

```bash
# Read the pattern from each sentinel, grep under its directory
pat=$(grep -vE '^\s*(#|$)' "$SENTINEL" | head -1)
grep -rnE "$pat" "$SENTINEL_DIR"   # empty output → done
```

> **Search for call sites, not the error tag.** The string `ptk-stub` only appears in the helper's `throw` — the **runtime diagnostic** when an unfilled stub executes. Searching `ptk-stub` finds the 1-line helper definition regardless of how many stubs exist. Search for the `stub("…")` call sites instead.

> **The frontier pattern is language-specific.** Scaffold derives it from the literal stub syntax it emits and writes it into each sentinel. Execute/verify/finalize read it from there — no hardcoded patterns.

Two layers of defense:
1. **Scope** — grep only under sentinel dirs, so stray matches elsewhere are invisible.
2. **Per-tree pattern** — scaffold recorded the exact call-site syntax, so the query matches real stubs and skips the helper definition, imports, and unrelated code.

`.ptk-scaffold` sentinels are written by scaffold, removed by finalize. Committed (never gitignored), so the frontier survives `/new` and resumes cleanly across sessions.

## Recursive Re-stubbing (stepwise refinement)

If execute finds a fill too complex (>~15 lines, multiple responsibilities, can't name it in one sentence), it **doesn't force it.** It extracts sub-functions as new `stub()` call sites:

```ts
// Instead of writing a 40-line signup, extract:
export async function signup(input: SignupInput): Promise<User> {
  await validateSignupInput(input);     // new stub: auth.service.validateSignupInput
  await ensureNoConflict(input.email);  // new stub: auth.service.ensureNoConflict
  return repo.insert(input);
}
```

The new stubs appear in the next frontier query automatically. The skeleton *improves* as you learn what it actually needs — no re-planning step required.

## Hazard Checkpoints

Scaffold runs a production-hazard audit against the skeleton and annotates risky stubs with `// HAZARD:`. Execute gates on those — it pauses at `CHECKPOINT: done` after filling a hazard stub, so you review the production-risk handling before it commits.

## Key Invariants

These hold at every commit:

1. **The tree compiles and type-checks.** Stub bodies return `never`/panic; they don't break callers.
2. **Every commit is green.** Filled stubs have passing tests; unfilled stubs are `it.todo`/`t.Skip` (skipped, not failing).
3. **The frontier is grep-queryable.** No separate status file to drift from reality.
4. **Scaffold emits shape, execute emits behavior.** No logic in scaffold; no new architecture in execute (only sub-stub refinement).

## The Skills

For the full per-skill reference, read each `SKILL.md` directly:

- [`ptk-brainstorming`](../skills/ptk-brainstorming/SKILL.md) — why/what, decisions doc, triage
- [`ptk-scaffold`](../skills/ptk-scaffold/SKILL.md) — skeleton + hazard check + checkpoint
- [`ptk-execute`](../skills/ptk-execute/SKILL.md) — fill stubs layer by layer
- [`ptk-verify`](../skills/ptk-verify/SKILL.md) — security / optimization / traceability review
- [`ptk-finalizing`](../skills/ptk-finalizing/SKILL.md) — strip artifacts, archive, ship (incl. swap step)
- [`ptk-modify`](../skills/ptk-modify/SKILL.md) — change existing behavior (characterize → change → repin)
- [`ptk-diagnose`](../skills/ptk-diagnose/SKILL.md) — 6-phase debug loop