# Decisions: cwd root lock with implicit switching

## Problem
When using ptk across multiple projects, `read`/`grep` may resolve code in one workspace while `bash` executes in another repo (`pi-topdown-kit`), causing repo-scoped commands (`git status`, tests, builds) to run against the wrong project. Prompt-only reminders reduce risk but are not deterministic.

We need a runtime safeguard that hardens command execution without requiring a new operator command, and without changing file-tool scope (`read`/`edit`/`write`) in this phase. The safeguard should work across all ptk phases and behave safely in non-interactive/headless contexts.

Key constraints: (1) keep implementation inside existing `workflow-guard` extension, (2) avoid brittle model-compliance reliance, (3) allow intentional mid-session project switches only when explicitly signaled by command shape, and (4) block on ambiguity when user confirmation is unavailable.

## Approaches considered
- **Option A (prompt-only hardening):** Keep skill-level "reconcile cwd first" clauses only. Low implementation cost, but depends on LLM compliance and still allows drift.
- **Option B (guard-enforced root lock + auto-prefix):** In `tool_call` for `bash`, lock a repo root, auto-prefix repo-scoped commands with `cd <root> &&`, and handle switch conflicts implicitly via explicit-`cd` evidence. Higher implementation effort, but deterministic and phase-agnostic.
- **Option C (host/runtime launch discipline only):** Enforce launch-from-project and external wrappers/config. Strong when followed, but operationally fragile and not self-healing inside active sessions.

**Chosen:** **Option B**, with Option C as complementary operator hygiene. Runtime enforcement in the guard removes reliance on prompt adherence and directly prevents wrong-repo execution.

## Decisions
### Root locking is enforced in `workflow-guard` (not only skill text)
The extension will own bash root reconciliation at runtime, because `tool_call` can mutate command input before execution. This gives deterministic behavior even when model output omits reconciliation steps.

### Enforce for all phases
Repo-scoped bash reconciliation applies in both blocking and unlocked phases. Wrong-repo execution is a session-level safety issue, not phase-specific.

### Auto-fix mode for repo-scoped bash commands
For repo-scoped commands, guard rewrites to `cd <locked-root> && <original-command>` rather than requiring the model to prepend `cd`. This minimizes friction and preserves existing prompts.

### Hybrid root resolution with implicit-only switching
Initial lock starts from session cwd; when conflict evidence appears, root switching is allowed only if command explicitly signals intent (e.g., `cd /other/root && ...`). No new slash command is added.

### Headless conflict handling fails closed
If confirmation is required but UI prompt is unavailable, guard blocks command execution and returns actionable guidance. Safety takes precedence over silent misexecution.

### Scope is bash-only in this change
No root-bound restrictions are added to `read`/`edit`/`write` in this iteration. This keeps blast radius small while solving the highest-impact failure mode (repo-scoped bash running in wrong repo).

## Module outline
- `extensions/workflow-guard.ts` — extend bash `tool_call` pipeline with:
  - repo-scoped command detection
  - locked-root state management for session
  - command rewrite (`cd <root> && ...`) in auto-fix mode
  - implicit-switch detection (explicit `cd ... &&` intent)
  - conflict resolution path (confirm when UI exists, fail-closed otherwise)
- `tests/workflow-guard.test.ts` — add unit coverage for:
  - repo-scoped detection and rewrite behavior
  - root lock initialization and persistence across calls
  - implicit switch acceptance/rejection flows
  - no-UI fail-closed behavior
  - unchanged behavior for non-repo-scoped safe commands
- `docs/plans/` verification notes — acceptance checklist updates for manual mismatch scenarios and headless behavior validation.