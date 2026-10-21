import test from 'node:test';
import assert from 'node:assert/strict';
import {attachTouchControls} from '../src/touch_controls.js';

function target(dataset = {}) {
  const listeners = new Map();
  const classes = new Set();
  return {
    dataset,
    classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } },
    addEventListener(name, fn) { listeners.set(name, fn); },
    fire(name, props = {}) {
      const event = { pointerType: 'touch', button: 0, pointerId: 1, detail: 1,
        preventDefault() {}, ...props };
      listeners.get(name)?.(event);
    },
    setPointerCapture() {},
  };
}

function setup() {
  const buttons = ['ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'KeyE'].map(code => target({code}));
  const host = target();
  const documentRoot = target();
  const keys = new Set();
  const timers = new Map();
  let nextTimer = 0;
  let now = 0;
  const adapter = attachTouchControls({
    root: {querySelectorAll() {return buttons;}},
    keys, host, documentRoot, clock: () => now,
    after(callback) {const id = ++nextTimer; timers.set(id, callback); return id;},
    cancel(id) {timers.delete(id);},
  });
  return {
    buttons, host, documentRoot, keys, timers, adapter,
    tick(ms) {now += ms; for (const [id, cb] of [...timers]) {timers.delete(id); cb();}},
  };
}

test('two simultaneous fingers press independent controls and release independently', () => {
  const t = setup();
  t.buttons[0].fire('pointerdown', {pointerId: 1});
  t.buttons[2].fire('pointerdown', {pointerId: 2});
  assert.deepEqual([...t.keys].sort(), ['ArrowLeft', 'Space']);
  t.buttons[0].fire('pointerup', {pointerId: 1});
  assert.deepEqual([...t.keys], ['Space']);
  t.buttons[2].fire('pointerup', {pointerId: 2});
  t.tick(100);
  assert.equal(t.keys.size, 0);
});

test('short jump keeps a bounded pulse and is then released', () => {
  const t = setup();
  t.buttons[2].fire('pointerdown');
  t.buttons[2].fire('pointerup');
  assert.equal(t.keys.has('Space'), true);
  t.tick(100);
  assert.equal(t.keys.has('Space'), false);
});

test('rotation cancels held pointers and pending jump pulses', () => {
  const t = setup();
  t.buttons[0].fire('pointerdown', {pointerId: 1});
  t.buttons[2].fire('pointerdown', {pointerId: 2});
  t.buttons[2].fire('pointerup', {pointerId: 2});
  t.host.fire('orientationchange');
  assert.equal(t.keys.size, 0);
  assert.equal(t.timers.size, 0);
  t.tick(100);
  assert.equal(t.keys.size, 0);
});

test('blur and pointercancel do not leave stuck controls', () => {
  const t = setup();
  t.buttons[3].fire('pointerdown');
  t.buttons[3].fire('pointercancel');
  assert.equal(t.keys.size, 0);
  t.buttons[1].fire('pointerdown');
  t.host.fire('blur');
  assert.equal(t.keys.size, 0);
});

test('non-primary mouse input is ignored', () => {
  const t = setup();
  t.buttons[0].fire('pointerdown', {pointerType:'mouse', button:2});
  assert.equal(t.keys.size, 0);
});
