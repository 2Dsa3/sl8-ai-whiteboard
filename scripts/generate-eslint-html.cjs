const fs = require('fs');
const path = require('path');

const reportPath = path.join('reports', 'eslint-report.json');
const outPath = path.join('reports', 'eslint-report.html');

fs.mkdirSync('reports', { recursive: true });

if (!fs.existsSync(reportPath)) {
  console.error('Report JSON not found at', reportPath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const escape = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const rows = [];
let errorCount = 0;
let warningCount = 0;

for (const file of data) {
  for (const m of file.messages) {
    if (m.severity === 2) errorCount++; else warningCount++;
    rows.push(`<tr><td>${escape(file.filePath)}</td><td>${escape(m.ruleId || '')}</td><td>${m.severity === 2 ? 'error' : 'warn'}</td><td>${m.line || ''}</td><td>${escape(m.message)}</td></tr>`);
  }
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>ESLint Report</title>
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;padding:24px}h1{margin-top:0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;font-size:14px}th{background:#f6f6f6;text-align:left}tr:nth-child(even){background:#fafafa}.counters{margin:10px 0 20px}.badge{display:inline-block;padding:4px 8px;border-radius:12px;margin-right:8px;font-size:12px}.err{background:#ffe5e5;color:#a40000}.warn{background:#fff8e1;color:#664d03}</style>
</head><body>
<h1>ESLint Report</h1>
<div class="counters">
  <span class="badge err">Errors: ${errorCount}</span>
  <span class="badge warn">Warnings: ${warningCount}</span>
  <span>Generated ${new Date().toISOString()}</span>
  <p>Open this file and take a screenshot for your report.</p>
</div>
<table><thead><tr><th>File</th><th>Rule</th><th>Severity</th><th>Line</th><th>Message</th></tr></thead><tbody>
${rows.join('\n')}
</tbody></table>
</body></html>`;

fs.writeFileSync(outPath, html);
console.log('Wrote', outPath);

