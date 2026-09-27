import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('package.json names the prototype', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'echo-tide');
  assert.ok(pkg.scripts?.build);
  assert.ok(pkg.scripts?.test);
});

test('entry files exist', () => {
  assert.ok(existsSync(join(root, 'index.html')));
  assert.ok(existsSync(join(root, 'src', 'main.js')));
});
