// Hook adapter. Usage: node scripts/guard/guard.mjs <claude|cursor>
// Reads the hook payload from stdin. Fails closed: any error means deny.
import { check } from './rules.mjs';

const mode = process.argv[2] || 'claude';

const deny = (reason) => {
  const msg = `BLOCKED by project guardrails: ${reason} See AGENTS.md.`;
  if (mode === 'cursor') {
    process.stdout.write(
      JSON.stringify({
        permission: 'deny',
        user_message: msg,
        agent_message: msg,
        userMessage: msg,
        agentMessage: msg,
      }),
    );
  }
  process.stderr.write(msg + '\n');
  process.exit(2);
};

const allow = () => {
  if (mode === 'cursor') process.stdout.write(JSON.stringify({ permission: 'allow' }));
  process.exit(0);
};

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const p = JSON.parse(raw || '{}');
    const tool = p.tool_name ?? p.toolName ?? (typeof p.command === 'string' ? 'shell' : '');
    const input = p.tool_input ?? p.toolInput ?? (typeof p.command === 'string' ? { command: p.command } : {});
    const reason = check(tool, input);
    reason ? deny(reason) : allow();
  } catch (e) {
    deny(`guard error (${e.message}).`);
  }
});
