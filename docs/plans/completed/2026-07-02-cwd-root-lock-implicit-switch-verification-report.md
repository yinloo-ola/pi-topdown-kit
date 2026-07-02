# Verification Report: cwd root lock with implicit switching

**Date:** 2026-07-02
**Scope:** Review of `e255891` + related skill/docs updates (`extensions/workflow-guard.ts`, `tests/workflow-guard.test.ts`, `skills/ptk-*.md`, decisions doc)

## Summary

| Pass | Critical | High | Medium | Low |
|------|----------|------|--------|-----|
| Security | 0 | 1 | 0 | 0 |
| Optimization | — | — | 1 (P2) | 0 |
| Traceability | 0 | 1 | 0 | 0 |
| **Total** | **0** | **2** | **1** | **0** |

## 🔴 Security Findings

### [S-001] High — Repo-root lock can be bypassed by common command prefixes
**Location:** `extensions/workflow-guard.ts:128-140`, `extensions/workflow-guard.ts:326-332`

**Issue:** `isRepoScopedCommand()` only matches commands that start directly with tool names (`git`, `go`, `npm`, etc.). Common forms like `GF_GCFG_PATH=... go test`, `env FOO=1 git status`, `/usr/bin/git status`, or `command git status` are not detected as repo-scoped, so they skip auto-prefixing and may execute in the wrong repo.

**Fix:** Parse the leading command token after optional env assignments/wrappers, normalize binary basenames, then apply repo-scoped detection. Add tests covering prefixed/wrapped forms.

## 🟡 Optimization Findings

### [O-001] P2 — Guard integration path is not directly tested
**Location:** `tests/workflow-guard.test.ts:8-13`, `extensions/workflow-guard.ts:460-513`

**Issue:** Tests exercise pure helpers, but not the `tool_call` integration flow where command mutation + phase allowlist + async confirm interact. This raises regression risk for ordering bugs in future edits.

**Fix:** Add a focused integration test harness for `tool_call` with mocked `ctx` (`hasUI` true/false), asserting final mutated command, block reasons, and switch-confirm behavior.

## 🔵 Traceability Findings

### [T-001] High — Skill CWD check conflicts with guard allowlist in blocking phases
**Entry point:** `skills/ptk-verify/SKILL.md:17` (also mirrored in other ptk skills)
**Call chain:** skill instruction → model emits bash command → `tool_call` allowlist in guard
**Broken at:** guard allowlist for read-only git subcommands

**Issue:** Skills instruct `pwd && git rev-parse --show-toplevel`, but `isSafeCommand` allowlist does not include `git rev-parse --show-toplevel` (`extensions/workflow-guard.ts:96-97`). In blocking phases this instruction is blocked, so the documented workflow cannot execute as written.

**Fix:** Either (a) allowlist `git rev-parse --show-toplevel` as read-only, or (b) adjust skill instructions to only use currently allowlisted commands.

## Remediation Task List

| ID | Priority | Finding | Effort |
|----|----------|---------|--------|
| S-001 | High | Repo-scoped detection misses prefixed/wrapped commands | medium |
| T-001 | High | Skill CWD check command is blocked by current allowlist | small |
| O-001 | P2 | Missing `tool_call` integration tests | medium |