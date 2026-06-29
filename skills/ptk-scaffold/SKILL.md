---
name: ptk-scaffold
description: "Use this after ptk-brainstorming to materialize the system design blueprint as real code in the repo. Reads the decisions doc, emits a layered skeleton (files, types, named+documented stub() stubs, it.todo test placeholders), runs a production-hazard check, then pauses at a skeleton review checkpoint before any logic is written. The skeleton IS the plan — ptk-execute fills stubs layer by layer. Use when the user says 'scaffold', 'skeleton', 'lay out the modules', or after a brainstorm decisions doc is complete."
---

# Scaffold

Materialize the system design blueprint as **real code** in the repo. This is where the chunking benefit lands: the human reviews the entire system's shape — layering, module boundaries, names, signatures — as a `git diff`, before any logic exists.

> **What scaffold is NOT:** scaffold emits *shape*, not behavior. Every function body is a `stub("...")` call that throws. No logic. No real test assertions. The skeleton compiles and type-checks, tests are placeholders (`it.todo` / `t.Skip`), but nothing actually runs end-to-end. Behavior is `ptk-execute`'s job.

This skill absorbs what other kits split into "writing-plans" + "design-review": the plan *is* the skeleton (real code, not markdown prose), and the hazard audit happens against that skeleton at the review checkpoint.

## Before you start

1. **Check git state** — run `git status` and `git log --oneline -5`. Note any uncommitted changes.
2. **Find the decisions doc** — look for `docs/plans/*-decisions.md`. If none exists, say "No decisions doc found. Run `/skill:ptk-brainstorming` first." and stop. Read it in full.
3. **Extract the module outline** — the decisions doc's `## Module outline` section lists the modules/layers to create. If it's missing or too vague (just "auth stuff"), go back to the user and ask them to re-run brainstorm with a concrete outline.
4. **Suggest workspace isolation** — if the user isn't already on a feature branch or worktree, offer:
   - **Branch** (smaller skeletons): `git checkout -b <feature-name>`
   - **Worktree** (larger skeletons, keeps main clean): `git worktree add ../<repo>-<feature-name> -b <feature-name>`

   Derive `<feature-name>` from the decisions doc topic. Ask the user which they prefer, then wait for confirmation before proceeding. If worktree was chosen, move the decisions doc into the worktree and hand off to a new session (same pattern as other kits).

## Process

### 1. Plan the skeleton (in your head / scratchpad, not committed)

From the module outline, decide:
- **Files** — one file per module, organized by layer (handlers/, services/, repos/, etc. — follow the project's existing conventions).
- **Types** — full type/interface definitions needed for the skeleton to type-check. These are concrete (the skeleton must compile). Types are not "logic" — they're shape.
- **Stubs** — every function/method the outline implies. Each gets:
  - A **one-line doc comment** naming what it does (this is the spec execute will test against).
  - A `stub("module.function")` body.
- **Test files** — one per module. Each stub gets an `it.todo("...")` (vitest/jest) or `t.Skip` (Go) placeholder. Never a real assertion yet.

### 2. Emit the `stub()` marker helper

Create the marker helper **once per language**. This is the kit's progress-tracking mechanism — `ptk-execute` greps for it to find unfilled stubs.

**TypeScript** — `src/_ptk/stub.ts` (or wherever the project keeps internal utils):
```ts
/** Marker for unfilled stubs. ptk-execute finds these via grep and fills them.
 *  Removed by ptk-finalize once the frontier is empty. */
export function stub(path: string): never {
  throw new Error(`[ptk-stub] ${path}`);
}
```

**Go** — `internal/ptkstub/stub.go`:
```go
package ptkstub

import "fmt"

// Stub marks an unfilled stub. ptk-execute finds these via grep and fills them.
// Removed by ptk-finalize once the frontier is empty.
func Stub(path string) {
	panic(fmt.Sprintf("[ptk-stub] %s", path))
}
```

**Name collision:** if the target repo already defines `stub` / `Stub`, use `ptkStub` / `PtkStub` instead. Search before creating. Document the chosen name in the decisions doc so execute and finalize agree.

### 3. Emit the skeleton, layer by layer

Write the files. Top-down: start with the highest layer (handlers/API), descend through services to data/repo. Each function:

```ts
// src/auth/service.ts
import { stub } from "../_ptk/stub";
import type { User, SignupInput } from "./types";

/** Registers a user. Returns the created User. Throws DuplicateEmail on conflict. */
export async function signup(input: SignupInput): Promise<User> {
  return stub("auth.service.signup");
}

/** Authenticates credentials, returns a session token. Throws InvalidCredentials on mismatch. */
export async function login(email: string, password: string): Promise<string> {
  return stub("auth.service.login");
}
```

Every stub:
- Has a doc comment that is a **complete spec** (inputs, return, thrown errors). Execute writes the test from this comment.
- Calls `stub("dotted.path")` with a stable, unique path.
- Has no other logic.

### 4. Emit test placeholders

One test file per module. Each stub gets `it.todo` / `t.Skip`:

```ts
// src/auth/service.test.ts
import { describe, it } from "vitest";

describe("auth.service", () => {
  it.todo("signup: returns User for valid input");
  it.todo("signup: throws DuplicateEmail on conflict");
  it.todo("login: returns token for valid credentials");
  it.todo("login: throws InvalidCredentials on mismatch");
});
```

The todo strings echo the stub's doc comment — execute will expand each into a real test.

### 5. Write the sentinel (carries the frontier pattern)

Write a `.ptk-scaffold` file at the root of each scaffolded module tree. **Its first non-comment line is the ERE that matches this tree's stub call sites** — execute, verify, and finalize read it to find the frontier, so they never hardcode a language-specific pattern.

Derive the pattern from the literal stub syntax you just emitted — whatever a call site looks like in this language, grep for that. You wrote the stubs, so you know exactly what to search for:

| You wrote (call site) | Sentinel `.ptk-scaffold` contents | Language |
|---|---|---|
| `return stub("auth.signup")` | `stub\("` | TS/JS/Rust/Swift/Kotlin/Java/C#/… |
| `return Stub("auth.signup")` | `Stub\("` | Go |
| `stub "auth.signup"` | `\bstub "` | Haskell/Elm/OCaml (juxtaposition) |
| `ptk_stub("auth.signup")` | `ptk_stub\(["']` | Python (both quote styles; collision-renamed) |
| `(stub "auth.signup")` | `\(stub "` | Clojure/Lisp |

`#`-prefixed lines in the sentinel are comments and ignored by consumers; the first non-comment non-blank line is the pattern. This keeps the sentinel self-documenting:

```
# .ptk-scaffold — written by ptk-scaffold, removed by ptk-finalize.
# Frontier pattern (ERE): matches unfilled stub() call sites in this tree.
stub\("
```

Presence of `.ptk-scaffold` means "this tree is an active frontier — search here." Its pattern line says *how* to search. Execute greps each sentinel's pattern under that sentinel's directory.

```
src/.ptk-scaffold
src/auth/.ptk-scaffold   # if auth is a distinct subtree (e.g. a different language)
```

The sentinel is removed by `ptk-finalize` when its subtree's grep goes empty.

> **Don't gitignore it.** `.ptk-scaffold` must be committed so it survives across sessions and `/new`. It's not in any standard gitignore pattern; if the project has an aggressive dotfile ignore, explicitly `git add -f`.

> **Polyglot repos:** each sentinel carries its own tree's pattern, so a TS frontend and a Go backend each get a sentinel with the right ERE. No global pattern needs to cover both.

### 6. Run the hazard check (absorbed from design-review)

The skeleton now has real signatures and real layer boundaries — a better artifact to audit than prose. Put on your **SRE Hat** and run the production-hazard checklist against it.

**Architectural Pillars** (1-2 sentence assessment each):
1. **Robustness & Fault Tolerance** — how expected failures are handled, subsystem isolation, graceful degradation.
2. **Atomicity & Consistency** — transactions, rollback on error, endpoint idempotency.
3. **Security & Access Control** — validation/sanitization, authorization at the boundary.
4. **Scalability & Performance** — pooling, resource leaks, N+1 prevention.
5. **Backwards Compatibility** — migration safety, zero-downtime, API versioning.
6. **Testability** — injection seams for external deps (clocks, randomizers, network) for deterministic tests.

**High-Risk Hazards** — for each, write `[SAFE]` (with justification) or `[TRIGGERED]` (with mitigation):
1. **Unbounded Redis Deletions / Operations** — multi-key deletion or scans (KEYS, raw SCAN loops) blocking single-threaded performance.
2. **In-Memory OOM Loops** — fetching whole DB datasets into memory to filter/sort/map in runtime heap.
3. **Unbounded Concurrency Spikes** — unthrottled `Promise.all` / goroutine spawns without batch limits.
4. **Missing High-Frequency Indexes** — queries on unindexed columns forcing table scans under load.
5. **Nested/Long-Running Transactions** — holding DB connections/locks open across slow external HTTP, disk, or crypto.
6. **Unrestricted Uploads & Temp Flooding** — uploads to local temp paths without limits or `finally` cleanup.
7. **Raw Query String Interpolation** — merging raw vars into SQL or shell inputs (injection).
8. **Silent Swallowing Loops** — background workers/crons catching and suppressing exceptions without logging, back-offs, or alerts.

**Socratic Heuristics**:
- **Scale to 100x** — if run 100x/sec or on 100k items, what breaks? (memory, CPU, disk, sockets, DB connections)
- **Hostile World** — if a malicious actor controls these inputs (headers, payloads, IDs), how can they exploit/crash/extract?
- **Silent Error** — if this downstream dependency hangs or fails silently, how does the server react? Timeout? Back-off? Logging?

**For every triggered hazard or Socratic risk**, annotate the relevant stub in the skeleton with a `// HAZARD:` comment so execute knows to pause for review when filling it:

```ts
/** Processes a batch of uploads. */
// HAZARD: unbounded concurrency — throttle to N concurrent. See Socratic "Scale to 100x".
export async function processBatch(items: UploadItem[]): Promise<void> {
  return stub("upload.service.processBatch");
}
```

### 7. Verify the skeleton compiles and tests are placeholders

```
npx tsc --noEmit         # or: go build ./..., cargo check, etc.
npm test                 # vitest: all tests are it.todo → reported as skipped, not failed
```

The tree must be **green**: it compiles, type-checks, and the only test output is skips (no failures). If anything fails, the skeleton is malformed — fix it before the checkpoint.

### 8. ⏸ CHECKPOINT: skeleton — present for review

This is the deliberate "review the whole shape" gate. Stop. Do not commit yet.

Show the skeleton. Its files are brand-new (untracked), so a plain `git diff` prints nothing — instead either show file contents directly, or stage-then-diff: `git add -N <files>` then `git diff`, or `git add <files>` then `git diff --cached`. Present:

```
⏸ Paused at checkpoint: skeleton

**Decisions doc:** docs/plans/YYYY-MM-DD-<topic>-decisions.md
**Modules scaffolded:** <list — e.g. auth/handler, auth/service, auth/repo>
**Stubs emitted:** <N> functions across <M> files
**Sentinels:** <paths>
**Marker helper:** <path + chosen name (stub or ptkStub)>

**Hazard check:**
- Pillars: <one-line summary — e.g. "5/6 green, Testability flagged: no clock seam in scheduler">
- Hazards: <e.g. "2 triggered — annotated at upload.service.processBatch, auth.repo.bulkInsert">
- Socratic: <e.g. "Scale-to-100x: bulkInsert flagged">

**Build:** <tsc / go build result — must be clean>
**Tests:** <N skipped (it.todo), 0 failed>

**Diff:** [paste the full skeleton diff]

What would you like to do?
- **approve** — I'll commit the skeleton and hand off to /skill:ptk-execute
- **request changes** — tell me what to change (rename a module, add a layer, split a stub, drop a hazard annotation)
- **revert** — undo the skeleton and go back
- **stop** — pause here, resume later with /skill:ptk-scaffold
```

### 9. On approval: commit and hand off

```
git add -A
git commit -m "scaffold: <feature> skeleton (<N> stubs, <M> modules)

Skeleton blueprint for <feature>. All functions are stub() placeholders;
ptk-execute fills them layer by layer. Tree compiles, tests are it.todo
placeholders (skipped, not failing)."
```

Then: "Skeleton committed. Ready to fill? Run `/skill:ptk-scaffold`'s sibling: `/skill:ptk-execute`"

## Principles

- **Shape, not behavior.** If you find yourself writing logic, stop — that's execute's job. The skeleton is a map, not the territory.
- **The doc comment IS the spec.** Execute writes the test from it. Make it complete: inputs, return, thrown errors. "Registers a user" is too vague; "Registers a user, returns the created User, throws DuplicateEmail on conflict" is a spec.
- **One stub, one behavior.** If a function does two things, split it into two stubs. Execute fills one behavior per increment.
- **Top-down layering.** Emit handlers before services before repos. The review reads top-down, matching how experts chunk code.
- **The skeleton compiles.** Every commit leaves the tree green. Stubs return `never`/panic, so callers type-check; tests are `it.todo`/`t.Skip`, so the suite is green.
- **Don't over-stub.** If the module outline doesn't imply a function, don't create it. YAGNI applies to the skeleton too — execute can recursively re-stub if a fill needs a helper.

## After the scaffold

Ask: "Ready to fill? Run `/skill:ptk-execute`"