---
name: ptk-finalizing
description: "Use this after the stub frontier is empty (all stubs filled) to clean up, document, and ship the work. Removes .ptk-scaffold sentinels and the stub() helper, archives plan docs, updates README/CHANGELOG, creates PR."
---

# Finalizing

Ship the completed work. By this point the stub frontier is empty — `ast_search 'stub($ARG)'` under every `.ptk-scaffold` sentinel dir returns nothing, and no `it.todo`/`t.Skip` markers remain.

## Pre-finalization checks

### Confirm the frontier is empty

Before archiving, verify the kit's invariant — every stub is filled:

```
ast_search 'stub($ARG)' $(find . -name '.ptk-scaffold' -exec dirname {} \;)   # should return nothing
grep -rn "it.todo\|t.Skip" .           # should return nothing meaningful (only legitimate skips, if any)
```

Also check for leftover `.ptk-scaffold` sentinels — each one means a module tree that finalize must close out.

If stubs remain, warn:

```
⚠️ N stubs still unfilled (frontier not empty). Continue with finalizing, or go back to /skill:ptk-execute?
```

Wait for the user to confirm before proceeding.

## Process

1. **Remove scaffold artifacts** — the `stub()` / `ptkStub()` marker helper and `.ptk-scaffold` sentinels exist only to drive the scaffold→execute loop. Once the frontier is empty they're dead weight and must not ship:

   ```
   # Remove every sentinel (each marks an active module frontier, now closed)
   find . -name '.ptk-scaffold' -delete

   # Remove the marker helper module(s) scaffold created, e.g.:
   rm -f src/_ptk/stub.ts      # TS
   rm -f internal/ptkstub/stub.go  # Go
   ```

Then remove every `import { stub } from ".../stub"` line that now has no target (the `ast_search 'stub($ARG)'` query above already confirmed no call sites remain, but imports may linger). Run the test suite + type-check / build to confirm nothing references the removed helper.

   Commit this cleanup separately so the diff is clearly "remove scaffold scaffolding":

   ```
   git add -A && git commit -m "chore: remove ptk scaffold artifacts (sentinels + stub helper)"
   ```

2. **Move planning docs** — before archiving, check `docs/plans/*-decisions.md`. If the module outline lists modules that were never scaffolded, warn:

   ```
   ⚠️ Decisions doc lists N unplanned modules. Archive anyway, or go back to scaffold them?
   ```

   Wait for the user to confirm before proceeding. Then archive the decisions doc and any verification reports:

   ```
   mkdir -p docs/plans/completed
   mkdir -p docs/plans/completed/adr
   mv docs/plans/*-decisions.md docs/plans/completed/ 2>/dev/null || true
   mv docs/plans/*-verification-report.md docs/plans/completed/ 2>/dev/null || true
   mv docs/plans/adr/*.md docs/plans/completed/adr/ 2>/dev/null || true
   rmdir docs/plans/adr 2>/dev/null || true
   git add docs/plans/ && git commit -m "chore: archive planning docs"
   ```

   Each `mv` gracefully handles the case where no matching files exist (e.g. if the user skipped verify and there's no report).

3. **Review & Polish Lessons (Agile Scrum Master Hat)** — if `docs/lessons.md` exists, put on your **Agile Scrum Master Hat** to curate and optimize it for future sprints:
   - **Add missed lessons** — capture any lessons from this session that weren't written during execution
   - **Generalize domain-specific rules** — if a rule names a specific service, entity, or feature, either rewrite it as a generic pattern or remove it if no generic form exists

   - **De-duplicate** — combine overlapping or redundant rules into single, sharper entries
   - **Categorize** — group the rules under clear, structured markdown headers (e.g. `## Tool Usage`, `## Testing Patterns`, `## Architecture Rules`) to make the document highly scannable for future sessions. Keep the `## Rules` section as the append target for new entries during execution — categorization moves rules out of `## Rules` into the appropriate category headers.
   - **Retire stale rules** — remove bullets that no longer apply
   - If no changes are needed, leave it as-is

   If `docs/lessons.md` doesn't exist but lessons were learned this session, create it with the standard format:

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

4. **Update documentation** — if the API or surface changed:
   - Update README.md
   - Update CHANGELOG.md
   - Update any inline docs

5. **Choose a merge strategy** — ask the human which option they prefer:

   1. **Create PR** — push and open a PR for external review:
      ```
      git push origin <branch>
      gh pr create --title "feat: <summary>" --body "<task summary>"
      ```

      Use the filled-stub summary to generate the body. Convert the decisions doc's module outline to a bulleted list of what was delivered:

      ```
      - ✅ auth/service (signup, login)
      - ✅ auth/handler (POST /signup, POST /login)
      - ✅ auth/repo (user persistence)
      ```

   2. **Rebase & merge** *(recommended)* — rebase onto parent, fast-forward merge, push parent, delete branch:
      ```
      parent=$(git show-branch -a 2>/dev/null | grep '\*' | grep -v "$(git branch --show-current)" | head -1 | sed 's/.*\[\(.*\)\].*/\1/' | sed 's/[\^~].*//')
      git checkout "$parent" && git pull
      git checkout - && git rebase "$parent"
      git checkout "$parent" && git merge --ff-only -
      git push origin "$parent"
      git branch -d - && git push origin --delete -
      ```

   3. **Squash & merge** — squash all commits into one on parent, push parent, delete branch:
      ```
      parent=$(git show-branch -a 2>/dev/null | grep '\*' | grep -v "$(git branch --show-current)" | head -1 | sed 's/.*\[\(.*\)\].*/\1/' | sed 's/[\^~].*//')
      git checkout "$parent" && git pull
      git merge --squash -
      git commit -m "feat: <summary>"
      git push origin "$parent"
      git branch -d - && git push origin --delete -
      ```

   4. **Merge commit** — merge with `--no-ff`, push parent, delete branch:
      ```
      parent=$(git show-branch -a 2>/dev/null | grep '\*' | grep -v "$(git branch --show-current)" | head -1 | sed 's/.*\[\(.*\)\].*/\1/' | sed 's/[\^~].*//')
      git checkout "$parent" && git pull
      git checkout - && git merge --no-ff -m "Merge branch '<branch>'" -
      git push origin "$parent"
      git branch -d - && git push origin --delete -
      ```

   For options 2–4, confirm the detected parent branch with the human before proceeding.

6. **Clean up** — if a worktree was used, remove it:
   ```
   git worktree remove ../<repo>-<feature-name>
   ```