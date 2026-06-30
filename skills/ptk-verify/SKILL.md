---
name: ptk-verify
description: "Post-implementation code verification with three expert review passes — security, optimization, and traceability. Use after ptk-execute and before ptk-finalize to catch issues that pass tests but break in production. Runs the 'last prompt' pattern: adversarial security review, dead code and duplication audit, and end-to-end contract verification across every layer. Use this skill whenever the user says 'verify', 'review the code', 'check for issues', 'security review', 'the last prompt', 'audit', or when code has been implemented and needs a quality gate before shipping."
---

# Verify

Three expert review passes over the implemented codebase. Read-only — you **may** write the verification report to `docs/plans/`, but you **may not** modify source code.

The core insight: code that passes tests is not code that's ready. Working code can have security holes, dead branches, duplicated logic, and broken contracts between layers — especially when AI fills stubs one at a time without maintaining a single mental model of the whole. This skill catches what tests miss.

> **ptk-verify vs ptk-scaffold's hazard check:** scaffold audits the *skeleton's shape* before any logic exists; this audits the *filled-in behavior* after execute. Both exist; they are not redundant.

## Process

1. **Check scope and feature** — `git log --oneline` and `git diff --stat`. If more than one `.ptk-scaffold` sentinel exists, list each sentinel's `# feature:` line and ask the user which to verify; scope all checks to that sentinel's directory.

   **Confirm the frontier is empty for that feature.** If a sentinel exists, find every stub call site under its directory (the sentinel's first non-comment line is the ERE pattern; use whatever search tool you have). If stubs remain: "Frontier is not empty — N stubs still unfilled. Run `/skill:ptk-execute` first." and stop. **If no sentinel exists** (e.g. after a `ptk-modify` session — its pins are characterization tests, not `stub()` call sites), skip the frontier check and scope the review to the recent `git diff` instead.

   > This skill runs in a *blocking* phase — the guard restricts `bash` to read-only commands and blocks shell loops. To list sentinels or scan patterns, prefer non-bash tools (`find`/`grep` builtins or an extension) over a `for f in $(find…)` loop.

2. **Map the project's layers** — start from the skeleton's module outline in `docs/plans/*-decisions.md`, but verify it against what was actually built. Note the patterns: handlers/routes → services → repositories → models. This map drives the traceability pass.

3. **Run three expert review passes** — each adopts a distinct adversarial framing, done sequentially. Read the relevant code deeply — don't skim — then write findings.

4. **Compile the report** — write all findings to `docs/plans/*-verification-report.md`, present it, wait for feedback.

5. **Offer remediation** — route each finding by its *nature*, not a blanket default. Present the routing so the user knows which skill applies each fix:

   - **Behavioral** (security holes, traceability seam mismatches, dead-code removal, over-engineering simplification — any fix to existing working code) → `/skill:ptk-modify`. This is ptk-modify's exact purpose, and the right answer to its own verify findings.
   - **Documentation / polish** (README/CHANGELOG drift, JSDoc, project-tree updates) → fold into `/skill:ptk-finalizing`.
   - **The skeleton itself is wrong** (wrong module boundaries, missing layer) → re-run `/skill:ptk-scaffold` for that piece.

   Do NOT default to `/skill:ptk-execute` — after execute finishes the `stub()` frontier is empty and there is nothing to "re-fill." A verify finding is a problem in already-filled working code, not an unfilled stub. Reserve execute for genuinely unfinished stubs.

## Pass 1 — Security Review 🔴

**Framing:** A junior developer wrote this. Now the best security expert on the team is reviewing it — adversarial, suspicious of everything. Trust nothing.

Look for: **input validation** (every external input — HTTP params, headers, query strings, env vars — validated/sanitized); **auth/authz** (every user-data endpoint checked; can one user reach another's data by changing an ID?); **injection** (SQL/shell/template/XSS — any raw variable interpolated into a query or command is critical); **secrets** (hardcoded keys/tokens; env defaults that aren't empty); **data exposure** (passwords/PII logged, in responses, or unencrypted); **dependency risks** (known-vulnerable packages).

| Severity | Definition |
|----------|-----------|
| Critical | Exploitable now — auth bypass, injection, data leak |
| High | Likely exploitable — missing validation on sensitive endpoint, weak auth |
| Medium | Harder to exploit but real — verbose errors leaking internals, missing rate limits |
| Low | Best-practice violations — missing CSP/HSTS, long session timeouts |

## Pass 2 — Optimization Review 🟡

**Framing:** A code-quality expert hunting waste — things that make the codebase harder to maintain, slower to run, or more confusing than necessary.

Look for: **dead code** (functions/types/exports never called anywhere — verify they have callers); **duplication** (same logic solved slightly differently across files — AI fills are especially prone when context was lost between fills; flag each pair with paths + lines); **over-engineering** (abstractions/interfaces/layers that don't earn their keep — only one impl, no real variation); **under-engineering** (god functions, 200-line blocks, deep nesting that should have been sub-stubs); **performance** (N+1 queries, unbounded loops, large unnecessary copies, missing pagination on list endpoints).

| Priority | Definition |
|----------|-----------|
| P0 | Dead code on a critical path, or duplicated logic that will diverge |
| P1 | Significant duplication or over-engineering raising maintenance cost |
| P2 | Minor cleanups — long functions, missing pagination, style drift |

## Pass 3 — Traceability Review 🔵

**Framing:** An integration expert tracing every user-facing action end-to-end — UI to database and back. Stubs filled one at a time leave bugs at the seams.

**This is the pass that catches the most bugs.** AI fills often produce a handler calling `getUserProfile(userId)` and a repository exposing `get_user_profile(user_id)` — both work in isolation, neither works together.

1. **Map every entry point** — handlers, routes, controllers, event listeners receiving external input.
2. **Trace each call chain** through the filled stubs (handler → service → repository → DB). At each boundary verify: **function name** (caller uses the exact name callee exposes); **argument names** (`userId` vs `user_id` — does `id` mean the same thing in both layers?); **argument types** (string where int expected? object shape mismatch?); **return shape** (does the caller expect fields the callee actually returns? consistent DTOs?).
3. **Check error propagation** — when a query returns no results, does the service handle it? Does the handler return 404 or 500? Errors propagated cleanly or swallowed silently?
4. **Verify the round-trip** — if the UI calls `getUser(id)` and displays `user.name`, trace that `name` exists in the schema, gets selected, mapped, passed through, included in the response, and rendered.

| Severity | Definition |
|----------|-----------|
| Critical | Call chain completely broken — function doesn't exist or signature fundamentally wrong |
| High | Signature mismatch — wrong arg names/types, missing required fields |
| Medium | Silent error handling — errors swallowed without logging or feedback |
| Low | Inconsistent naming that could confuse future developers |

## Report Format

Write findings to `docs/plans/*-verification-report.md`. Each finding: a short title, location (`path/to/file.ts:line`), the issue, and a concrete fix. Group by pass under `## 🔴 Security`, `## 🟡 Optimization`, `## 🔵 Traceability` headers, prefixed with an ID + severity/priority (e.g. `### [S-001] Critical — …`). Start with a summary table:

```markdown
# Verification Report: <feature/topic>

**Date:** <ISO date>
**Scope:** <what was reviewed>

## Summary

| Pass | Critical | High | Medium | Low |
|------|----------|------|--------|-----|
| Security | X | X | X | X |
| Optimization | — | X | X | X |
| Traceability | X | X | X | X |
| **Total** | **X** | **X** | **X** | **X** |

## 🔴 Security Findings
### [S-001] Critical — <short title>
**Location:** `path/to/file.ts:line`
**Issue:** <what's wrong and why it matters>
**Fix:** <concrete remediation step>

## 🟡 Optimization Findings
### [O-001] P0 — <short title>
…

## 🔵 Traceability Findings
### [T-001] Critical — <short title>
**Entry point:** `path/to/handler.ts:line`
**Call chain:** handler → service → repository → DB
**Broken at:** <which boundary>
**Issue:** <e.g. handler passes `userId` but service expects `user_id`>
**Fix:** <concrete remediation step>

## Remediation Task List

| ID | Priority | Finding | Effort |
|----|----------|---------|--------|
| S-001 | Critical | <one-liner> | small/medium/large |
| T-001 | Critical | <one-liner> | … |
| O-001 | P0 | <one-liner> | … |
```

## Principles

- **Be specific** — every finding needs a file path and line reference. "There might be security issues" is useless.
- **Be adversarial** — actively look for problems. If you find none, say so — but don't phone it in.
- **Be proportional** — a small config change doesn't need the same depth as a new API endpoint. Adjust review depth to scope.
- **Don't fix anything** — read-only. Find and report. The user decides what to fix and when.
- **Focus on seams** — the traceability pass is where the most value lives. Code within a single stub is usually coherent; bugs hide between filled stubs.