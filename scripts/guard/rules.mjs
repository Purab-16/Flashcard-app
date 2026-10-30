// Shared guardrail rules. Used by every tool adapter (Claude Code, Cursor, Copilot, OpenCode).
// check(toolName, toolInput) returns a deny reason (string) or null when allowed.
// Humans may edit this file. Agents are blocked from editing it (see PROTECTED_PATHS).

const SQL_DELETE = [
  /\bdelete\s+from\b/i,
  /\bdrop\s+(table|database|schema|index|view|column|collection|user|role)\b/i,
  /\btruncate\s+(table|only)\b/i,
  /\balter\s+table\b[^;]*\bdrop\b/i,
  /\b(deleteMany|deleteOne|delete_many|delete_one|bulkDelete|destroy_all|destroyAll|drop_all|dropAll|dropDatabase|dropCollection|drop_collection|flushall|flushdb)\b/i,
  /\bdb\.\w+\.(remove|drop|deleteMany|deleteOne)\s*\(/i,
  /\bprisma\s+migrate\s+reset\b/i,
  /\bprisma\s+db\s+push\b[^\n]*--(force-reset|accept-data-loss)/i,
  /\b(migrate:fresh|db:drop|db:reset|db:migrate:reset)\b/i,
  /\bmanage\.py\s+(flush|sqlflush)\b/i,
];

const GIT_CMD = /(^|[\s;&|(`"'=]|[\/\\])(git|gh)(\.exe)?(?=$|[\s;&|)"'`])/i;
const DOT_GIT = /(^|[\/\\\s"'=])\.git([\/\\\s"']|$)/i;
const GITHUB_API = /(api\.github\.com|github\.com\/[\w.-]+\/[\w.-]+\/(pulls|issues|git))/i;

const OBFUSCATION = [
  /base64\s+(-d|--decode)/i,
  /frombase64string/i,
  /-enc(odedcommand)?\b/i,
  /\|\s*(sh|bash|zsh|pwsh|powershell|iex)\b/i,
  /\binvoke-expression\b|\biex\b/i,
  /\beval\b/i,
  /child_process|\bsubprocess\b|os\.system|Runtime\.getRuntime|Process\.Start|Start-Process/i,
];

const WRITE_VERBS =
  />|\b(rm|del|erase|mv|move|cp|copy|sed|tee|ren|rename|attrib|chmod|chown|icacls|ln|node|python\d?|perl|ruby)\b|set-content|add-content|out-file|remove-item|move-item|copy-item|rename-item/i;

// Agents may not edit these. Humans can.
const PROTECTED = [
  /(^|\/)(agents|claude|gemini)\.md$/i,
  /(^|\/)opencode\.json$/i,
  /(^|\/)\.claude\//i,
  /(^|\/)\.cursor\//i,
  /(^|\/)\.opencode\//i,
  /(^|\/)\.github\/hooks\//i,
  /(^|\/)\.github\/copilot-instructions\.md$/i,
  /(^|\/)scripts\/guard\//i,
];
const PROTECTED_IN_CMD =
  /(agents\.md|claude\.md|gemini\.md|opencode\.json|\.claude[\/\\]|\.cursor[\/\\]|\.opencode[\/\\]|\.github[\/\\]hooks|copilot-instructions\.md|scripts[\/\\]guard)/i;

const ENV_FILE = /(^|\/)\.env(\.(?!example$)[^\/]*)?$/i;
const CONTENT_SCAN_SKIP = /(\.md|\.txt|\.mdc)$|(^|\/)(db\/proposed|docs)\//i;

const READ_ONLY_TOOL = /^(read|glob|grep|ls|list|view|read_file|readfile|search|find)$/i;
const SHELL_TOOL = /(bash|shell|terminal|powershell|run_command|runcommand|exec)/i;

const flatten = (value, key = '', out = []) => {
  if (value == null) return out;
  if (typeof value === 'string') {
    out.push([key, value]);
  } else if (Array.isArray(value)) {
    value.forEach((v) => flatten(v, key, out));
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, k, out);
  }
  return out;
};

const views = (cmd) => [
  cmd,
  cmd.replace(/[\^`"']/g, ''),
  cmd.replace(/[\^`"'\\]/g, ''),
];

const matchesSql = (text) => SQL_DELETE.find((re) => re.test(text));

function checkCommand(cmd) {
  for (const v of views(cmd)) {
    if (GIT_CMD.test(v)) return 'git/gh commands are blocked. Ask the human to run them.';
    if (DOT_GIT.test(v)) return 'Touching .git is blocked.';
    if (GITHUB_API.test(v)) return 'GitHub API access is blocked.';
    if (matchesSql(v)) return 'Database delete operations are blocked. Draft SQL in db/proposed/ instead.';
    if (OBFUSCATION.some((re) => re.test(v)))
      return 'Encoded, eval, or subprocess-style commands are blocked (possible guardrail bypass).';
  }
  const slashed = cmd.replace(/\\/g, '/');
  if (PROTECTED_IN_CMD.test(slashed) && WRITE_VERBS.test(slashed))
    return 'Guardrail and agent config files are protected. Ask the human to change them.';
  if (/(^|[\s\/])\.env(\.(?!example\b)\w+)?(\s|$)/i.test(slashed) && WRITE_VERBS.test(slashed))
    return '.env files are protected.';
  return null;
}

function checkPath(path, readOnly) {
  const p = path.replace(/\\/g, '/');
  if (DOT_GIT.test(p)) return 'Touching .git is blocked.';
  if (ENV_FILE.test(p)) return '.env files are protected.';
  if (!readOnly && PROTECTED.some((re) => re.test(p)))
    return 'Guardrail and agent config files are protected. Ask the human to change them.';
  return null;
}

function checkContent(text, paths) {
  const skip = paths.some((p) => CONTENT_SCAN_SKIP.test(p.replace(/\\/g, '/')));
  if (skip) return null;
  if (matchesSql(text))
    return 'Writing database delete operations is blocked. Draft SQL in db/proposed/ instead.';
  return null;
}

export function check(toolName, toolInput) {
  const tool = String(toolName || '');
  let input = toolInput;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      input = { command: input };
    }
  }

  if (/github/i.test(tool)) return 'GitHub tools are blocked.';
  if (/^mcp/i.test(tool) && /(delete|drop|truncate|destroy)/i.test(tool))
    return 'MCP delete-style tools are blocked.';

  const entries = flatten(input);
  const readOnly = READ_ONLY_TOOL.test(tool);
  const shellLike = SHELL_TOOL.test(tool);
  const paths = entries.filter(([k]) => /path|file|target|uri|dest/i.test(k)).map(([, v]) => v);

  for (const [key, value] of entries) {
    let reason = null;
    if (/^(command|cmd|commandline|script)$/i.test(key) || (shellLike && !/path|file/i.test(key))) {
      reason = checkCommand(value);
    } else if (/path|file|target|uri|dest/i.test(key)) {
      reason = checkPath(value, readOnly);
    } else if (!readOnly && /content|string|source|text|code|patch|diff|query|sql|body/i.test(key)) {
      reason = checkContent(value, paths);
    }
    if (reason) return reason;
  }
  return null;
}
