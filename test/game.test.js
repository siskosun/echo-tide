import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ECHO,
  PLAYER,
  PLATFORMS,
  createGame,
  maxJumpHeight,
  update,
} from '../src/game.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dt = 1 / 60;

function hop(game) {
  let next = update(game, { jump: true }, dt);
  for (let i = 0; i < 20; i += 1) next = update(next, { jump: true }, dt);
  let guard = 0;
  while (!next.player.grounded && guard < 240) {
    next = update(next, {}, dt);
    guard += 1;
  }
  return next;
}

test('standing on the start dock does not fall', () => {
  let game = createGame();
  const y = game.player.y;
  for (let i = 0; i < 180; i += 1) game = update(game, {}, dt);
  assert.equal(game.status, 'playing');
  assert.equal(game.player.supportId, 'start');
  assert.ok(Math.abs(game.player.y - y) < 0.01);
  assert.equal(game.echoes.length, 0);
});

test('a landing stamps an echo that rises, solidifies, then sinks away', () => {
  let game = hop(createGame());
  assert.equal(game.stats.stamps, 1);
  assert.equal(game.echoes.length, 1);
  const echoId = game.echoes[0].id;
  const echo = () => game.echoes.find((item) => item.id === echoId);
  assert.equal(echo().phase, 'rise');

  const riseRect = echo();
  game.player.x = riseRect.x + 20;
  game.player.y = riseRect.y - PLAYER.h - 40;
  game.player.vy = 40;
  game.player.grounded = false;
  game.player.supportId = null;
  for (let i = 0; i < 30; i += 1) game = update(game, {}, dt);
  assert.equal(echo().phase, 'rise');
  assert.ok(game.player.y + PLAYER.h > riseRect.y + riseRect.h, 'rise phase is not solid');

  let guard = 0;
  while (echo()?.phase === 'rise' && guard < 180) {
    game = update(game, {}, dt);
    guard += 1;
  }
  assert.equal(echo().phase, 'solid');

  const solid = echo();
  game.player.x = solid.x + 24;
  game.player.y = solid.y - PLAYER.h - 50;
  game.player.vy = 0;
  game.player.grounded = false;
  let landed = false;
  for (let i = 0; i < 90; i += 1) {
    game = update(game, {}, dt);
    if (game.player.supportId === echoId) {
      landed = true;
      break;
    }
  }
  assert.equal(landed, true);

  const start = game.platforms.find((platform) => platform.id === 'start');
  game.player.x = start.x + 20;
  game.player.y = start.y - PLAYER.h;
  game.player.vy = 0;
  game.player.grounded = true;
  game.player.supportId = 'start';

  guard = 0;
  while (echo() && guard < 600) {
    game = update(game, {}, dt);
    guard += 1;
  }
  assert.equal(echo(), undefined);
  assert.ok(ECHO.rise > 0 && ECHO.solid > 0 && ECHO.sink > 0);
});

test('falling into the tide and running out the clock can both restart', () => {
  let game = createGame();
  game.player.y = 560;
  game.player.grounded = false;
  game.player.supportId = null;
  game = update(game, {}, dt);
  assert.equal(game.status, 'lost');
  assert.equal(game.reason, 'fall');
  game = update(game, { restart: true }, dt);
  assert.equal(game.status, 'playing');
  assert.equal(game.player.supportId, 'start');

  game.timeLeft = 0.01;
  game = update(game, {}, dt);
  assert.equal(game.status, 'lost');
  assert.equal(game.reason, 'timeout');
});

test('static platforms cannot reach the exit', () => {
  const goal = PLATFORMS.find((platform) => platform.id === 'goal');
  const jump = maxJumpHeight();
  for (const platform of PLATFORMS) {
    if (platform.role === 'goal') continue;
    assert.ok(platform.y - goal.y > jump + 30, `${platform.id} is within a static jump of the goal`);
  }

  let wins = 0;
  for (const platform of PLATFORMS.filter((item) => item.id !== 'goal')) {
    for (const offset of [8, platform.w * 0.45, platform.w - PLAYER.w - 6]) {
      for (const windup of [0, 0.15, 0.35]) {
        for (const dir of [-1, 1]) {
          let game = createGame({ echoes: false });
          game.player.x = clamp(platform.x + offset, 10, 960 - PLAYER.w - 10);
          game.player.y = platform.y - PLAYER.h;
          game.player.grounded = true;
          game.player.supportId = platform.id;
          game.player.facing = dir;
          for (let i = 0; i < 200; i += 1) {
            const t = i * dt;
            game = update(game, {
              left: dir < 0,
              right: dir > 0,
              jump: t >= windup && t < windup + 0.48,
            }, dt);
            if (game.status === 'won') wins += 1;
          }
        }
      }
    }
  }
  assert.equal(wins, 0);
});

test('releasing run just as you jump still carries onto the middle stone', () => {
  const start = PLATFORMS.find((platform) => platform.id === 'start');
  let phase = 'run';
  let hold = 0;
  let game = createGame();
  let reached = false;
  for (let i = 0; i < 300 && game.status === 'playing'; i += 1) {
    hold = Math.max(0, hold - dt);
    const player = game.player;
    const input = { left: false, right: false, jump: false };
    if (phase === 'run') {
      input.right = true;
      if (player.grounded && player.x + PLAYER.w > start.x + start.w - 70) {
        phase = 'jump';
        hold = 0.12;
      }
    }
    if (hold > 0) input.jump = true;
    game = update(game, input, dt);
    if (game.player.supportId === 'mid') reached = true;
  }
  assert.equal(reached, true);
});

test('a short hop near the end of the dock still reaches the middle stone', () => {
  const start = PLATFORMS.find((platform) => platform.id === 'start');
  for (const back of [40, 80, 120]) {
    let fired = false;
    let hold = 0;
    let game = createGame();
    let reached = false;
    for (let i = 0; i < 240 && game.status === 'playing'; i += 1) {
      hold = Math.max(0, hold - dt);
      const player = game.player;
      if (!fired && player.grounded && player.supportId === 'start' && player.x + PLAYER.w > start.x + start.w - back) {
        fired = true;
        hold = 0.1;
      }
      game = update(game, { right: true, jump: hold > 0 }, dt);
      if (game.player.supportId === 'mid') reached = true;
    }
    assert.equal(reached, true, `back ${back} missed the middle stone`);
  }
});

test('an easy route reaches the exit by landing on an echo', () => {
  const start = PLATFORMS.find((platform) => platform.id === 'start');
  const mid = PLATFORMS.find((platform) => platform.id === 'mid');
  const goal = PLATFORMS.find((platform) => platform.id === 'goal');
  let phase = 'run';
  let hold = 0;
  let game = createGame();

  for (let i = 0; i < 60 * 16 && game.status === 'playing'; i += 1) {
    hold = Math.max(0, hold - dt);
    const player = game.player;
    const input = { left: false, right: false, jump: false };
    const wantJump = () => { hold = 0.5; };
    const bridge = game.echoes.find((echo) => echo.phase === 'solid' && echo.y < mid.y - 40 && echo.y > goal.y);

    if (phase === 'run') {
      input.right = true;
      if (player.grounded && player.supportId === 'start' && player.x + PLAYER.w > start.x + start.w - 52) wantJump();
      if (player.supportId === 'mid') phase = 'wait';
    } else if (phase === 'wait') {
      if (bridge) phase = 'mount';
    } else if (phase === 'mount' && bridge) {
      const center = player.x + PLAYER.w / 2;
      input.right = center < bridge.x + 56;
      input.left = center > bridge.x + bridge.w - 40;
      if (player.grounded && player.supportId === 'mid' && center > bridge.x + 8 && center < bridge.x + bridge.w - 8) {
        wantJump();
      }
      if (String(player.supportId || '').startsWith('echo')) phase = 'goal';
    } else if (phase === 'goal') {
      input.right = true;
      const echo = game.echoes.find((item) => item.id === player.supportId);
      if (player.grounded && echo && player.x + PLAYER.w > echo.x + echo.w - 60) wantJump();
      if (player.supportId === 'goal') phase = 'exit';
    } else if (phase === 'exit') {
      input.right = player.x < game.exit.x + 4;
    }
    if (hold > 0) input.jump = true;
    game = update(game, input, dt);
  }

  assert.equal(game.status, 'won', `phase=${phase} support=${game.player.supportId} x=${game.player.x}`);
  assert.ok(game.stats.echoLandings >= 1);
  assert.ok(game.stats.stamps >= 1);
});

test('readme explains controls, the echo, and the hypothesis', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.match(readme, /空格|Space/);
  assert.match(readme, /回声/);
  assert.match(readme, /echo/i);
  assert.match(readme, /假设|hypothesis/i);
  assert.match(readme, /npm run dev/);
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
