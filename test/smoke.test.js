import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

test('trusted Bridge sparse checkout includes all local Python module imports', () => {
  const source = readFileSync(join(root, '.github', 'workflows', 'game-exp-github-bridge.yml'), 'utf8');
  const section = source.match(/          sparse-checkout: \|\n([\s\S]*?)\n          sparse-checkout-cone-mode:/);
  assert.ok(section, 'workflow must retain explicit pinned sparse-checkout');
  const selected = new Set(section[1].split('\n').map(row => row.trim()).filter(row => row.startsWith('tools/game-exp/')));
  const available = new Set(readdirSync(join(root, 'tools', 'game-exp'))
    .filter(name => name.endsWith('.py')).map(name => name.slice(0, -3)));
  assert.ok(selected.has('tools/game-exp/github_bridge.py'));
  for (const rel of selected) {
    assert.ok(existsSync(join(root, rel)), 'sparse checkout names an existing file: ' + rel);
    const text = readFileSync(join(root, rel), 'utf8');
    for (const match of text.matchAll(/^(?:from|import)\s+([A-Za-z_]\w*)/gm)) {
      if (!available.has(match[1])) continue;
      const dependency = 'tools/game-exp/' + match[1] + '.py';
      assert.ok(selected.has(dependency), rel + ' imports local module missing from Bridge checkout: ' + dependency);
    }
  }
});
