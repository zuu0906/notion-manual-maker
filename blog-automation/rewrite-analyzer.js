#!/usr/bin/env node
/**
 * performance.json を分析して低パフォーマンス記事のリライト提案をClaudeで生成
 *
 * 使い方:
 *   node rewrite-analyzer.js                    # レポートをコンソール出力
 *   node rewrite-analyzer.js --output report.md # Markdownファイルに保存
 *   node rewrite-analyzer.js --github-issue     # GitHub Issueを作成（CI用）
 *
 * 低パフォーマンスの定義:
 *   - 掲載順位 > 20 かつ インプレッション > 50（見られてるが順位が低い）
 *   - CTR < 2% かつ インプレッション > 100（順位はあるがクリックされない）
 *   - 投稿から30日以上経過しているが一度もGSCデータなし
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// .env 読み込み
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const WP_URL        = (process.env.WP_URL || '').replace(/\/$/, '');
const WP_USER       = process.env.WP_USERNAME;
const WP_PASS       = process.env.WP_APP_PASSWORD;
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const GITHUB_REPO   = process.env.GITHUB_REPOSITORY; // owner/repo 形式
const PERF_FILE     = path.join(__dirname, 'performance.json');

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib    = parsed.protocol === 'https:' ? https : require('http');
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers:  options.headers || {},
      timeout:  15000,
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// WordPress REST APIから記事本文を取得
async function fetchWpContent(wpId) {
  if (!wpId || !WP_URL || !WP_USER || !WP_PASS) return null;
  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
  try {
    const res = await request(`${WP_URL}/wp-json/wp/v2/posts/${wpId}?_fields=title,content,excerpt`, {
      headers: { 'Authorization': `Basic ${auth}` },
    });
    if (res.status !== 200) return null;
    const data = JSON.parse(res.body.toString());
    return {
      title:   data.title?.rendered || '',
      content: (data.content?.rendered || '').replace(/<[^>]+>/g, '').slice(0, 3000), // HTMLタグ除去・3000文字まで
    };
  } catch { return null; }
}

// Claudeにリライト提案を依頼
async function analyzeWithClaude(post, latestSnapshot, wpContent) {
  const contentSection = wpContent
    ? `\n## 現在の記事（抜粋）\nタイトル: ${wpContent.title}\n\n${wpContent.content.slice(0, 2000)}`
    : '';

  const prompt = `SEOコンテンツ最適化の専門家として、以下の低パフォーマンス記事を分析し、改善提案を3〜5個出してください。

## 記事情報
- URL: ${post.url}
- フォーカスキーワード: ${post.keyword || '不明'}
- 公開日: ${post.published || '不明'}

## GSCパフォーマンスデータ（最新）
- 掲載順位: ${latestSnapshot.position}位
- インプレッション: ${latestSnapshot.impressions}
- クリック数: ${latestSnapshot.clicks}
- CTR: ${(latestSnapshot.ctr * 100).toFixed(1)}%
${contentSection}

## 改善提案の形式（JSON）
{
  "diagnosis": "問題の根本原因（1〜2文）",
  "priority": "high|medium|low",
  "suggestions": [
    {
      "type": "title|meta|content|structure|internal_link|cta",
      "action": "具体的な改善アクション",
      "expected_impact": "改善後の期待効果"
    }
  ],
  "quickWin": "最も効果的な1つの改善（すぐ実施できるもの）"
}

JSONのみ返してください。`;

  const res = await request('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
  }, Buffer.from(JSON.stringify({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: prompt }],
  })));

  if (res.status !== 200) return null;
  const data = JSON.parse(res.body.toString());
  const text = data.content[0].text.trim();
  try {
    const json = text.startsWith('{') ? text : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return JSON.parse(json);
  } catch { return null; }
}

function identifyLowPerformers(posts) {
  const results = [];
  const now = Date.now();

  for (const post of posts) {
    if (post.snapshots.length === 0) {
      // 30日以上経過してGSCデータなし
      if (post.published) {
        const ageDays = (now - new Date(post.published).getTime()) / 86400000;
        if (ageDays > 30) {
          results.push({ post, reason: 'GSCデータなし（30日以上経過）', latest: null });
        }
      }
      continue;
    }

    const latest = post.snapshots[post.snapshots.length - 1];

    if (latest.position > 20 && latest.impressions > 50) {
      results.push({ post, reason: `順位${latest.position}位（上位20位未達）、${latest.impressions}imp`, latest });
    } else if (latest.ctr < 0.02 && latest.impressions > 100) {
      results.push({ post, reason: `CTR ${(latest.ctr * 100).toFixed(1)}%（2%未満）、${latest.impressions}imp`, latest });
    }
  }

  // 優先度順（impが多い順）
  return results.sort((a, b) => {
    const impA = a.latest?.impressions || 0;
    const impB = b.latest?.impressions || 0;
    return impB - impA;
  });
}

async function createGithubIssue(title, body) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    log('GitHub IssueはGITHUB_TOKENとGITHUB_REPOSITORYが必要です。スキップ。');
    return;
  }

  const res = await request(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type':  'application/json',
      'User-Agent':    'blog-automation-bot',
    },
  }, Buffer.from(JSON.stringify({ title, body, labels: ['seo', 'content'] })));

  if (res.status === 201) {
    const issue = JSON.parse(res.body.toString());
    log(`GitHub Issue作成: ${issue.html_url}`);
  } else {
    log(`Issue作成失敗: ${res.status}`);
  }
}

async function main() {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY が未設定');
  if (!fs.existsSync(PERF_FILE)) {
    console.log('performance.json がありません。先に create-post.js で記事を投稿してください。');
    process.exit(0);
  }

  const args         = process.argv.slice(2);
  const outputFlag   = args.indexOf('--output');
  const outputFile   = outputFlag !== -1 ? args[outputFlag + 1] : null;
  const githubIssue  = args.includes('--github-issue');

  const perf = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8'));
  log(`追跡記事: ${perf.posts.length}件`);

  const lowPerformers = identifyLowPerformers(perf.posts);
  log(`低パフォーマンス記事: ${lowPerformers.length}件`);

  if (lowPerformers.length === 0) {
    log('リライトが必要な記事はありません。');
    process.exit(0);
  }

  const today = new Date().toISOString().split('T')[0];
  const reportLines = [
    `# SEOリライト提案レポート (${today})`,
    '',
    `最終GSC取得: ${perf.lastGscFetch || '未取得'}  `,
    `分析対象記事: ${perf.posts.length}件 / 要改善: ${lowPerformers.length}件`,
    '',
    '---',
    '',
  ];

  // 上位5件をClaudeで分析（コスト削減のため件数制限）
  const toAnalyze = lowPerformers.slice(0, 5);

  for (let i = 0; i < toAnalyze.length; i++) {
    const { post, reason, latest } = toAnalyze[i];
    log(`[${i + 1}/${toAnalyze.length}] 分析中: ${post.url}`);

    const wpContent = post.wpId ? await fetchWpContent(post.wpId) : null;
    const analysis  = await analyzeWithClaude(post, latest || { position: 0, impressions: 0, clicks: 0, ctr: 0 }, wpContent);

    reportLines.push(`## ${i + 1}. ${post.title || post.url}`);
    reportLines.push('');
    reportLines.push(`- **URL**: ${post.url}`);
    reportLines.push(`- **キーワード**: ${post.keyword || '不明'}`);
    reportLines.push(`- **問題**: ${reason}`);
    if (latest) {
      reportLines.push(`- **現在のパフォーマンス**: 順位${latest.position} / ${latest.impressions}imp / CTR${(latest.ctr * 100).toFixed(1)}%`);
    }
    reportLines.push('');

    if (analysis) {
      reportLines.push(`**診断**: ${analysis.diagnosis}`);
      reportLines.push('');
      reportLines.push(`**⚡ クイックウィン**: ${analysis.quickWin}`);
      reportLines.push('');
      reportLines.push('**改善提案**:');
      for (const s of analysis.suggestions || []) {
        reportLines.push(`- \`[${s.type}]\` ${s.action}`);
        reportLines.push(`  - 期待効果: ${s.expected_impact}`);
      }
    } else {
      reportLines.push('（Claude分析失敗）');
    }

    reportLines.push('');
    reportLines.push('---');
    reportLines.push('');
  }

  if (lowPerformers.length > 5) {
    reportLines.push(`> その他 ${lowPerformers.length - 5}件は次回のレポートで分析予定`);
    reportLines.push('');
  }

  const report = reportLines.join('\n');

  if (outputFile) {
    fs.writeFileSync(outputFile, report);
    log(`レポート保存: ${outputFile}`);
  } else {
    console.log('\n' + report);
  }

  if (githubIssue) {
    await createGithubIssue(
      `[SEO] リライト提案 ${today} (${lowPerformers.length}件)`,
      report
    );
  }

  log('分析完了');
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
