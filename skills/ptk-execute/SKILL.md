---
name: ptk-execute
description: "Use this after ptk-scaffold to fill the stub() markers layer by layer. Finds stub() call sites (the frontier) using whatever search tool is available, fills one stub + its unit test per increment (red -> green), recursively re-stubs when a fill is too complex, and keeps the tree green at every commit. Use when the user says 'execute', 'fill the stubs', 'implement', or after a skeleton has been committed."
---

# Execute

Fill the stubs scaffold left behind. **Layer by layer** (top-down), one stub + its unit test per increment, kept green at every commit. When a fill is too complex, recursively re-stub it.

> **Execute is NOT:** it emits *behavior*, not architecture. If you find yourself adding modules, layers, or rethinking the shape, stop — that's `ptk-scaffold`. The only new structure execute adds is **sub-stubs** extracted from a too-complex fill.

## Before you start

1. **Check git state** — `git status` and `git log --oneline -5`. Note uncommitted changes.
> **CWD check:** Before any repo-scoped command (`git`, build, test), run `pwd && git rev-parse --show-toplevel`.
> If it doesn't match the project you're editing, run commands as `cd <project-root> && <command>`.
2. **Find the skeleton** — there must be `.ptk-scaffold` sentinels with `stub()` call sites on disk, and a `scaffold:` commit in history. (On resume the last commit may be `feat: fill …` — the sentinel + call sites on disk are the real signal, not the most-recent commit message, which scrolls off `git log -5`.) If none exist: "No skeleton found. Run `/skill:ptk-scaffold` first." and stop.
3. **Read `docs/plans/*-decisions.md`** for feature intent. Read `docs/lessons.md` if it exists — follow every rule.
4. **Pick the feature** (if several sentinels exist) — read each sentinel's `# feature:` line and ask the user which to work on. Remember the chosen sentinel's path and directory; scope **every** frontier query below to that directory.

## The frontier

Unfilled stubs are found by grep — no progress file to maintain. Read the sentinel's first non-comment line (the ERE for this tree's call sites) and grep it under the sentinel's directory:

```bash
# $SENTINEL = chosen .ptk-scaffold;  $SENTINEL_DIR = its directory
pat=$(grep -vE '^\s*(#|$)' "$SENTINEL" | head -1)   # first non-comment line is the ERE
grep -rnE "$pat" "$SENTINEL_DIR"                     # empty output → frontier is done
```

- **Search the call sites** (e.g. `stub("…")`), not the `ptk-stub` error tag — that string only names the 1-line helper definition, regardless of how many stubs exist.
- **Scope to the sentinel dir** so stray matches elsewhere are invisible. The sentinel's pattern (written by scaffold) already skips the helper, imports, and unrelated code.
- **Malformed sentinel?** Default the pattern to `stub\("` (C-family default) and warn the user.
- Use whatever search tool you have (builtin `grep`, an extension, `find`). Every match is an unfilled stub; when the grep returns nothing, the frontier is empty.
- **Recursive spawn:** a new sub-stub is just another `stub("…")` call + `it.todo` — it shows up in the next query automatically. No bookkeeping.

> **Phase awareness.** Execute runs with the guard unlocked, so bash pipelines (`for`/`while` over sentinels) work here. (`ptk-verify` and `ptk-brainstorm` run in *blocking* phases where the guard blocks shell loops — if you ever need this query there, use the `find`/`grep`/`read` builtins instead.)

## Per-increment execution

### 1. Pick the next stub (top-down)

Prefer the **highest layer first** — handler before the service it calls, service before repo. Within a layer, fill in dependency order (callees filled before callers, where possible). Note any `// HAZARD:` annotation — you'll gate on it at step 6.

### 2. Make the test real (red)

The stub's `it.todo` / `t.Skip` becomes a concrete test. The stub's **doc comment is the spec** — translate it into Given/When/Then, plus the edge cases it implies (thrown errors, boundary inputs).

```ts
// Before:  it.todo("signup: returns User for valid input");
// After:
it("signup: returns User for valid input", async () => {
  const result = await signup({ email: "a@b.com", password: "secure123" });
  expect(result).toMatchObject({ email: "a@b.com" });
  expect(result.id).toBeDefined();
});
```

Verify the test env is sandboxed (no real DB/API/services; `NODE_ENV=test` or equivalent). Run → **confirm it fails (red)**. If it passes immediately, the stub was already filled (skip) or the test is wrong.

### 3. Fill the stub (green)

Replace `return stub("…")` with the simplest code that passes the test — no over-engineering, no code for future requirements.

```ts
export async function signup(input: SignupInput): Promise<User> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new DuplicateEmail();
  return repo.insert(input);
}
```

### 4. Re-stub if too complex

If a fill is too big (>~15 lines, multiple unrelated responsibilities, or you can't name it in one sentence), don't force it — extract sub-functions as new stubs:

```ts
export async function signup(input: SignupInput): Promise<User> {
  await validateSignupInput(input);      // new stub: auth.service.validateSignupInput
  await ensureNoConflict(input.email);   // new stub: auth.service.ensureNoConflict
  return repo.insert(input);
}
```

Each new stub gets its own doc comment and `it.todo`; they appear in the next query. The top-level is now "filled" (its body is real code that calls sub-stubs). This is stepwise refinement — fill, discover complexity, defer.

### 5. Run — tree must be green

```
npm test    # filled test passes; all other stubs still it.todo (skipped, not failing)
```

Every commit is green: filled stubs pass their tests, unfilled stubs skip, the tree compiles throughout.

### 6. ⏸ CHECKPOINT: done (only at HAZARD stubs)

Only if the stub you just filled carried a `// HAZARD:` annotation. Stop. Do not commit yet. Run `git diff` and present:

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

Stubs without a `// HAZARD:` annotation do not checkpoint — fill, test green, commit, continue.

### 7. Commit

```
git add -A
git commit -m "feat: fill <dotted.path> (+ <N> sub-stubs spawned)

<one-line behavior summary>. Tree green: <test count> passing, <M> stubs remaining."
```

One commit per increment (or per tightly-related group in the same layer). If you caught a repeat-mistake pattern that would apply to other features/domains, append a generic rule to `docs/lessons.md` (skip domain-specific notes).

### 8. Loop

Back to step 1. When the frontier is empty (the stub-call-site grep returns nothing under all sentinels), see [After all stubs](#after-all-stubs). The call sites are the whole signal — there's no separate test-placeholder grep: a filled stub converts its own `it.todo`/`t.Skip` in the same increment (step 2), and a skipped stub keeps both its `stub()` call site and its placeholder, so the call-site grep stays non-empty until it's actually filled. (This keeps the gate language-agnostic — the placeholder marker name varies across JS/Go/Python/etc.)

After ~3-5 fills, suggest a context break:

```
✅ Filled N stubs (commits: abc, def, …)
Frontier: X stubs remaining
⏭  Next: <dotted.path> — <doc-comment summary>

💡 Context building up. For clean context on remaining fills:
   /new  then  /skill:ptk-execute
   (the frontier grep picks up exactly where you left off — no progress file to sync)
```

Respect "continue". (That grep is also the cross-session resume guarantee: `/new` + re-run execute rebuilds full context from the committed skeleton + sentinels.)

## After all stubs

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

## User overrides

| User says | Agent does |
|-----------|------------|
| `skip` | Leave current stub as `stub(...)`, move to next (its `it.todo` stays) |
| `status` / `frontier` | Re-run the grep and show pending stubs by layer |
| `stop` | Stop filling, suggest `/new` to resume later |
| `retry` | Re-read the stub's doc comment, revert the fill, start over |

## Principles

- **Behavior, not architecture.** Fill stubs as given. New modules/layers = re-scaffold.
- **One stub, one increment.** Fill one, make its test real, run green, commit.
- **The doc comment IS the spec.** Translate it into the test. If it's incomplete, the scaffold was wrong — flag it rather than guessing.
- **Re-stub freely.** A 40-line fill is a signal, not a failure — extract sub-stubs.
- **Top-down preference.** Fill high layers first so the call chain is exercised early.