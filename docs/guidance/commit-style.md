# Commit style

Kaban uses Conventional Commits. Whoever made a change writes the commit message for it. The owner is the only one who runs `git add` and `git commit`.

## Who does what

- **Coding agent (Grok, or Claude Opus when it fixes code):** at a "Commit checkpoint", list the files changed for that task and write the commit message yourself from the **actual diff**. The message in a plan is only a starting point; if what you really changed differs, the message must describe what you really changed. Then stop and wait for the owner to commit.
- **Docs written by Claude Sonnet (specs, plans, guidance):** Claude gives the owner those messages.
- **Never mix authors in one commit.** If a file was changed by two different authors, say so and let the owner decide how to split it. Do not edit plan files to tick checkboxes; keep progress in the chat.
- Never run `git add`, `git commit`, `git push`, `git reset`, `git checkout`, or switch branches. Read-only commands (`git status`, `git diff`, `git log`) are fine.

## Message format

```
type(scope): subject

- bullet
- bullet
```

**Subject line**
- Lowercase after the colon, except proper nouns and acronyms (Vitest, Playwright, OAuth, SQLite, PWA).
- Imperative, verb first: "add", not "added" or "adds". No trailing period.
- About 40 to 72 characters including the prefix; hard stop near 80.
- One logical change, named by its outcome, not by the file touched.
- Common opening verbs: `add`, `implement`, `replace`, `harden`, `support`, `keep`, `align`, `update`, `restore`, `unify`, `wire`, `split`, `simplify`, `show`, `rewrite`, `remove`.

**Types:** `feat` (new capability or behavior), `fix`, `docs` (specs, plans, guidance, decision records), `chore` (config, deps, housekeeping), `refactor`, `test` (tests only), `style` (formatting with no logic change), `perf`, `ci`, `build`, `security`. Pick the type by what the change does, not by the folder. A test for a new feature belongs in that feature's `feat` commit unless the owner commits tests separately.

**Scope:** a feature area, one lowercase word (hyphenate only when needed). Reuse a scope from `git log --oneline -30` when one fits. Scopes used so far: `spike`, `core`, `engine`, `design-system`, `theme`, `ui`, `shell`, `pwa`, `security`, `config`, `agents`, `plan`, `spec`, `decisions`, `handoffs`, `prototype`. Omit the scope only for repo-wide changes.

**Body**
- A blank line after the subject, then terse `-` bullets: 3 to 6 typical, up to about 10 for a large change.
- Each bullet starts with a lowercase imperative verb (`add`, `replace`, `update`, `remove`, `keep`, `cover`, `document`, `show`, `move`, `fix`, `use`, `implement`, `drop`).
- Use concrete nouns: routes, components, files, tokens, numbers. Wrap code identifiers, files and flags in backticks.
- Order from the main change to supporting changes, ending with tests and docs. Mention tests as `cover X with Y` (for example `cover the money parser with Vitest`).
- For a bug fix with a non-obvious cause, short prose is allowed: state the cause, then the fix.
- No filler ("this commit...", "various fixes").

**Never in a message:** `Co-Authored-By`, `Signed-off-by`, "Generated with...", links to AI sessions, or any trailer naming an AI, tool or bot. No issue or PR numbers unless the owner gave one. Describe only what the diff shows.

**Breaking changes** are rare. If a change truly breaks an API, config or data format, add `!` after the scope and a `BREAKING CHANGE:` paragraph in the body.

## Splitting

If the staged changes mix unrelated concerns, say so in one line and give separate messages with the files that belong to each, so the owner can stage and commit them separately.

## Examples

```
feat(engine): add cash overspending and the ready to assign deduction

- reset a negative available balance next month and deduct the cash shortfall from ready to assign
- keep the deduction for every later month, including months with no activity
- cover the verified overspend scenario and fresh assignments after an overspend with Vitest
```

```
fix(shell): return focus to the heading after a route change

The route announcer moved focus before the new screen rendered, so focus landed on the previous page's heading. Move focus in an effect that runs after the route's `h1` mounts.
```

```
chore(config): pin vitest to 5.0.3
```
