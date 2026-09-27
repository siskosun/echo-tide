import { WORLD, createGame, update } from './game.js';
import { draw } from './render.js';

const canvas = document.getElementById('game');
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

const held = {
  left: () => keys.has('ArrowLeft') || keys.has('KeyA'),
  right: () => keys.has('ArrowRight') || keys.has('KeyD'),
  jump: () => keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW') || keys.has('KeyK'),
};

addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
});

addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

canvas.addEventListener('pointerdown', () => {
  canvas.focus();
  if (game.status !== 'playing') pointerRestart = true;
});

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const restartDown = keys.has('KeyR') || (game.status !== 'playing' && (keys.has('Enter') || pointerRestart));
  const restart = restartDown && !restartLatch;
  restartLatch = restartDown;
  pointerRestart = false;

  game = update(game, {
    left: held.left(),
    right: held.right(),
    jump: held.jump(),
    restart,
  }, dt);
  voice(game.events);
  draw(ctx, game);
  requestAnimationFrame(frame);
}

function voice(events) {
  for (const event of events) {
    if (event.type === 'jump') tone(240, 0.08, 'sine', 0.03);
    if (event.type === 'stamp') tone(360, 0.12, 'triangle', 0.035);
    if (event.type === 'solid') tone(540, 0.16, 'sine', 0.04);
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
