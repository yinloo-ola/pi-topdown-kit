---
name: ptk-brainstorming
description: "Use this before any creative work — creating features, building components, adding functionality, or modifying behavior. Explores intent and records decisions before the skeleton is scaffolded. Use this skill whenever the user describes something they want to build, change, or improve, even if they don't say 'brainstorm' — phrases like 'I want to add X', 'let's build Y', 'we need a way to Z', or 'help me design' all apply."
---

# Brainstorming

Read-only exploration. You may **not** edit or create any files except under `docs/plans/`.

This skill owns the **why / what**. It does not design the skeleton — that is `ptk-scaffold`'s job. The output is a lightweight decisions doc that scaffold reads to produce the actual code skeleton.

## Process

1. **Check git state** — run `git status` and `git log --oneline -5`. If there's uncommitted work, ask the user what to do with it first.
2. **Understand the idea** — read existing code, docs, and recent commits. Grep for related functionality, check package.json/dependencies and module structure. **Check `docs/lessons.md`** if it exists — known constraints and patterns may affect the design. Read only what's necessary to ground the design — don't read the entire codebase. Ask questions to refine the idea. Prefer multiple choice when possible. After each question, check: can you clearly articulate (a) what the user wants to build, (b) why, and (c) key constraints? If yes, present your understanding as a short summary and ask: "Should I proceed with this, or is there more to add?" The human decides when to move on.
3. **Explore approaches** — propose 2-3 approaches. For each, describe the shape at a high level (which modules, which layers, how they interact) — *not* concrete code. Concrete signatures, types, and stubs are `ptk-scaffold`'s job; deciding them here would duplicate that work and lock in detail before the human has approved the shape. Lead with your recommendation.
4. **Record decisions** — as the discussion converges, capture each significant decision in the decisions log (ADR-style). Only write an ADR when all three are true:

   1. **Hard to reverse** — changing your mind later has meaningful cost
   2. **Surprising without context** — a future reader will wonder "why?"
   3. **A real trade-off** — there were genuine alternatives

   ADR format — a title and 1-3 sentences covering context, decision, and why:

   ```markdown
   # <Short title of the decision>

   <1-3 sentences: context, decision, and why.>
   ```

   ADRs live under `docs/plans/adr/` and are archived during finalizing alongside the decisions doc.

5. **Write the decisions doc** — save it to `docs/plans/YYYY-MM-DD-<topic>-decisions.md`. Structure:

   ```markdown
   # Decisions: <topic>

   ## Problem
   <what, why, constraints — 1-3 paragraphs>

   ## Approaches considered
   - **Option A**: <one-line shape + one-line pro/con>
   - **Option B**: ...
   **Chosen:** <which, and why> — <1-2 sentences>

   ## Decisions
   <ADR-style entries for hard-to-reverse calls, or "none" if trivial>

   ## Module outline
   <A rough list of the modules/layers ptk-scaffold will create.
    Names + a one-line purpose each. NOT signatures, NOT stub bodies —
    just the shape sketch scaffold will expand into a real skeleton.>

   - `auth/service` — business logic: signup, login, token issue
   - `auth/handler` — HTTP handlers wrapping the service
   - `auth/repo` — user persistence
   ```

   The module outline is the handoff to scaffold. It should be specific enough that scaffold knows what modules to create, but not so detailed that it prescribes signatures (scaffold decides those, with human review at the skeleton checkpoint).

   Branch creation, committing, and workspace setup are handled by `ptk-scaffold`.

## Principles

- One question at a time
- YAGNI — remove unnecessary features
- **Stop at the shape.** Don't design signatures, types, or stub bodies — that's scaffold's job, and deciding them here means re-deciding them there.
- Always explore alternatives before settling

## After the decisions

The decisions doc is now written to `docs/plans/*-decisions.md` but **uncommitted** — this skill is read-only (the guard blocks `git commit` in brainstorm phase). The skill you pick next commits it as its first step, persisting the handoff before any source changes. If you plan to `/new` before continuing, that's safe as long as you don't `git stash` / `git checkout` / `git clean` in between — the file is on disk and the next skill will pick it up and commit it.

## Next step — triage by the nature of the change

You've established *what* the change is. Pick the next skill by *what kind* of change it is:

| The change… | Next skill |
|---|---|
| Creates new modules/files, or adds new code into existing ones (new shape) | `/skill:ptk-scaffold` |
| Changes the behavior of existing working code (localized — one or a few functions) | `/skill:ptk-modify` |
| Something is broken and needs debugging | `/skill:ptk-diagnose` |

If you're unsure between scaffold and modify: does the change create a new "place" (new code to write), or change what an existing "place" does? New code → scaffold; changing existing behavior → modify.

Ask: "Which next? `/skill:ptk-scaffold` (new shape), `/skill:ptk-modify` (change behavior), or `/skill:ptk-diagnose` (it's broken)?"