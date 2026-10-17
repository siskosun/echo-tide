import test from 'node:test';
import assert from 'node:assert/strict';
import { attachTouchControls, TOUCH_ACTIONS } from '../src/touch_controls.js';

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(fn);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, fields = {}) {
    const event = {
      pointerId: -1, pointerType: 'touch', button: 0,
      prevented: false, preventDefault() { this.prevented = true; }, ...fields,
    };
    for (const fn of [...(this.listeners.get(type) || [])]) fn(event);
    return event;
  }
}

class Button extends Target {
  constructor() { super(); this.attrs = new Map(); this.captured = new Set(); }
  setAttribute(name, value) { this.attrs.set(name, value); }
  getAttribute(name) { return this.attrs.get(name); }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) {
    this.captured.delete(id);
    this.emit('lostpointercapture', { pointerId: id });
  }
}

function setup() {
  const buttons = Object.fromEntries(TOUCH_ACTIONS.map(action => [action, new Button()]));
  const windowTarget = new Target();
  const documentTarget = new Target();
  documentTarget.hidden = false;
  let focused = 0;
  const touch = attachTouchControls({
    buttons, windowTarget, documentTarget, onPress: () => { focused += 1; },
  });
  return { buttons, windowTarget, documentTarget, touch, getFocused: () => focused };
}

test('two independent touches hold direction and jump until each pointer releases', () => {
  const { touch, buttons, getFocused } = setup();
  const leftDown = buttons.left.emit('pointerdown', { pointerId: 11 });
  buttons.jump.emit('pointerdown', { pointerId: 12, isPrimary: false });
  assert.equal(leftDown.prevented, true);
  assert.deepEqual(touch.read(), { left: true, right: false, jump: true, anchor: false });
  assert.equal(buttons.left.getAttribute('aria-pressed'), 'true');
  assert.equal(getFocused(), 2);
  buttons.left.emit('pointerup', { pointerId: 11 });
  assert.deepEqual(touch.read(), { left: false, right: false, jump: true, anchor: false });
  buttons.jump.emit('pointerup', { pointerId: 12 });
  assert.ok(Object.values(touch.read()).every(value => value === false));
});

test('multiple fingers on one control do not release each other', () => {
  const { touch, buttons } = setup();
  buttons.right.emit('pointerdown', { pointerId: 30 });
  buttons.right.emit('pointerdown', { pointerId: 31, isPrimary: false });
  buttons.right.emit('pointerup', { pointerId: 30 });
  assert.equal(touch.read().right, true);
  buttons.right.emit('pointercancel', { pointerId: 31 });
  assert.equal(touch.read().right, false);
});

test('pointercancel, capture loss and global pointerup all clear controls', () => {
  const { touch, buttons, windowTarget } = setup();
  buttons.anchor.emit('pointerdown', { pointerId: 7 });
  buttons.anchor.emit('lostpointercapture', { pointerId: 7 });
  assert.equal(touch.read().anchor, false);
  buttons.jump.emit('pointerdown', { pointerId: 8 });
  windowTarget.emit('pointercancel', { pointerId: 8 });
  assert.equal(touch.read().jump, false);
  buttons.left.emit('pointerdown', { pointerId: 9 });
  windowTarget.emit('pointerup', { pointerId: 9 });
  assert.equal(touch.read().left, false);
});

test('focus loss and page hiding never leave a stuck direction', () => {
  const { touch, buttons, windowTarget, documentTarget } = setup();
  buttons.left.emit('pointerdown', { pointerId: 1 });
  buttons.jump.emit('pointerdown', { pointerId: 2 });
  windowTarget.emit('blur');
  assert.ok(Object.values(touch.read()).every(value => value === false));
  assert.equal(buttons.jump.getAttribute('aria-pressed'), 'false');
  buttons.right.emit('pointerdown', { pointerId: 3 });
  documentTarget.hidden = true;
  documentTarget.emit('visibilitychange');
  assert.equal(touch.read().right, false);
});

test('secondary mouse buttons are not interpreted as game actions', () => {
  const { touch, buttons } = setup();
  const event = buttons.left.emit('pointerdown', {
    pointerId: 1, pointerType: 'mouse', button: 2,
  });
  assert.equal(event.prevented, false);
  assert.equal(touch.read().left, false);
});

test('dispose resets the inputs and releases all event listeners', () => {
  const { touch, buttons, windowTarget } = setup();
  buttons.jump.emit('pointerdown', { pointerId: 3 });
  touch.dispose();
  assert.equal(touch.read().jump, false);
  buttons.jump.emit('pointerdown', { pointerId: 4 });
  windowTarget.emit('blur');
  assert.equal(touch.read().jump, false);
});
