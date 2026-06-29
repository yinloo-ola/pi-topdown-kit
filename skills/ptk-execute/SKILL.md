---
name: ptk-execute
description: "Use this after ptk-scaffold to fill the stub() markers layer by layer. Finds stub() call sites (the frontier) using whatever search tool is available, fills one stub + its unit test per increment (red -> green), recursively re-stubs when a fill is too complex, and keeps the tree green at every commit. Use when the user says 'execute', 'fill the stubs', 'implement', or after a skeleton has been committed."
---

# Execute

Fill the stubs the scaffold left behind. **Layer by layer** (top-down), one stub + its unit test per increment, kept green at every commit. When a fill is too complex, recursively re-stub it — stepwise refinement in action.

> **What execute is NOT:** execute emits *behavior*, not architecture. If you find yourself adding new modules, new layers, or rethinking the shape, stop — that's `ptk-scaffold`'s job. Execute fills the skeleton as given; the only architecture it adds is **sub-stubs** extracted from a too-complex fill (which is refinement, not redesign).

## Before you start

1. **Check git state** — run `git status` and `git log --oneline -5`. Note any uncommitted changes.
2. **Find the skeleton** — there must be a committed skeleton (last commit message starts with `scaffold:`) containing `stub()` call sites and `.ptk-scaffold` sentinels. If none exists, say "No skeleton found. Run `/skill:ptk-scaffold` first." and stop.
3. **Read the decisions doc** — `docs/plans/*-decisions.md` — for context on what the feature is meant to do. **Read `docs/lessons.md`** if it exists — follow every rule while working.
4. **Find the sentinel dirs and pick the feature** — `.ptk-scaffold` files mark the active frontier. Find every one under the repo (excluding `node_modules`). Use whatever file-search tool you have — the builtin `find`, `fffind`, an extension, or a simple `ls`-glob; the goal is the list of sentinel paths.

   **If more than one sentinel exists**, several features are in flight. Do not search them all (that would interleave fills from different features). Instead, read each sentinel's `# feature:` line and ask the user which feature to work on. (Use any file-read tool to get the line — the builtin `read`, `grep`, or `bash cat`.) Example, bash form:
   ```
   for f in $(find . -name '.ptk-scaffold'); do
     echo "$f -> $(grep '^# feature:' "$f" | head -1)"
   done
   ```
   Remember the chosen sentinel's path and directory, and scope **every** frontier query below to that directory. If a sentinel has no `# feature:` line (older format), use its directory path as the label.

   The frontier is the set of stubs under the chosen sentinel's directory.

## The frontier

The live, drift-free todo list. No progress file — the codebase's own searchability tracks progress.

> **Query for call sites, not the error tag.** Stubs are written as a call to the marker helper (e.g. `return stub("dotted.path")` in TS, `Stub("dotted.path")` in Go, `stub "dotted.path"` in Haskell). The string `ptk-stub` only appears in the helper's `throw`/`panic` message — it's the **runtime diagnostic** you see when an unfilled stub actually executes, NOT the frontier query. Searching for `ptk-stub` finds the 1-line helper definition regardless of how many stubs exist. Search for the **call sites** instead.

> **The frontier pattern is language-specific, so it's not hardcoded here.** `ptk-scaffold` derived it from the stub syntax it emitted and wrote it into each `.ptk-scaffold` sentinel's first non-comment line. Read it from there — this skill stays language-agnostic.

Find all stub call sites under the chosen sentinel's directory. The sentinel's first non-comment line is the ERE that matches this tree's call sites — read it and use it as your search pattern.

Use whatever search tool you have available. The builtin `grep` works; a structural search extension (e.g. `ast_search`) is more precise if present; use what fits. Bash example:
```bash
# $SENTINEL = chosen .ptk-scaffold path; $SENTINEL_DIR = its directory
pat=$(grep -vE '^\s*(#|$)' "$SENTINEL" | head -1)   # first non-comment line is the ERE
grep -rnE "$pat" "$SENTINEL_DIR"                  # what's pending; empty → done
grep -rn 'it.todo\|t.Skip' "$SENTINEL_DIR"          # also check no test placeholders remain
```

The goal, not the tool, is what matters: every match is an unfilled stub; when the search returns nothing (and no `it.todo`/`t.Skip` markers remain), the frontier is empty. Two layers of defense make the query trustworthy regardless of tool: (1) **scope** — search only under the chosen sentinel's directory, so stray matches elsewhere in the repo are invisible; (2) **per-tree pattern** — scaffold recorded the exact call-site syntax for this tree's language, so the query matches real stubs and skips the helper definition, imports, and unrelated code.

> **Phase awareness.** `ptk-execute` runs with the guard unlocked (phase=null), so bash pipelines including `for`/`while` loops over sentinels are fine here. But `ptk-verify` and `ptk-brainstorm` run in *blocking* phases where the guard restricts bash to read-only commands and blocks shell loops (`for`/`while` with `;` get split and fail the allowlist). If you ever need this query during a blocking phase, prefer non-bash tools (the `find`/`grep`/`read` builtins, or an extension) over bash pipelines.

> **Fallback** if a sentinel is empty or unreadable: default the pattern to `stub\("` (the C-family default) and warn the user that the sentinel may be malformed.

The runtime error tag `[ptk-stub] <path>` is still useful as a separate signal: when an unfilled stub executes during a test or at runtime, the thrown error names exactly which stub is missing — a focused diagnostic distinct from the frontier listing.

**Recursive spawn:** when you create a new sub-stub during a fill, just write it as another `stub("...")` call with its own doc comment and `it.todo`. It shows up in the next frontier query automatically. No bookkeeping.

## Per-increment execution

For each stub fill:

### 1. Pick the next stub (top-down)

Prefer the **highest layer first** — fill an API/handler stub before the service stub it calls, the service before the repo. Within a layer, fill in dependency order (a stub whose callees are already filled before one whose aren't, where possible).

If a stub carries a `// HAZARD:` annotation, note it — you'll gate on it at step 6.

### 2. Make the test real (red)

The stub's test placeholder (`it.todo` / `t.Skip`) becomes a concrete test. The stub's **doc comment is the spec** — translate it into `Given/When/Then` assertions:

```ts
// Before (scaffold left this):
it.todo("signup: returns User for valid input");

// After (you write this):
it("signup: returns User for valid input", async () => {
  const result = await signup({ email: "a@b.com", password: "secure123" });
  expect(result).toMatchObject({ email: "a@b.com" });
  expect(result.id).toBeDefined();
});
```

Add the edge cases the doc comment implies (thrown errors, boundary inputs). One stub → one or more concrete tests.

**Before running tests, verify the test environment is sandboxed** — no real DB connections, API calls, or live services. External dependencies must be mocked or stubbed. Set `NODE_ENV=test` / `GO_ENV=test` / equivalent.

Run the test → **confirm it fails** (red). If it passes immediately, either the stub was already filled (skip it) or the test is wrong.

### 3. Fill the stub (green)

Replace `return stub("...")` with the simplest code that passes the test. Focus on the **Pragmatic Developer frame** — minimal correct code, no over-engineering, no code for future requirements.

```ts
export async function signup(input: SignupInput): Promise<User> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new DuplicateEmail();
  return repo.insert(input);
}
```

The `stub("...")` call is gone — this stub is now filled.

### 4. Recursive re-stub if too complex

If the fill is too big to fit comfortably (more than ~15 lines, multiple unrelated responsibilities, or you can't name what it does in one sentence), **don't force it.** Extract sub-functions as new stubs:

```ts
// Instead of writing a 40-line signup, extract:
export async function signup(input: SignupInput): Promise<User> {
  await validateSignupInput(input);          // new stub: auth.service.validateSignupInput
  await ensureNoConflict(input.email);       // new stub: auth.service.ensureNoConflict
  return repo.insert(input);
}

/** Throws InvalidInput if the signup data is malformed. */
export async function validateSignupInput(input: SignupInput): Promise<void> {
  return stub("auth.service.validateSignupInput");
}

/** Throws DuplicateEmail if the email is already registered. */
export async function ensureNoConflict(email: string): Promise<void> {
  return stub("auth.service.ensureNoConflict");
}
```

Each new stub gets its own doc comment and `it.todo`. They appear in the next frontier query. The top-level `signup` is now "filled" (its body is real code that happens to call sub-stubs) — its test passes against the sub-stub failures (mock them) or is deferred until the sub-stubs fill.

This is stepwise refinement: fill, discover complexity, defer to a sub-stub. Self-similar. The skeleton improves as you learn what it actually needs.

### 5. Run — tree must be green

```
npm test    # your filled test passes; all other stubs still it.todo (skipped, not failing)
```

**Every commit is green.** Filled stubs have passing tests; unfilled stubs are `it.todo`/`t.Skip` (skipped, not failing). The tree compiles throughout (stub bodies return `never`/panic, which type-check).

### 6. ⏸ CHECKPOINT: done (only at HAZARD stubs)

Only if the stub you just filled carried a `// HAZARD:` annotation from scaffold. Stop. Do not commit yet.

Run `git diff` and present:

```
⏸ Paused at checkpoint: done for stub <dotted.path>

**Stub filled:** <function signature>
**Hazard annotation:** <the // HAZARD: comment from scaffold>
**Test results:** <paste passing output>
**Diff:** [paste the fill diff]
**Hazard mitigation:** <how this fill addresses the hazard — e.g. "throttled to 10 concurrent via p-limit">

What would you like to do?
- **approve** — commit and continue
- **request changes** — tell me what to change
- **revert** — undo and put the stub() back
- **stop** — pause here
```

Stubs without a `// HAZARD:` annotation do not checkpoint — fill them, test green, commit, continue.

### 7. Learn from mistakes

If you caught yourself making a mistake that would apply to future fills, append a rule to `docs/lessons.md`. Apply the **generalization test**: would this rule apply equally to a different feature or domain? If not, rewrite it generic or don't write it.

### 8. Commit

```
git add -A
git commit -m "feat: fill <dotted.path> (+ <N> sub-stubs spawned)

<one-line behavior summary>. Tree green: <test count> passing, <M> stubs remaining."
```

One commit per increment (or per tightly-related group of fills in the same layer). Keep commits small and reviewable.

### 9. Suggest session break if needed

After ~3-5 fills, suggest:
```
✅ Filled N stubs (commits: abc, def, ...)
Frontier: X stubs remaining
⏭  Next: <dotted.path> — <doc-comment summary>

💡 Context is building up. For clean context on remaining fills:
   /new  then  /skill:ptk-execute
   (the frontier grep picks up exactly where you left off — no progress file to sync)
```

Respect the user's choice if they say "continue".

### 10. Loop

Back to step 1. When the frontier is empty (grep returns nothing under all sentinels AND no `it.todo`/`t.Skip` markers remain), see [After all stubs](#after-all-stubs).

## After all stubs

When the frontier is empty:

```
✅ Frontier empty — all stubs filled.

| Layer | Filled | Sub-stubs spawned |
|-------|--------|-------------------|
| handler | 4 | 0 |
| service | 6 | 3 |
| repo | 3 | 0 |

   - Verify everything: /skill:ptk-verify
   - Ship: /skill:ptk-finalize
```

## Resume across sessions

No progress file to sync. `/new` + `/skill:ptk-execute` picks up exactly where you left off — the frontier grep finds the remaining stubs. The skeleton + sentinels are committed, so a fresh session rebuilds full context from the repo itself.

## User override commands

| User says | Agent does |
|-----------|------------|
| `skip` | Leave current stub as `stub(...)`, move to next (its `it.todo` stays) |
| `status` | Show the frontier grep + count |
| `stop` | Stop filling, suggest `/new` to resume later |
| `retry` | Re-read the stub's doc comment, revert the fill, start over |
| `frontier` | Re-run the grep and show pending stubs by layer |

## If you're stuck

1. Re-read the stub's doc comment — it's the spec. If it's ambiguous, the scaffold was incomplete; consider asking the user to re-scaffold that stub.
2. Check the decisions doc — the feature's intent may clarify the fill.
3. **Recursive re-stub** — if the fill is hard because the function is doing too much, extract sub-stubs (step 4). Don't force a complex fill.
4. Check `docs/lessons.md` — a previous lesson may apply.
5. Ask the user. Better to clarify than guess wrong.

## Principles

- **Behavior, not architecture.** Fill stubs as given. The only new structure you add is sub-stubs extracted from a too-complex fill. New modules/layers = re-scaffold.
- **One stub, one increment.** Fill one stub, make its test real, run green, commit. Don't batch unrelated fills.
- **The doc comment IS the spec.** Translate it into the test. If the comment is incomplete, the scaffold was wrong — flag it rather than guessing.
- **Every commit is green.** Filled stubs pass their tests; unfilled stubs skip. The tree compiles throughout.
- **Re-stub freely.** Stepwise refinement is the escape hatch for complexity. A 40-line fill is a signal, not a failure — extract sub-stubs and defer.
- **Top-down preference.** Fill high layers first so the call chain is exercised end-to-end as early as possible.