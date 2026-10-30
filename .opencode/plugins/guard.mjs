// OpenCode plugin: blocks tool calls that break the project guardrails.
import { check } from '../../scripts/guard/rules.mjs';

export const Guard = async () => ({
  'tool.execute.before': async (input, output) => {
    const reason = check(input.tool, output.args);
    if (reason) throw new Error(`BLOCKED by project guardrails: ${reason} See AGENTS.md.`);
  },
});
