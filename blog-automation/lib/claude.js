const { spawn } = require('child_process');

// Claude Code Pro の認証を使ってCLI経由でAPIを呼ぶ（ANTHROPIC_API_KEY不要）
async function callClaude({ model, system, messages, maxTokens, expectJson = false }) {
  void maxTokens; // Claude Code CLI では max_tokens を直接指定できない

  const userContent = messages.map(m => m.content).join('\n\n');

  const args = [
    '--print',
    '--model', model,
    '--output-format', 'text',
    '--no-session-persistence',     // セッション履歴を残さない
  ];
  if (system) args.push('--system-prompt', system);

  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';

    // ANTHROPIC_API_KEY が未設定またはプレースホルダーの場合は削除し、
    // Claude Code の OAuth/キーチェーン認証にフォールバックさせる
    const env = { ...process.env };
    const apiKey = env.ANTHROPIC_API_KEY || '';
    if (!apiKey || apiKey.length < 30 || apiKey.includes('xxx')) {
      delete env.ANTHROPIC_API_KEY;
    }

    const proc = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], shell: false, env });

    // プロンプトをstdinで渡す（引数長制限を回避）
    proc.stdin.write(userContent);
    proc.stdin.end();

    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', err => reject(new Error(`claude CLIの起動に失敗: ${err.message}`)));
    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`Claude CLI error (code ${code}): ${stderr.slice(0, 300)}`));
      }
      const text = stdout.trim();
      let out = text;
      if (expectJson) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        out = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;
      }
      resolve({ text: out, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    });
  });
}

module.exports = { callClaude };
