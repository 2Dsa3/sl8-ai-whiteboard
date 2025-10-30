const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure reports dir exists
fs.mkdirSync('reports', { recursive: true });

const eslintBin = process.platform === 'win32'
  ? path.join('node_modules', '.bin', 'eslint.cmd')
  : path.join('node_modules', '.bin', 'eslint');
const args = ['.', '-f', 'json', '-o', path.join('reports', 'eslint-report.json')];
console.log('Running:', eslintBin, args.join(' '));
spawnSync(eslintBin, args, { stdio: 'inherit', shell: false });

// Always try to generate HTML even if ESLint found errors
try {
  require('./generate-eslint-html.cjs');
} catch (e) {
  console.error('Failed to generate HTML report:', e);
}

// Exit with 0 so the report step doesn't fail CI
process.exit(0);
