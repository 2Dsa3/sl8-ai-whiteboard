const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure reports dir exists
fs.mkdirSync('reports', { recursive: true });

const args = ['eslint', '.', '-f', 'json', '-o', path.join('reports', 'eslint-report.json')];
console.log('Running:', 'npx', args.join(' '));
const res = spawnSync('npx', args, { stdio: 'inherit', shell: true });

// Always try to generate HTML even if ESLint found errors
try {
  require('./generate-eslint-html.cjs');
} catch (e) {
  console.error('Failed to generate HTML report:', e);
}

// Exit with 0 so the report step doesn't fail CI
process.exit(0);

