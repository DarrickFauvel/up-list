---
description: Create a branch, commit, push, open a PR, and squash-merge it — fully automatic
---

Ship the current changes end-to-end. Run every step without pausing for confirmation.

1. Run `git status` and `git diff` (staged + unstaged) to see what changed. If there's nothing to ship, say so and stop.
2. If currently on `main`, create a new branch off it with a short kebab-case name derived from the change (e.g. `git checkout -b add-thing`). If already on a non-main branch, stay on it.
3. Stage the relevant files (avoid `git add -A`/`.` if it would pick up unrelated or secret files) and commit with a concise message describing the *why*, following this repo's commit style, ending with:
   ```
   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   ```
4. Push the branch with `git push -u origin <branch>`.
5. Open a PR with `gh pr create --title "..." --body "..."` — short title, brief summary + test plan in the body.
6. Merge immediately with `gh pr merge --squash --delete-branch` (no waiting on CI, no confirmation prompt).
7. Switch back to `main` and `git pull` to sync up, and delete the local branch if it still exists (`git branch -d <branch>`).
8. Report the PR URL.
