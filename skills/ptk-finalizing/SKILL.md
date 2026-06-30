---
name: ptk-finalizing
description: "Use this after the stub frontier is empty (all stubs filled) to clean up, document, and ship the work. Removes .ptk-scaffold sentinels and the stub() helper, archives plan docs, updates README/CHANGELOG, creates PR."
---

# Finalizing

Ship the completed work. The stub frontier is empty — for every `.ptk-scaffold` sentinel, grepping its recorded pattern (first non-comment line) under its directory returns nothing.

## Pre-finalization checks

### Pick the feature (if multiple in flight)

If more than one `.ptk-scaffold` sentinel exists, **pick one to finalize** — list each sentinel's `# feature:` line and ask the user which to ship. Finalizing one feature removes only that feature's sentinels and stub helper (if it owns them) and archives only that feature's `*-decisions.md` / `*-verification-report.md`. Do not finalize two features in one run.

### Verify the frontier is empty

Confirm every stub is filled under the chosen sentinel's directory:

```bash
# $SENTINEL = the .ptk-scaffold the user picked;  $SENTINEL_DIR = its directory
pat=$(grep -vE '^\s*(#|$)' "$SENTINEL" | head -1)   # first non-comment line is the ERE
grep -rnE "$pat" "$SENTINEL_DIR"                     # should print nothing — all stubs filled
```

Use whatever search tool you have (builtin `grep`, an extension). When it returns nothing, the frontier is empty. If stubs remain:

```
⚠️ N stubs still unfilled (frontier not empty). Continue with finalizing, or go back to /skill:ptk-execute?
```

Wait for the user to confirm before proceeding.

## Swap step (only when replacing a live subsystem)

This step applies only to **replacing a whole live subsystem** — detect it in the decisions doc: its Chosen approach names a replacement/swap strategy, and the old subsystem still exists on disk. Skip entirely for normal features.

The replacement X' is built, filled, and verified by the standard flow (scaffold → execute → verify). What remains is the cutover: repoint every caller from old X to new X', prove the swap is safe, then delete old X.

> **Why this lives here, not in `ptk-modify`.** The cutover spans many callers (not modify's 1–3 functions), so characterize→change→repin doesn't fit. Its safety net is the full test suite instead: X' was verified in ptk-verify, and the suite going green after repointing proves X' satisfies every caller's contract.
>
> **Limitation: big-bang cutover.** This step repoints all callers in one commit. That's fine for a small subsystem or one with a stable interface (callers barely change). For a **large subsystem with many callers and a changing contract**, one-shot repointing is the riskiest move in the whole job. In that case don't use this step — do an **incremental cutover manually**: repoint one caller or caller-group at a time via `ptk-modify` (characterize its current X usage → repoint to X' → suite green → commit), repeating until none reference X, then delete X. It's slower but each step is reversible and independently verified.

1. **Repoint callers** — find every call site of old X's entry points (grep its exported names), change each to call new X'. Don't touch old X itself yet.
2. **Verify green** — full build + test suite. Every green test that exercised X through its callers now proves X' is behaviorally equivalent. **If the suite is thin around X's callers, stop** — characterize those callers first via `ptk-modify` before the swap; an uncharacterized cutover is a blind swap.
3. **Delete old X** — it now has no callers. Remove its files.

Commit the cutover as one move, then continue with the Process steps below:

```
git add -A && git commit -m "refactor: swap <X'> for <X> (cutover + remove old)"
```

## Process

### 1. Remove scaffold artifacts

The `stub()` / `ptkStub()` helper and `.ptk-scaffold` sentinels exist only to drive the scaffold→execute loop. Once the frontier is empty they must not ship:

```bash
# Remove the CHOSEN feature's sentinels (do NOT delete other features')
rm -f "$SENTINEL"
find "$SENTINEL_DIR" -name '.ptk-scaffold' -delete

# Remove the marker helper ONLY if no other feature still references it.
# TS: rm -f src/_ptk/stub.ts   Go: rm -f internal/ptkstub/stub.go
```

Then remove every now-dangling `import { stub } from ".../stub"` line under `$SENTINEL_DIR`. Run the test suite + type-check/build to confirm nothing references the removed helper.

Commit the cleanup separately so the diff reads clearly as "remove scaffold scaffolding":

```
git add -A && git commit -m "chore: remove ptk scaffold artifacts (sentinels + stub helper)"
```

### 2. Archive planning docs

Before archiving, check `docs/plans/*-decisions.md`. If the module outline lists modules that were never scaffolded, warn and wait for confirmation:

```
⚠️ Decisions doc lists N unplanned modules. Archive anyway, or go back to scaffold them?
```

Then archive (each `mv` is graceful — handles the case where no matching file exists, e.g. user skipped verify):

```bash
mkdir -p docs/plans/completed/adr
mv docs/plans/*-decisions.md docs/plans/completed/ 2>/dev/null || true
mv docs/plans/*-verification-report.md docs/plans/completed/ 2>/dev/null || true
mv docs/plans/adr/*.md docs/plans/completed/adr/ 2>/dev/null || true
rmdir docs/plans/adr 2>/dev/null || true
git add docs/plans/ && git commit -m "chore: archive planning docs"
```

### 3. Polish lessons

If `docs/lessons.md` exists, curate it for future sessions:

- **Add** lessons from this session that weren't captured during execution.
- **Generalize** domain-specific rules — if a rule names a specific service/entity/feature, rewrite it as a generic pattern or remove it.
- **De-duplicate** overlapping rules into sharper entries.
- **Categorize** rules under clear headers (`## Tool Usage`, `## Testing Patterns`, `## Architecture Rules`) for scannability. Keep a `## Rules` section as the append target for new entries during execution.
- **Retire** stale rules that no longer apply.

If `docs/lessons.md` doesn't exist but lessons were learned, create it:

```markdown
# Lessons Learned

<!--
Agent: read this at the start of each task during ptk-execute.
Follow every rule. Add new rules when you catch yourself making repeat mistakes.
Rules must be generic patterns applicable to any domain or feature — not specific to one service, entity, or use case.
Retire rules that no longer apply during finalizing.
-->

## Rules

- <rule 1>
- <rule 2>
```

If no changes are needed, leave it as-is.

### 4. Update documentation

If the API or surface changed: update README.md, CHANGELOG.md, and any inline docs.

### 5. Choose a merge strategy

Ask the user. For options 2–4, first confirm the parent branch (ask the user; default `main`).

**1. Create PR** — push and open a PR for external review:

```
git push origin <branch>
gh pr create --title "feat: <summary>" --body "<task summary>"
```

Use the filled-stub summary as the body. Convert the decisions doc's module outline to a bulleted delivery list:

```
- ✅ auth/service (signup, login)
- ✅ auth/handler (POST /signup, POST /login)
- ✅ auth/repo (user persistence)
```

**2. Rebase & merge** *(recommended)* — rebase onto parent, fast-forward merge, push parent, delete branch:

```
git checkout "$PARENT" && git pull
git checkout - && git rebase "$PARENT"
git checkout "$PARENT" && git merge --ff-only -
git push origin "$PARENT"
git branch -d - && git push origin --delete -
```

**3. Squash & merge** — squash all commits into one on parent, push, delete branch:

```
git checkout "$PARENT" && git pull
git merge --squash -
git commit -m "feat: <summary>"
git push origin "$PARENT"
git branch -d - && git push origin --delete -
```

**4. Merge commit** — merge with `--no-ff`, push parent, delete branch:

```
git checkout "$PARENT" && git pull
git checkout - && git merge --no-ff -m "Merge branch '<branch>'" -
git push origin "$PARENT"
git branch -d - && git push origin --delete -
```

### 6. Clean up

If a worktree was used, remove it:

```
git worktree remove ../<repo>-<feature-name>
```