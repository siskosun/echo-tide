// Transient screen controls. Real game rules remain in game.js.
// One pointer owns one action; multiple fingers can hold independent actions.
export const TOUCH_ACTIONS = Object.freeze(['left', 'right', 'jump', 'anchor']);

export function attachTouchControls({ buttons, windowTarget, documentTarget, onPress = () => {} }) {
  if (!windowTarget || !documentTarget) throw new TypeError('window and document targets required');
  const held = new Map();
  const disposeListeners = [];

  for (const action of TOUCH_ACTIONS) {
    if (!buttons[action]) throw new TypeError('missing touch button: ' + action);
  }

  function listen(target, name, handler) {
    target.addEventListener(name, handler);
    disposeListeners.push(() => target.removeEventListener(name, handler));
  }

  function sync() {
    for (const action of TOUCH_ACTIONS) {
      buttons[action].setAttribute('aria-pressed', String([...held.values()].includes(action)));
    }
  }

  function releasePointer(event) {
    if (!held.has(event.pointerId)) return;
    const action = held.get(event.pointerId);
    held.delete(event.pointerId);
    const button = buttons[action];
    if (button.hasPointerCapture?.(event.pointerId)) {
      try { button.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    }
    sync();
  }

  function reset() {
    const previous = [...held.entries()];
    held.clear();
    for (const [id, action] of previous) {
      const button = buttons[action];
      if (button.hasPointerCapture?.(id)) {
        try { button.releasePointerCapture(id); } catch { /* capture already lost */ }
      }
    }
    sync();
  }

  for (const action of TOUCH_ACTIONS) {
    const button = buttons[action];
    listen(button, 'pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (!Number.isInteger(event.pointerId)) return;
      event.preventDefault();
      held.set(event.pointerId, action);
      try { button.setPointerCapture?.(event.pointerId); } catch { /* window handlers still release */ }
      sync();
      onPress();
    });
    listen(button, 'pointerup', releasePointer);
    listen(button, 'pointercancel', releasePointer);
    listen(button, 'lostpointercapture', releasePointer);
  }
  // Fallback for browsers that decline pointer capture.
  listen(windowTarget, 'pointerup', releasePointer);
  listen(windowTarget, 'pointercancel', releasePointer);
  listen(windowTarget, 'blur', reset);
  listen(documentTarget, 'visibilitychange', () => {
    if (documentTarget.hidden) reset();
  });
  sync();

  return {
    read() {
      const values = [...held.values()];
      return Object.fromEntries(TOUCH_ACTIONS.map(action => [action, values.includes(action)]));
    },
    reset,
    dispose() {
      reset();
      for (const unbind of disposeListeners) unbind();
    },
  };
}
