# Publishing pi-topdown-kit

First publish and every subsequent release. `npm publish` is destructive and needs the maintainer's npm creds — this doc is the runbook, not something the agent runs autonomously.

## Prerequisites (one-time)

- [ ] npm account `tianhai` (or whichever owns the `@tianhai` scope) is logged in: `npm whoami`
- [ ] GitHub repo `yinloo-ola/pi-topdown-kit` exists and is set as `repository.url` in `package.json` (already done)
- [ ] Local repo is on `main`, clean, pushed

## Pre-publish coexistence check

This kit ships a `workflow-guard.ts` extension and `/skill:ptk-*` commands. `pi-workflow-kit` ships its own `workflow-guard.ts` and `/skill:pwk-*` commands. **Verify they don't collide** before every publish:

1. In a scratch project, install both:
   ```bash
   mkdir /tmp/ptk-coexist && cd /tmp/ptk-coexist && pi
   pi install npm:@tianhai/pi-workflow-kit
   pi install npm:@tianhai/pi-topdown-kit
   ```
2. Confirm `/skill:ptk-brainstorming` and `/skill:pwk-brainstorming` both appear and invoke distinct skills.
3. Confirm invoking `/skill:pwk-brainstorming` (blocking) then `/skill:ptk-scaffold` (unlocking) actually unlocks — i.e. the two guards' phase variables don't stomp. Each guard is a separate module instance tracking its own `phase`, so this *should* be clean, but verify behaviorally.
4. Confirm a source write during `/skill:pwk-brainstorming` is blocked (pwk guard active) and that `/skill:ptk-scaffold` alone doesn't unlock pwk's block (and vice versa).
5. If any conflict: do NOT publish. The guards may need namespacing.

## Version + publish

```bash
# Bump version (patch/minor/major as appropriate)
npm version patch   # 0.1.0 -> 0.1.1

# Final local gate
npm run check       # biome + vitest, must be green

# Publish
npm publish

# Tag + push
git push --follow-tags
```

## Post-publish verification

```bash
# Fresh install from the registry
pi install npm:@tianhai/pi-topdown-kit

# Confirm skills load
pi   # then: /skill:ptk-brainstorming  (should activate)
```

## Coexistence design note (for future maintainers)

Both kits ship a file named `extensions/workflow-guard.ts`. This works because:

- pi loads each package's extension as a **separate module instance**.
- Each guard's `phase` is a module-level variable — they don't share state.
- The `/skill:` command namespaces are disjoint (`ptk-` vs `pwk-`).

If pi ever changes extension loading to share module state across packages, this assumption breaks and the guards will need explicit namespacing (e.g. distinct event-channel keys).