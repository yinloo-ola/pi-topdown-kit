# Lessons Learned

<!--
Agent: read this at the start of each task during ptk-execute.
Follow every rule. Add new rules when you catch yourself making repeat mistakes.
Rules must be generic patterns applicable to any domain or feature — not specific to one service, entity, or use case.
Retire rules that no longer apply during finalizing.
-->

## Workflow-Kit Maintenance

- **Adding or changing a skill in a multi-skill workflow kit touches every surface that enumerates skills.** Update all of: the README skills table, the flow/sequence diagram, the project file tree, the CHANGELOG, and any code comments/JSDoc that list the skills by name. Missing one is the predictable verify finding. Sweep all of them in one pass rather than discovering them as drift later.
- **When a new skill joins a workflow, audit sibling skills for handoff assumptions it breaks.** A skill that hands off to another (e.g. `ptk-modify` → `ptk-verify`) inherits the sibling's preconditions. If the new skill does not satisfy them (here: `ptk-verify` assumed a `.ptk-scaffold` sentinel, but `ptk-modify` creates none), the seam silently misbehaves. Trace each handoff end-to-end and relax the sibling's assumption explicitly.
- **Cross-session resume keys on durable artifacts, not commit-message prefixes.** A "last commit message starts with `X:`" check is fragile: it fails after any subsequent commit type and scrolls off short logs. Key resume/coherence logic on artifacts that persist on disk (sentinel files, marker call sites, test files) — the thing that actually signals state — not on the most-recent commit message.