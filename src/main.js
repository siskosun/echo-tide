import { WORLD, LEVELS, createGame, update } from './game.js';
import { draw } from './render.js';

const canvas = document.getElementById('game');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = Math.round(WORLD.w * dpr);
canvas.height = Math.round(WORLD.h * dpr);
const ctx = canvas.getContext('2d');
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

function newRouteSeed() {
  const entropy = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(entropy);
  else entropy[0] = Math.floor(Math.random() * 0x100000000);
  return entropy[0];
}

const keys = new Set();
let game = createGame({ seed: newRouteSeed(), challenge: true, surf: true });
let last = performance.now();
let restartLatch = false;
let pointerRestart = false;
let audio;
let nextLatch = false;
let accumulator = 0;
const roomSelect = document.getElementById('room');
const difficultySelect = document.getElementById('difficulty');
const styleSelect = document.getElementById('style');
const nextButton = document.getElementById('next');
const status = document.getElementById('status');
const hint = document.getElementById('hint');
let uiKey = '';
let pointerNext = false;
let buttonRestart = false;
function restartForMode({ keepSeed = false } = {}) {
  game = createGame({
    level: Number(roomSelect.value),
    // Same room/seed when comparing the surf and original controls.
    seed: keepSeed ? game.seed : newRouteSeed(),
    challenge: difficultySelect.value === 'hard',
    surf: styleSelect.value === 'surf',
  });
  uiKey = '';
  keys.clear();
  canvas.focus();
}
roomSelect.addEventListener('change', () => restartForMode());
difficultySelect.addEventListener('change', () => restartForMode());
styleSelect.addEventListener('change', () => restartForMode({ keepSeed: true }));
document.getElementById('restart').addEventListener('click', () => { buttonRestart = true; canvas.focus(); });
nextButton.addEventListener('click', () => { pointerNext = true; canvas.focus(); });

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
  const input = {
    left: held.left(),
    right: held.right(),
    jump: held.jump(),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyJ'),
    restart,
    next,
    anchor: keys.has('KeyE'),
  };
  // Fixed simulation steps keep echo timing/collision consistent at any refresh rate.
  accumulator += dt;
  const events = [];
  if (restart || next) {
    const before = game;
    game = update(game, input, 0);
    if (game !== before) game.seed = newRouteSeed();
  }
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
  const key = `${game.levelIndex}:${game.challengeEnabled}:${game.surfEnabled}:${game.status}:${game.objectiveCollected}:${game.route?.side ?? 'unknown'}`;
  if (uiKey === key) return;
  uiKey = key;
  roomSelect.value = String(game.levelIndex);
  styleSelect.value = game.surfEnabled ? 'surf' : 'classic';
  const surfHint = game.surfEnabled
    ? ' · Shift/J：每跳可冲刺一次，任何安全落地后恢复；亮心用于连击' : '';
  hint.textContent = (game.route?.revealed
    ? `${game.level.hint} · 本局潮印：${game.route.side === 'left' ? '左岸' : '右岸'}`
    : game.level.hint) + surfHint;
  nextButton.hidden = game.status !== 'won' || game.levelIndex === LEVELS.length - 1;
  status.textContent = game.status === 'lost' ? '坠落或超时，按 R 重试本关。' : game.status === 'won'
    ? (game.levelIndex === LEVELS.length - 1 ? '三关完成！可以从关卡菜单再次挑战。' : '本关完成！按 Enter 进入下一关。')
    : `${game.level.title} · ${game.objectiveCollected ? '前往出口'
      : game.route && !game.route.revealed ? '先落到第一块回声，揭晓本局潮印'
      : `先取得${game.level.objective?.name ?? '潮印'}`}`;
}

function voice(events) {
  for (const event of events) {
    if (event.type === 'jump') tone(240, 0.08, 'sine', 0.03);
    if (event.type === 'dash') tone(470, 0.11, 'sawtooth', 0.025);
    if (event.type === 'precision') tone(860, 0.12, 'sine', 0.035);
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
