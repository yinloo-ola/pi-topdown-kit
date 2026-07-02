import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Tests for workflow-guard.ts
 *
 * The extension tracks a phase variable and blocks write/edit outside docs/plans/.
 * We test the exported helpers directly:
 * - isSafeCommand / shouldBlockFilePath (phase-agnostic command/path policy)
 * - phaseForInput (the phase-determination logic, extracted from the event handler)
 *
 * The pi event system itself isn't unit-tested here — phaseForInput is the pure
 * core that the event handler delegates to.
 */

import {
  isRepoScopedCommand,
  isSafeCommand,
  phaseForInput,
  planRepoScopedBashCommand,
  shouldBlockFilePath,
} from "../extensions/workflow-guard";

describe("isSafeCommand", () => {
  it("allows safe read-only commands", () => {
    expect(isSafeCommand("cat file.ts")).toBe(true);
    expect(isSafeCommand("grep -r 'foo' src/")).toBe(true);
    expect(isSafeCommand("git status")).toBe(true);
    expect(isSafeCommand("git log --oneline -5")).toBe(true);
    expect(isSafeCommand("npm list")).toBe(true);
    expect(isSafeCommand("ls -la")).toBe(true);
    expect(isSafeCommand("curl https://example.com")).toBe(true);
  });

  it("blocks destructive commands", () => {
    expect(isSafeCommand("rm -rf node_modules")).toBe(false);
    expect(isSafeCommand("touch newfile.ts")).toBe(false);
    expect(isSafeCommand("mv old.ts new.ts")).toBe(false);
    expect(isSafeCommand("mkdir src/components")).toBe(false);
  });

  it("blocks file-writing bash patterns", () => {
    expect(isSafeCommand("echo 'hello' > file.ts")).toBe(false);
    expect(isSafeCommand("cat config > backup.txt")).toBe(false);
    expect(isSafeCommand("echo 'log' >> output.log")).toBe(false);
    expect(isSafeCommand("tee output.txt")).toBe(false);
    expect(isSafeCommand("sed -i 's/old/new/g' file.ts")).toBe(false);
  });

  it("blocks git mutations but allows read-only git", () => {
    expect(isSafeCommand("git add .")).toBe(false);
    expect(isSafeCommand("git commit -m 'msg'")).toBe(false);
    expect(isSafeCommand("git push")).toBe(false);
    expect(isSafeCommand("git checkout -b feature")).toBe(false);
    expect(isSafeCommand("git status")).toBe(true);
    expect(isSafeCommand("git log --oneline")).toBe(true);
    expect(isSafeCommand("git diff")).toBe(true);
    expect(isSafeCommand("git config --get user.name")).toBe(true);
    expect(isSafeCommand("git config user.email x@y.com")).toBe(false);
    expect(isSafeCommand("git config --global init.defaultBranch main")).toBe(false);
  });

  it("blocks editors", () => {
    expect(isSafeCommand("vim file.ts")).toBe(false);
    expect(isSafeCommand("nano file.ts")).toBe(false);
    expect(isSafeCommand("code .")).toBe(false);
  });

  it("blocks sudo", () => {
    expect(isSafeCommand("sudo apt install foo")).toBe(false);
  });

  it("blocks npm installs but allows read-only npm", () => {
    expect(isSafeCommand("npm install lodash")).toBe(false);
    expect(isSafeCommand("npm list")).toBe(true);
    expect(isSafeCommand("npm audit")).toBe(true);
  });

  it("allows cd", () => {
    expect(isSafeCommand("cd /some/path")).toBe(true);
    expect(isSafeCommand("cd src && ls")).toBe(true);
  });

  it("allows gh read-only subcommands", () => {
    expect(isSafeCommand("gh pr view 1564 --json title,body")).toBe(true);
    expect(isSafeCommand("gh pr list --repo owner/repo")).toBe(true);
    expect(isSafeCommand("gh pr diff 1564")).toBe(true);
    expect(isSafeCommand("gh issue view 42")).toBe(true);
    expect(isSafeCommand("gh issue list --label bug")).toBe(true);
    expect(isSafeCommand("gh repo view owner/repo")).toBe(true);
    expect(isSafeCommand("gh run view 12345")).toBe(true);
  });

  it("blocks gh write subcommands", () => {
    expect(isSafeCommand("gh pr create --title 'fix'")).toBe(false);
    expect(isSafeCommand("gh pr merge 1564")).toBe(false);
    expect(isSafeCommand("gh issue close 42")).toBe(false);
    expect(isSafeCommand("gh release create v1.0")).toBe(false);
  });

  it("allows git read-only subcommands (new additions)", () => {
    expect(isSafeCommand("git blame src/index.ts")).toBe(true);
    expect(isSafeCommand("git shortlog -sn")).toBe(true);
    expect(isSafeCommand("git stash list")).toBe(true);
    expect(isSafeCommand("git tag -l")).toBe(true);
    expect(isSafeCommand("git tag --list 'v*'")).toBe(true);
    expect(isSafeCommand("git describe --tags")).toBe(true);
    expect(isSafeCommand("git branch")).toBe(true);
    expect(isSafeCommand("git branch -a")).toBe(true);
    expect(isSafeCommand("git branch --show-current")).toBe(true);
  });

  it("blocks git branch delete", () => {
    expect(isSafeCommand("git branch -d old-feature")).toBe(false);
    expect(isSafeCommand("git branch -D old-feature")).toBe(false);
  });

  it("allows go read-only subcommands", () => {
    expect(isSafeCommand("go doc go.opentelemetry.io/otel/label")).toBe(true);
    expect(isSafeCommand("go doc go.opentelemetry.io/otel/codes 2>&1 | head -20")).toBe(true);
    expect(
      isSafeCommand(
        "go list -m -versions go.opentelemetry.io/otel 2>&1 | tr ' ' '\\n' | grep -E '^v1\\\\.(2[89]|[3-9][0-9])' | head -20",
      ),
    ).toBe(true);
    expect(isSafeCommand("go version")).toBe(true);
    expect(isSafeCommand("go env GOOS GOARCH")).toBe(true);
  });

  it("blocks go write subcommands", () => {
    expect(isSafeCommand("go build ./...")).toBe(false);
    expect(isSafeCommand("go install golang.org/x/tools/gopls@latest")).toBe(false);
    expect(isSafeCommand("go mod tidy")).toBe(false);
  });

  it("still blocks git stash mutations", () => {
    expect(isSafeCommand("git stash push -m 'wip'")).toBe(false);
    expect(isSafeCommand("git stash pop")).toBe(false);
  });

  it("allows 2>/dev/null on safe commands", () => {
    expect(isSafeCommand("git remote -v 2>/dev/null")).toBe(true);
    expect(isSafeCommand("gh pr view 1564 2>/dev/null")).toBe(true);
    expect(isSafeCommand("npm list 2>/dev/null")).toBe(true);
  });

  it("allows 2>&1 on safe commands", () => {
    expect(isSafeCommand("git log 2>&1")).toBe(true);
  });

  it("still blocks stdout redirects even with stderr redirect present", () => {
    expect(isSafeCommand("echo 'hello' > file.ts 2>/dev/null")).toBe(false);
    expect(isSafeCommand("cat config > backup.txt 2>/dev/null")).toBe(false);
  });

  it("allows the exact user-reported blocked commands", () => {
    expect(isSafeCommand("cd /Users/u/partying/pt-room && git remote -v 2>/dev/null; echo '---'; ls")).toBe(true);
    expect(
      isSafeCommand(
        "gh pr view 1564 --repo olachat/pt-partying --json title,body,files,additions,deletions 2>/dev/null || echo 'gh failed'",
      ),
    ).toBe(true);
  });

  it("allows cat piped to grep", () => {
    expect(
      isSafeCommand(
        'cd /Volumes/Ext/code/personal/sttacomp && cat web/package.json | grep -E "tailwind|postcss|smui|svetamat"',
      ),
    ).toBe(true);
  });

  it("allows cat glob with 2>/dev/null and || echo fallback", () => {
    expect(
      isSafeCommand(
        'cd /Volumes/Ext/code/personal/sttacomp && cat web/tailwind.config.* 2>/dev/null || echo "no tailwind config found"',
      ),
    ).toBe(true);
  });

  // --- Quote-aware handling ---

  // https://github.com/user/repo/issues/1 — 'code' in path matched editor regex
  it("allows cd && git status && echo && git log chain (path with 'code')", () => {
    expect(
      isSafeCommand('cd /Volumes/Ext/code/personal/sttacomp && git status && echo "---LOG---" && git log --oneline -5'),
    ).toBe(true);
  });

  // Operators inside quoted arguments are literal, not shell operators.
  it("handles && inside quoted strings (splitCompoundCommand is quote-aware)", () => {
    // `echo "use && for chaining" && git status` — the && inside the quotes must
    // not split the command; both real sub-commands (echo, git status) are safe.
    expect(isSafeCommand('echo "use && for chaining" && git status')).toBe(true);
  });

  it("handles > inside quoted grep arguments (destructive check is quote-aware)", () => {
    // The > is a literal comparison operator in the search string, not a redirect.
    expect(isSafeCommand("grep 'x > y' file.txt")).toBe(true);
    expect(isSafeCommand('grep "x > y" file.txt')).toBe(true);
  });

  // --- Quote-awareness must not open real holes ---

  it("still blocks a real destructive command after a quoted segment", () => {
    // The rm is OUTSIDE the quotes — a real operator. Must stay blocked.
    expect(isSafeCommand('echo "ignored" && rm -rf /')).toBe(false);
  });

  it("allows a destructive-looking word when it is entirely inside quotes", () => {
    // "rm foo" is a literal argument to echo, not the rm command.
    expect(isSafeCommand('echo "rm foo"')).toBe(true);
  });

  it("still blocks a real append redirect outside quotes", () => {
    expect(isSafeCommand("echo x >> f")).toBe(false);
  });
});

describe("isRepoScopedCommand", () => {
  it("detects repo-scoped commands", () => {
    expect(isRepoScopedCommand("git status")).toBe(true);
    expect(isRepoScopedCommand("go test ./...")).toBe(true);
    expect(isRepoScopedCommand("npm test")).toBe(true);
  });

  it("ignores non-repo-scoped commands", () => {
    expect(isRepoScopedCommand("ls -la")).toBe(false);
    expect(isRepoScopedCommand("cat README.md")).toBe(false);
    expect(isRepoScopedCommand("cd /tmp && ls")).toBe(false);
  });
});
describe("characterization: current pre-fix behavior", () => {
  it("does NOT detect repo-scoped commands with env-prefix/wrapper forms", () => {
    expect(isRepoScopedCommand("GF_GCFG_PATH=. go test ./...")).toBe(false);
    expect(isRepoScopedCommand("env FOO=1 git status")).toBe(false);
    expect(isRepoScopedCommand("/usr/bin/git status")).toBe(false);
    expect(isRepoScopedCommand("command git status")).toBe(false);
  });

  it("blocks git rev-parse --show-toplevel in blocking phases", () => {
    expect(isSafeCommand("git rev-parse --show-toplevel")).toBe(false);
  });
});

describe("planRepoScopedBashCommand", () => {
  it("locks to cwd and rewrites repo-scoped commands", () => {
    const cwd = resolve("/repo");
    const plan = planRepoScopedBashCommand("git status", null, cwd, true);
    expect(plan.action).toBe("rewrite");
    if (plan.action !== "rewrite") return;
    expect(plan.lockedRoot).toBe(cwd);
    expect(plan.rewrittenCommand).toBe(`cd '${cwd}' && git status`);
  });

  it("does not rewrite when command already starts with cd inside locked root", () => {
    const lockedRoot = resolve("/repo");
    const plan = planRepoScopedBashCommand("cd /repo/sub && git status", lockedRoot, lockedRoot, true);
    expect(plan.action).toBe("noop");
    if (plan.action !== "noop") return;
    expect(plan.lockedRoot).toBe(lockedRoot);
  });

  it("requires confirmation for explicit root switch in interactive mode", () => {
    const plan = planRepoScopedBashCommand("cd /other-repo && git status", "/repo", "/repo", true);
    expect(plan.action).toBe("confirm-switch");
    if (plan.action !== "confirm-switch") return;
    expect(plan.currentRoot).toBe(resolve("/repo"));
    expect(plan.candidateRoot).toBe(resolve("/other-repo"));
  });

  it("fails closed for explicit root switch in non-interactive mode", () => {
    const plan = planRepoScopedBashCommand("cd /other-repo && git status", "/repo", "/repo", false);
    expect(plan.action).toBe("block");
    if (plan.action !== "block") return;
    expect(plan.reason).toContain("non-interactive mode");
  });

  it("leaves non-repo commands untouched", () => {
    const plan = planRepoScopedBashCommand("ls -la", null, "/repo", true);
    expect(plan.action).toBe("noop");
    if (plan.action !== "noop") return;
    expect(plan.lockedRoot).toBe(null);
  });
});

describe("shouldBlockFilePath", () => {
  const cwd = "/project";

  it("allows writes under docs/plans/", () => {
    expect(shouldBlockFilePath("docs/plans/2026-04-21-feature-design.md", cwd)).toBe(false);
    expect(shouldBlockFilePath("docs/plans/sub/nested.md", cwd)).toBe(false);
  });

  it("blocks writes outside docs/plans/", () => {
    expect(shouldBlockFilePath("src/index.ts", cwd)).toBe(true);
    expect(shouldBlockFilePath("extensions/workflow-guard.ts", cwd)).toBe(true);
    expect(shouldBlockFilePath("docs/README.md", cwd)).toBe(true);
  });

  it("blocks writes to docs/plans/ itself (no trailing file)", () => {
    expect(shouldBlockFilePath("docs/plans", cwd)).toBe(true);
  });

  it("blocks absolute paths outside plans", () => {
    expect(shouldBlockFilePath("/tmp/evil.js", cwd)).toBe(true);
  });
});

describe("guard behavior for shell-pipeline forms (coherence contract)", () => {
  // Commands the skills tell the agent to run. The blocking-phase ones
  // (brainstorm, verify) MUST pass isSafeCommand or the skill is broken.
  // Unlocked-phase commands (scaffold/execute/finalize) run with phase=null
  // and bypass the guard entirely, so they're not tested here.

  describe("brainstorm (blocking) — git state check", () => {
    it("allows 'git status'", () => {
      expect(isSafeCommand("git status")).toBe(true);
    });
    it("allows 'git log --oneline -5'", () => {
      expect(isSafeCommand("git log --oneline -5")).toBe(true);
    });
    it("allows the chained brainstorm step-1 command", () => {
      expect(isSafeCommand("git status && git log --oneline -5")).toBe(true);
    });
  });

  describe("verify (blocking) — git scope check", () => {
    it("allows 'git log --oneline'", () => {
      expect(isSafeCommand("git log --oneline")).toBe(true);
    });
    it("allows 'git diff --stat'", () => {
      expect(isSafeCommand("git diff --stat")).toBe(true);
    });
    it("allows 'git diff'", () => {
      expect(isSafeCommand("git diff")).toBe(true);
    });
  });

  describe("verify/execute — frontier query forms", () => {
    it("allows a simple scoped grep (single sentinel, common case)", () => {
      expect(isSafeCommand("grep -rnE 'stub\\(\"' src/auth")).toBe(true);
    });
    it("allows find for sentinels", () => {
      expect(isSafeCommand("find . -name .ptk-scaffold -not -path '*/node_modules/*'")).toBe(true);
    });
    // Shell loops use ';' which splitCompoundCommand splits on. Each part must
    // independently match a SAFE pattern. 'for'/'while'/'do'/'done' don't.
    it("BLOCKS a 'for f in ...; do ...; done' feature-listing loop", () => {
      expect(isSafeCommand('for f in $(find . -name .ptk-scaffold); do echo "$f"; done')).toBe(false);
    });
    it("BLOCKS a while-read pipeline over sentinels", () => {
      expect(
        isSafeCommand("find . -name .ptk-scaffold -print0 | while IFS= read -r -d '' f; do grep -rnE x \"$f\"; done"),
      ).toBe(false);
    });
  });
});

describe("phaseForInput", () => {
  it("enters brainstorm phase on /skill:ptk-brainstorming", () => {
    expect(phaseForInput("/skill:ptk-brainstorming", null)).toBe("brainstorm");
  });

  it("enters verify phase on /skill:ptk-verify", () => {
    expect(phaseForInput("/skill:ptk-verify", null)).toBe("verify");
  });

  it("unlocks on /skill:ptk-scaffold", () => {
    expect(phaseForInput("/skill:ptk-scaffold", "brainstorm")).toBe(null);
    expect(phaseForInput("/skill:ptk-scaffold", "verify")).toBe(null);
  });

  it("unlocks on /skill:ptk-execute", () => {
    expect(phaseForInput("/skill:ptk-execute", "brainstorm")).toBe(null);
  });

  it("unlocks on /skill:ptk-finalizing", () => {
    expect(phaseForInput("/skill:ptk-finalizing", "brainstorm")).toBe(null);
  });

  it("unlocks on /skill:ptk-modify", () => {
    expect(phaseForInput("/skill:ptk-modify", "brainstorm")).toBe(null);
    expect(phaseForInput("/skill:ptk-modify", "verify")).toBe(null);
  });

  it("unlocks even with trailing args", () => {
    expect(phaseForInput("/skill:ptk-scaffold go", "brainstorm")).toBe(null);
    expect(phaseForInput("/skill:ptk-execute the plan", "verify")).toBe(null);
  });

  it("preserves phase on unrelated input", () => {
    expect(phaseForInput("hello world", "brainstorm")).toBe("brainstorm");
    expect(phaseForInput("hello world", "verify")).toBe("verify");
    expect(phaseForInput("hello world", null)).toBe(null);
  });

  it("ptk-diagnose is unrestricted — does not change phase", () => {
    expect(phaseForInput("/skill:ptk-diagnose", "brainstorm")).toBe("brainstorm");
    expect(phaseForInput("/skill:ptk-diagnose", null)).toBe(null);
  });

  it("does NOT match unlocking skills as a prefix (exact match only)", () => {
    // "/skill:ptk-scaffoldXYZ" must not accidentally unlock
    expect(phaseForInput("/skill:ptk-scaffoldXYZ", "brainstorm")).toBe("brainstorm");
  });

  it("does not leak pwk- skill names into the phase model", () => {
    // This kit has no writing-plans skill and no "plan" phase
    expect(phaseForInput("/skill:pwk-writing-plans", "brainstorm")).toBe("brainstorm");
    expect(phaseForInput("/skill:pwk-brainstorming", "brainstorm")).toBe("brainstorm");
  });
});
