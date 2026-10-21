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

test('portrait gate returns before restart, next, or simulation updates', () => {
  const main = readFileSync(join(root, 'src', 'main.js'), 'utf8');
  const frame = main.slice(main.indexOf('function frame(now) {'), main.indexOf('function syncUi() {'));
  const gate = frame.indexOf('if (portraitTouchMode.matches) {');
  const returnAt = frame.indexOf('return;', gate);
  assert.ok(gate >= 0 && returnAt > gate, 'frame has an early portrait return');
  for (const mutation of ['game = update(', 'accumulator += dt', 'const restartDown =', 'const nextDown =']) {
    assert.ok(frame.indexOf(mutation) > returnAt, mutation + ' must follow the portrait return');
  }
  assert.match(main, /touchControls\.clear\(\);[\s\S]*?accumulator = 0;[\s\S]*?last = performance\.now\(\);[\s\S]*?const portrait = portraitTouchMode\.matches/);
});
