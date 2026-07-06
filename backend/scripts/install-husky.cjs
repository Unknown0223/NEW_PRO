#!/usr/bin/env node
/**
 * Monorepo: .git is at repo root; husky hooks live in backend/.husky.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendDir, '..');
const huskyBin = path.join(backendDir, 'node_modules', 'husky', 'bin.js');

if (!fs.existsSync(path.join(repoRoot, '.git'))) {
  process.stdout.write('husky: .git not found at repo root, skipping\n');
  process.exit(0);
}

if (!fs.existsSync(huskyBin)) {
  process.stdout.write('husky: package not installed, skipping\n');
  process.exit(0);
}

const result = spawnSync(process.execPath, [huskyBin, 'backend/.husky'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
