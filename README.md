# pi-topdown-kit

> Scaffold-first, top-down layered workflow for AI coding agents. The skeleton IS the plan.

[pi](https://github.com/badlogic/pi-mono) package. Zero configuration required.

AI coding agents jump to code too fast and produce over-engineered or misaligned systems. **pi-topdown-kit** solves this by forcing a **scaffold-first** workflow: the agent must produce a reviewable skeleton of the entire system — real code, compilable, with `stub()` markers everywhere — *before* it writes any behavior. You review the whole shape as a diff. Only then does it fill stubs, layer by layer.

This is the classical discipline of **stepwise refinement** (Wirth, 1971) and **"programming by wishful thinking"** (SICP), driven by a cognitive-load argument: expert programmers read code top-down by *chunking* familiar lines into high-level concepts. Layered, top-down production matches that mental model — the agent produces code shaped the way you read it.

## Install

```bash
pi install npm:@tianhai/pi-topdown-kit
```

No setup needed — skills and guards activate automatically after install.

**Want to try before committing?**

```bash
pi -e npm:@tianhai/pi-topdown-kit
```

## What You Get

### 🛡️ Workflow Guard (extension)

Enforces phase-appropriate tool access — hard blocks, not guidelines:

| Phase | `write` / `edit` | `bash` |
|-------|:-:|:-:|
| **Brainstorm** / **Verify** | 🔒 Blocked outside `docs/plans/` | 🔒 Read-only only (grep, find, cat, git status, curl…) |
| **Scaffold** / **Execute** / **Finalize** | ✅ Full access | ✅ Full access |

The agent can discuss design with you during brainstorm, but it physically cannot modify source files until scaffold.

### 🧠 6 Workflow Skills

```
brainstorm → scaffold → execute → [verify?] → finalize
 (why/what)   (shape)    (behavior)  (review)    (ship)
                ↕
             diagnose (anytime)
```

| Phase | Trigger | What Happens |
|-------|---------|--------------|
| **Brainstorm** | `/skill:ptk-brainstorming` | Ask questions, explore approaches, record decisions, sketch the module outline. Output: a lightweight `*-decisions.md` (problem, approaches, decisions, module outline). |
| **Scaffold** | `/skill:ptk-scaffold` | Read the decisions doc → emit the skeleton: layered files, full types, named+documented `stub()` stubs, `it.todo` tests, `.ptk-scaffold` sentinels. Runs a production-hazard check. **Pauses at `CHECKPOINT: skeleton`** for you to review the whole shape. |
| **Execute** | `/skill:ptk-execute` | Grep the frontier → fill one stub + its unit test per increment (red→green). Recursively re-stub when a fill is too complex. Tree stays green at every commit. |
| **Verify** | `/skill:ptk-verify` | Three expert review passes (security, optimization, traceability) on the filled code. |
| **Finalize** | `/skill:ptk-finalizing` | Remove `.ptk-scaffold` sentinels + `stub()` helper, archive decisions doc, update README/CHANGELOG, create PR. |
| **Diagnose** | `/skill:ptk-diagnose` | 6-phase debugging loop: reproduce → hypothesize → instrument → fix. Utility skill, any time. |

There is **no `writing-plans` skill**. The skeleton *is* the plan — real, compilable code, not markdown prose.

## The Workflow in Detail

### Phase Control

You control each phase — the agent never advances on its own:

```
/skill:ptk-brainstorming   →  discuss and decide (writes only docs/plans/)
/skill:ptk-scaffold         →  emit the skeleton (writes source), then pause for review
/skill:ptk-execute          →  fill the stubs layer by layer
/skill:ptk-verify           →  review the filled code
/skill:ptk-finalizing       →  ship it
```

### The Marker Protocol — drift-free progress

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

**The frontier** (what's left to fill) is found by grepping `stub()` call sites — no progress file to maintain or drift from:

Example, bash form:
```bash
# Each .ptk-scaffold sentinel's first non-comment line is the ERE for its tree's
# stub call sites (scaffold derived it from the syntax it emitted). Read the
# pattern and search — use whatever tool you have (grep, ast_search, ffgrep, …):
find . -name '.ptk-scaffold' -print0 | while IFS= read -r -d '' f; do
  grep -rnE "$(grep -vE '^\s*(#|$)' "$f" | head -1)" "$(dirname "$f")"
done                       # what's pending; empty output → done
```

> **Search for call sites, not the error tag.** The string `ptk-stub` only appears in the helper's `throw`/`panic` message — the **runtime diagnostic** you see when an unfilled stub actually executes, not the frontier query. Searching `ptk-stub` finds the 1-line helper definition no matter how many stubs exist. Search for the `stub("…")` call sites instead.

> **The frontier pattern is language-specific, so it isn't hardcoded.** `ptk-scaffold` derives it from the literal stub syntax it just emitted (e.g. `stub\(` for TS, `Stub\(` for Go, `\bstub "` for Haskell) and writes it into the `.ptk-scaffold` sentinel. Execute/verify/finalize read it from there and search — builtin `grep` works; a structural tool like `ast_search` is more precise where available.

Two layers of defense: (1) **scope** — grep only under sentinel dirs, so stray matches elsewhere are invisible; (2) **per-tree pattern** — scaffold recorded the exact call-site syntax, so the query matches real stubs and skips the helper definition, imports, and unrelated code.

`.ptk-scaffold` sentinels are written by scaffold, removed by finalize. Committed (never gitignored), so the frontier survives `/new` and resumes cleanly across sessions.

### Recursive Re-stubbing (stepwise refinement)

If execute finds a fill too complex (>~15 lines, multiple responsibilities, can't name it in one sentence), it **doesn't force it.** It extracts sub-functions as new `stub()` call sites with their own doc comments and `it.todo` tests:

```ts
export async function signup(input: SignupInput): Promise<User> {
  await validateSignupInput(input);     // new stub: auth.service.validateSignupInput
  await ensureNoConflict(input.email);  // new stub: auth.service.ensureNoConflict
  return repo.insert(input);
}
```

The new stubs appear in the next frontier query automatically. The skeleton *improves* as you learn what it actually needs — no re-planning step required.

### Hazard Checkpoints

Scaffold runs a production-hazard audit (6 pillars + 8 hazards + 3 Socratic heuristics) against the skeleton and annotates risky stubs with `// HAZARD:`. Execute gates on those — it pauses at `CHECKPOINT: done` after filling a hazard stub, so you review the production-risk handling before it commits.

### Key Invariants

These hold at every commit:

1. **The tree compiles and type-checks.** Stub bodies return `never`/panic; they don't break callers.
2. **Every commit is green.** Filled stubs have passing tests; unfilled stubs are `it.todo`/`t.Skip` (skipped, not failing).
3. **The frontier is grep-queryable.** No separate status file to drift from reality.
4. **Scaffold emits shape, execute emits behavior.** No logic in scaffold; no new architecture in execute (only sub-stub refinement).

## vs `pi-workflow-kit` (`pwk-`)

This kit is the **philosophical inverse** of [`@tianhai/pi-workflow-kit`](https://www.npmjs.com/package/@tianhai/pi-workflow-kit), maintained alongside it. Both are valid; pick per task.

| | `pi-workflow-kit` (`pwk-`) | `pi-topdown-kit` (`ptk-`) |
|---|---|---|
| **The plan is…** | markdown prose (`*-implementation.md`) | real code (the skeleton) |
| **Task shape** | vertical slices (signup = model+endpoint+UI) | layered fill (all handlers, then all services…) |
| **Progress tracking** | a `*-progress.md` status table | grep the `stub()` frontier |
| **Readability bias** | per-increment runnability (each task ships a working slice) | top-down shape review (review the whole skeleton first) |
| **Trade-off** | loses whole-system shape review | loses per-step end-to-end runnability |
| **Best for** | features where correctness per slice matters most | subsystems where architecture/shape matters most |

**They coexist.** Install both — no skill-prefix or extension conflicts (each tracks its own phase variable). Use `pwk-` for a CRUD endpoint you want working end-to-end today; use `ptk-` for a new subsystem whose shape you want to get right before any logic lands.

## Quick Start

```bash
# Install
pi install npm:@tianhai/pi-topdown-kit

# Start a new feature
> /skill:ptk-brainstorming
> I want to add a job-scheduling subsystem to our worker pool

# (agent asks questions, explores approaches, writes *-decisions.md
#  with problem/approaches/decisions/module-outline — no source writes yet)

> /skill:ptk-scaffold

# (agent emits the layered skeleton: scheduler/dispatcher.ts, scheduler/queue.ts,
#  scheduler/repo.ts — all stub() bodies, it.todo tests, .ptk-scaffold sentinels.
#  pauses at CHECKPOINT: skeleton — you review the whole shape as a diff)

# ...you approve...

> /skill:ptk-execute

# (agent greps stub() call sites via each sentinel's recorded pattern, fills dispatcher first,
#  recursively re-stubbing anything too complex. tree green at every commit)

> /skill:ptk-verify
> /skill:ptk-finalizing
```

## Why?

- **AI agents skip design.** Left unchecked, they jump to code and the shape emerges accidentally. This forces a think-shape-first workflow.
- **The skeleton is reviewable.** You read the whole system's shape — names, layers, boundaries — before any logic distracts you. Mistakes are one-line stub edits, cheap.
- **Progress can't drift.** The `stub()` frontier is grep. No status file to forget to update, no rows to go stale. The codebase's own grep-ability tracks where you are.
- **You stay in control.** Checkpoint gates at the skeleton review and at hazard stubs mean you approve the shape and the risky bits before they're committed.
- **Enforced, not suggested.** Hard blocks mean the agent can't ignore the rules — not even accidentally.

## Project

```
pi-topdown-kit/
├── extensions/
│   └── workflow-guard.ts      # Write blocker during brainstorm/verify
├── skills/
│   ├── ptk-brainstorming/SKILL.md   # Decisions doc, module outline
│   ├── ptk-scaffold/SKILL.md        # Skeleton + hazard check (absorbs writing-plans + design-review)
│   ├── ptk-execute/SKILL.md         # Fill stubs layer by layer
│   ├── ptk-verify/SKILL.md          # Security/optimization/traceability
│   ├── ptk-finalizing/SKILL.md      # Strip sentinels + helper, archive, ship
│   └── ptk-diagnose/SKILL.md        # 6-phase debug loop
├── tests/
│   └── workflow-guard.test.ts
├── package.json
└── README.md
```

## Development

```bash
npm test
```

## Publishing

```bash
npm publish
# then verify:
pi install npm:@tianhai/pi-topdown-kit
```

Before publishing a new version, verify coexistence with `pi-workflow-kit` by installing both in a scratch project and confirming no `/skill:` or guard conflicts.

## License

[MIT](LICENSE)