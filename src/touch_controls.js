/** ET-VISUAL touch candidate. Input adapter only; no gameplay rules or approval side effects. */
export const HOLD_PULSE_MS = 90;
const PULSE_CODES = new Set(['Space', 'ShiftLeft', 'KeyE']);

export function attachTouchControls({root, keys, clock = () => performance.now(),
  after = (callback, delay) => setTimeout(callback, delay), cancel = clearTimeout,
  host = window, documentRoot = document} = {}) {
  if (!root || !(keys instanceof Set)) throw new TypeError('Touch control root and Set required');
  const pressedPointers = new Map();
  const scheduled = new Map();
  const buttons = [...root.querySelectorAll('button[data-code]')];
  if (buttons.length !== 5 || new Set(buttons.map(b => b.dataset.code)).size !== 5) {
    throw new Error('Touch controls require five unique input codes');
  }
  const codes = new Set(buttons.map(b => b.dataset.code));
  function cancelRelease(code) {
    if (!scheduled.has(code)) return;
    cancel(scheduled.get(code));
    scheduled.delete(code);
  }
  function sync(code) {
    const down = [...pressedPointers.values()].some(record => record.code === code) || scheduled.has(code);
    if (down) keys.add(code);
    else keys.delete(code);
    for (const button of buttons) if (button.dataset.code === code) {
      button.classList.toggle('et-touch-pressed', down);
    }
  }
  function release(pointerId, interrupted = false) {
    const record = pressedPointers.get(pointerId);
    if (!record) return;
    pressedPointers.delete(pointerId);
    const {code, started} = record;
    if (interrupted) cancelRelease(code);
    else if (PULSE_CODES.has(code) && ![...pressedPointers.values()].some(p => p.code === code)) {
      const remaining = HOLD_PULSE_MS - (clock() - started);
      if (remaining > 0) {
        cancelRelease(code);
        const timer = after(() => {scheduled.delete(code); sync(code);}, remaining);
        scheduled.set(code, timer);
      }
    }
    sync(code);
  }
  function clear() {
    pressedPointers.clear();
    for (const code of scheduled.keys()) cancelRelease(code);
    for (const code of codes) sync(code);
  }
  function pulse(code) {
    if (!codes.has(code)) return;
    cancelRelease(code);
    const timer = after(() => {scheduled.delete(code); sync(code);}, HOLD_PULSE_MS);
    scheduled.set(code,timer);
    sync(code);
  }
  for (const button of buttons) {
    const code = button.dataset.code;
    button.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      if (pressedPointers.has(event.pointerId)) return;
      cancelRelease(code);
      pressedPointers.set(event.pointerId,{code,started:clock()});
      try {button.setPointerCapture(event.pointerId);} catch {/* capture optional */}
      sync(code);
    });
    button.addEventListener('pointerup', event => {event.preventDefault(); release(event.pointerId);});
    button.addEventListener('pointercancel', event => release(event.pointerId, true));
    button.addEventListener('lostpointercapture', event => release(event.pointerId,true));
    // Assistive-tech and keyboard activation emits click(detail=0) without pointerdown.
    button.addEventListener('click', event => {
      if (event.detail === 0) {event.preventDefault(); pulse(code);}
    });
    button.addEventListener('contextmenu', event => event.preventDefault());
  }
  host.addEventListener('blur', clear);
  host.addEventListener('pagehide', clear);
  host.addEventListener('orientationchange', clear);
  documentRoot.addEventListener('visibilitychange', () => {
    if (documentRoot.hidden) clear();
  });
  return {clear, isPressed: code => keys.has(code)};
}
