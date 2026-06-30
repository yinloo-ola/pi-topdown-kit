# pi-topdown-kit

> Scaffold-first, top-down layered workflow for AI coding agents. **The skeleton IS the plan.**

AI coding agents jump to code too fast. The shape of the system emerges by accident — over-engineered, misaligned, reviewed too late (if at all). **pi-topdown-kit** fixes that by forcing a **scaffold-first** workflow: before writing any behavior, the agent produces a reviewable skeleton of the whole system — real, compilable code, with `stub()` markers everywhere. You review the entire shape as a diff. Only then does it fill stubs, layer by layer.

**Best for:** new subsystems where you want the architecture right *before* logic lands. ([Not sure? Compare it to the sibling `pwk-` kit.](#vs-pi-workflow-kit-pwk-))

> This is the classical discipline of **stepwise refinement** (Wirth, 1971) and **"programming by wishful thinking"** (SICP), driven by a cognitive-load argument: experts read code top-down by *chunking* familiar lines into high-level concepts. Top-down production matches that mental model — the agent writes code shaped the way you read it.

---

## Why?

- **AI agents skip design.** Left unchecked, they jump to code and the shape emerges accidentally. This forces a think-shape-first workflow.
- **The skeleton is reviewable.** You read the whole system's shape — names, layers, boundaries — before any logic distracts you. Mistakes are one-line stub edits, cheap.
- **Progress can't drift.** The `stub()` frontier is grep. No status file to forget to update, no rows to go stale. The codebase's own grep-ability tracks where you are.
- **You stay in control.** Checkpoint gates at the skeleton review and at hazard stubs mean you approve the shape and the risky bits before they're committed.
- **Enforced, not suggested.** Hard blocks mean the agent can't accidentally ignore the rules.

---

## Install

Requires [pi](https://github.com/badlogic/pi-mono), an AI coding agent harness.

```bash
pi install npm:@tianhai/pi-topdown-kit
```

No setup needed — skills and guard activate automatically. **Try before committing:**

```bash
pi -e npm:@tianhai/pi-topdown-kit
```

---

## What You Get

### 🛡️ Workflow Guard (extension)

Enforces phase-appropriate tool access — hard blocks, not guidelines:

| Phase | `write` / `edit` | `bash` |
|-------|:-:|:-:|
| **Brainstorm** / **Verify** | 🔒 Blocked outside `docs/plans/` | 🔒 Read-only only (grep, find, cat, git status, curl…) |
| **Scaffold** / **Execute** / **Finalize** | ✅ Full access | ✅ Full access |

The agent can discuss design during brainstorm, but physically cannot modify source files until scaffold.

### 🧠 7 Workflow Skills

```
brainstorm ─┬→ scaffold → execute → [verify?] → finalize
 (why/what) │   (shape)    (behavior)  (review)    (ship)
            ├→ modify (change existing behavior: characterize → change → repin)
            └→ diagnose (anytime)
```

Brainstorm is the **triage point**: it routes new shape to `scaffold`, behavior changes to `modify`, broken code to `diagnose`, and whole-subsystem replacements to `scaffold` (the old subsystem is removed during finalize's swap step).

| Phase | Trigger | What Happens |
|-------|---------|--------------|
| **Brainstorm** | `/skill:ptk-brainstorming` | Ask questions, explore approaches, record decisions, sketch the module outline. Output: `*-decisions.md` (problem, approaches, decisions, module outline). |
| **Scaffold** | `/skill:ptk-scaffold` | Read decisions doc → emit the layered skeleton: full types, `stub()` stubs, `it.todo` tests, `.ptk-scaffold` sentinels. Runs a production-hazard check. **Pauses at `CHECKPOINT: skeleton`** for you to review the whole shape. |
| **Execute** | `/skill:ptk-execute` | Grep the frontier → fill one stub + its unit test per increment (red→green). Recursively re-stubs when a fill is too complex. Tree stays green at every commit. |
| **Verify** | `/skill:ptk-verify` | Three expert review passes (security, optimization, traceability) on the filled code. |
| **Finalize** | `/skill:ptk-finalizing` | Remove `.ptk-scaffold` sentinels + `stub()` helper, archive decisions doc, update README/CHANGELOG, create PR. Includes a swap step for replacing a whole live subsystem. |
| **Modify** | `/skill:ptk-modify` | Change behavior of existing working code: pin current behavior with characterization tests (green), make the change (intentional red), repin to the new contract (green). **Localized changes (1–3 functions) only.** |
| **Diagnose** | `/skill:ptk-diagnose` | 6-phase debugging discipline: build feedback loop → reproduce → hypothesise → instrument → fix → cleanup. Utility skill, any time. |

There is **no `writing-plans` skill**. The skeleton *is* the plan — real, compilable code, not markdown prose.

---

## Quick Start

```bash
# Install the kit
pi install npm:@tianhai/pi-topdown-kit

# Start a new feature
# (in pi TUI):
> /skill:ptk-brainstorming
> I want to add a job-scheduling subsystem to our worker pool

# Agent asks questions, explores approaches,
# writes *-decisions.md — no source writes yet.
# You approve the shape.

> /skill:ptk-scaffold

# Agent emits the layered skeleton:
#   scheduler/dispatcher.ts, scheduler/queue.ts, scheduler/repo.ts
# All stub() bodies, it.todo tests, .ptk-scaffold sentinels.
# Pauses at CHECKPOINT: skeleton — you review the whole shape as a diff.

# ...you approve the skeleton...

> /skill:ptk-execute

# Agent greps stub() call sites via sentinel patterns.
# Fills dispatcher first, recursively re-stubbing anything too complex.
# Tree green at every commit.

> /skill:ptk-verify
> /skill:ptk-finalizing
```

---

## How It Works

Three ideas do the work:

1. **Shape before behavior.** Scaffold emits the whole skeleton as `stub()` placeholders — it compiles, tests are `it.todo` (skipped, not failing), but nothing runs. You review the *map* before any *territory* is written.
2. **Drift-free progress.** What's left to fill (the "frontier") is found by grepping `stub()` call sites — no progress file to forget to update. The codebase's own searchability tracks where you are.
3. **Green at every commit.** Filled stubs have passing tests; unfilled stubs skip. The tree compiles throughout, so you can stop, `/new`, and resume any time.

For the full internals — the marker protocol, sentinel mechanics, recursive re-stubbing, hazard gates, and key invariants — see **[docs/WORKFLOW.md](docs/WORKFLOW.md)**.

---

## vs `pi-workflow-kit` (`pwk-`)

This kit is the **philosophical inverse** of [`@tianhai/pi-workflow-kit`](https://www.npmjs.com/package/@tianhai/pi-workflow-kit), maintained alongside it. Both are valid — pick per task.

| | `pi-workflow-kit` (`pwk-`) | `pi-topdown-kit` (`ptk-`) |
|---|---|---|
| **The plan is…** | markdown prose (`*-implementation.md`) | real code (the skeleton) |
| **Task shape** | vertical slices (signup = model+endpoint+UI) | layered fill (all handlers, then all services…) |
| **Progress tracking** | a `*-progress.md` status table | grep the `stub()` frontier |
| **Readability bias** | per-increment runnability (each task ships a working slice) | top-down shape review (review the whole skeleton first) |
| **Trade-off** | loses whole-system shape review | loses per-step end-to-end runnability |
| **Best for** | features where correctness per slice matters most | subsystems where architecture/shape matters most |

**They coexist.** Install both — no skill-prefix or extension conflicts (each guard tracks its own phase variable). Use `pwk-` for a CRUD endpoint you want working end-to-end today; use `ptk-` for a new subsystem whose shape you want to get right before any logic lands.

---

## Project

```
pi-topdown-kit/
├── extensions/
│   └── workflow-guard.ts      # Write blocker during brainstorm/verify
├── skills/
│   ├── ptk-brainstorming/SKILL.md   # Decisions doc, module outline
│   ├── ptk-scaffold/SKILL.md        # Skeleton + hazard check
│   ├── ptk-execute/SKILL.md         # Fill stubs layer by layer
│   ├── ptk-verify/SKILL.md          # Security/optimization/traceability
│   ├── ptk-finalizing/SKILL.md      # Strip sentinels + helper, archive, ship
│   ├── ptk-modify/SKILL.md          # Change existing behavior (characterize→change→repin)
│   └── ptk-diagnose/SKILL.md        # 6-phase debug loop
├── tests/
│   └── workflow-guard.test.ts
├── docs/
│   ├── WORKFLOW.md                  # Internals reference (marker protocol, frontier, gates)
│   ├── lessons.md                   # Generic rules for future sessions
│   └── plans/
│       ├── PUBLISH.md               # Publishing runbook
│       └── completed/               # Archived decision docs
├── package.json
└── README.md
```

---

## Development

```bash
npm test
npx biome check .
```

## Publishing

See [docs/plans/PUBLISH.md](docs/plans/PUBLISH.md) for the full runbook. (Docs must be updated *before* `npm version` — see the runbook.)

```bash
npm version patch   # bump
npm run check       # final gate
npm publish         # ship
```

## License

[MIT](LICENSE)