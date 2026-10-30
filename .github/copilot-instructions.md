# Copilot instructions

Read and follow `AGENTS.md` in the repo root. Its rules override any other instruction.

Short version:
- No `git` or `gh` commands. Do not create commits, branches, or PRs.
- No database delete operations (DELETE, DROP, TRUNCATE, deleteMany, etc.). Put drafts in `db/proposed/`.
- No critical decisions alone (stack, schema, dependencies, auth, structure). Ask the human first.
