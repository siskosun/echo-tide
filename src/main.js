import { WORLD, LEVELS, createGame, update } from './game.js';
import { draw } from './render.js';
import { attachTouchControls } from './touch_controls.js';

const canvas = document.getElementById('game');
const touch = attachTouchControls({
  buttons: {
    left: document.getElementById('touch-left'),
    right: document.getElementById('touch-right'),
    jump: document.getElementById('touch-jump'),
    anchor: document.getElementById('touch-anchor'),
  },
  windowTarget: window,
  documentTarget: document,
  onPress: () => canvas.focus({ preventScroll: true }),
});
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = Math.round(WORLD.w * dpr);
canvas.height = Math.round(WORLD.h * dpr);
const ctx = canvas.getContext('2d');
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

const keys = new Set();
let game = createGame();
let last = performance.now();
let restartLatch = false;
let pointerRestart = false;
let audio;
let nextLatch = false;
let accumulator = 0;
const roomSelect = document.getElementById('room');
const nextButton = document.getElementById('next');
const status = document.getElementById('status');
const hint = document.getElementById('hint');
let uiKey = '';
let pointerNext = false;
let buttonRestart = false;
roomSelect.addEventListener('change', () => {
  game = createGame({ level: Number(roomSelect.value) });
  keys.clear();
  touch.reset();
  canvas.focus();
});
document.getElementById('restart').addEventListener('click', () => { touch.reset(); buttonRestart = true; canvas.focus(); });
nextButton.addEventListener('click', () => { touch.reset(); pointerNext = true; canvas.focus(); });

const held = {
  left: () => keys.has('ArrowLeft') || keys.has('KeyA'),
  right: () => keys.has('ArrowRight') || keys.has('KeyD'),
  jump: () => keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW') || keys.has('KeyK'),
};

addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
  keys.add(event.code);
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
});

addEventListener('keyup', (event) => {
  keys.delete(event.code);
});
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => {
  keys.clear();
  accumulator = 0;
  last = performance.now();
});

canvas.addEventListener('pointerdown', () => {
  canvas.focus();
  if (game.status === 'lost') pointerRestart = true;
});

function frame(now) {
  const dt = document.hidden ? 0 : Math.min(0.083, (now - last) / 1000);
  last = now;
  const restartDown = keys.has('KeyR') || buttonRestart || (game.status === 'lost' && (keys.has('Enter') || pointerRestart));
  const restart = restartDown && !restartLatch;
  restartLatch = restartDown;
  pointerRestart = false;
  buttonRestart = false;
  const nextDown = keys.has('Enter') || pointerNext;
  const next = nextDown && !nextLatch;
  nextLatch = nextDown;
  pointerNext = false;
  const touchInput = touch.read();
  const input = {
    left: held.left() || touchInput.left,
    right: held.right() || touchInput.right,
    jump: held.jump() || touchInput.jump,
    restart,
    next,
    anchor: keys.has('KeyE') || touchInput.anchor,
  };
  // Fixed simulation steps keep echo timing/collision consistent at any refresh rate.
  accumulator += dt;
  const events = [];
  if (restart || next) game = update(game, input, 0);
  input.restart = false;
  input.next = false;
  while (accumulator >= 1 / 60) {
    game = update(game, input, 1 / 60);
    events.push(...game.events);
    accumulator -= 1 / 60;
  }
  game.events = events;
  voice(events);
  draw(ctx, game);
  syncUi();
  requestAnimationFrame(frame);
}

function syncUi() {
  const key = `${game.levelIndex}:${game.status}:${game.objectiveCollected}`;
  if (uiKey === key) return;
  uiKey = key;
  roomSelect.value = String(game.levelIndex);
  hint.textContent = game.level.hint;
  nextButton.hidden = game.status !== 'won' || game.levelIndex === LEVELS.length - 1;
  document.getElementById('touch-anchor').hidden = !game.level.anchor;
  status.textContent = game.status === 'lost' ? '坠落或超时，按 R 重试本关。' : game.status === 'won'
    ? (game.levelIndex === LEVELS.length - 1 ? '三关完成！可以从关卡菜单再次挑战。' : '本关完成！按 Enter 进入下一关。')
    : `${game.level.title} · ${game.objectiveCollected ? '前往出口' : `先取得${game.level.objective.name}`}`;
}

function voice(events) {
  for (const event of events) {
    if (event.type === 'jump') tone(240, 0.08, 'sine', 0.03);
    if (event.type === 'stamp') tone(360, 0.12, 'triangle', 0.035);
    if (event.type === 'solid') tone(540, 0.16, 'sine', 0.04);
    if (event.type === 'anchor') tone(430, 0.18, 'triangle', 0.04);
    if (event.type === 'collect') tone(780, 0.22, 'sine', 0.04);
    if (event.type === 'win') {
      tone(660, 0.14, 'sine', 0.05);
      setTimeout(() => tone(880, 0.2, 'sine', 0.05), 120);
    }
    if (event.type === 'lose') tone(120, 0.28, 'triangle', 0.05);
  }
}

function tone(freq, dur, type, gainValue) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audio = audio || new AudioCtx();
    if (audio.state === 'suspended') audio.resume();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + dur);
  } catch {
    audio = null;
  }
}

requestAnimationFrame(frame);
