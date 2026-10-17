import test from 'node:test';
import assert from 'node:assert/strict';
import { TIDE, tideShiftAt, tideDirectionAt } from '../src/tide_variation.js';
import { ECHO, createGame, predictEcho, update } from '../src/game.js';

const dt = 1 / 60;
const step = (game, inputs = {}) => update(game, inputs, dt);

test('tide is deterministic and shifts the announced destination within limits', () => {
  for (let i = 0; i < 1200; i++) {
    const t = i / 120;
    const shift = tideShiftAt(t);
    assert.ok(shift >= TIDE.baseShift - TIDE.amplitude);
    assert.ok(shift <= TIDE.baseShift + TIDE.amplitude);
    assert.equal(shift, tideShiftAt(t));
    assert.equal(shift, tideShiftAt(t + 3 * TIDE.period));
  }
  assert.equal(tideDirectionAt(TIDE.period / 4), 'right');
  assert.equal(tideDirectionAt(TIDE.period * 3 / 4), 'left');
  const a = createGame({ level: 0 });
  const b = createGame({ level: 0 });
  a.time = TIDE.period / 4;
  b.time = TIDE.period * 3 / 4;
  assert.ok(predictEcho(a).x > predictEcho(b).x + 35);
});

test('launch creates an echo immediately and the forecast matches its actual destination', () => {
  let game = createGame({ level: 0 });
  const before = predictEcho(game);
  assert.equal(game.echoMode, 'flow');
  assert.equal(game.echoes.length, 0);
  game = step(game, { left: true, jump: true });
  assert.equal(game.stats.stamps, 1);
  assert.equal(game.echoes.length, 1);
  assert.equal(game.player.grounded, false);
  assert.equal(game.echoes[0].phase, 'rise');
  assert.ok(Math.abs(game.echoes[0].x - before.x) <= 2);
  assert.equal(game.echoes[0].y, before.y);
  for (let i = 0; i < 14; i++) game = step(game, { left: true, jump: true });
  assert.equal(game.stats.stamps, 1, 'holding the key must never spawn midair duplicates');
  assert.equal(game.echoes[0].phase, 'solid', 'bridge must be solid before descending from a normal hop');
});

test('one actual leftward jump can land on the pre-created bridge', () => {
  let game = createGame({ level: 0 });
  game = step(game, { left: true, jump: true });
  let reached = false;
  for (let i = 0; i < 65 && game.status === 'playing'; i++) {
    game = step(game, { left: true, jump: i < 9 });
    if (String(game.player.supportId).startsWith('echo')) { reached = true; break; }
  }
  assert.equal(reached, true, 'a normal hold-left jump must be able to use the forecast bridge');
  assert.ok(game.stats.echoLandings >= 1);
  const prior = game.stats.stamps;
  game = step(game, { left: true, jump: false });
  game = step(game, { left: true, jump: true });
  assert.equal(game.stats.stamps, prior + 1, 'next true jump can continue the bridge chain');
});

test('airborne button spamming cannot create extra platforms', () => {
  let game = createGame({ level: 0 });
  game = step(game, { left: true, jump: true });
  let original = game.stats.stamps;
  for (let i = 0; i < 21; i++) {
    game = step(game, { left: true, jump: i % 2 === 0 });
    assert.equal(game.stats.stamps, original);
  }
});

test('classic practice mode preserves the original after-landing stamp timing', () => {
  let game = createGame({ level: 'classic' });
  assert.equal(game.echoMode, 'legacy');
  game = step(game, { jump: true });
  assert.equal(game.stats.stamps, 0);
  for (let i = 0; i < 80 && game.stats.stamps === 0; i++) {
    game = step(game, { jump: i < 10 });
  }
  assert.equal(game.stats.stamps, 1);
});

test('jump-disabled and restart paths remain bounded and deterministic', () => {
  let a = createGame({ level: 0, echoes: false });
  for (let i = 0; i < 18; i++) a = step(a, { jump: i === 0, left: true });
  assert.equal(a.echoes.length, 0);
  assert.equal(a.stats.stamps, 0);
  const b = step(a, { restart: true });
  assert.equal(b.echoes.length, 0);
  assert.equal(b.time, 0);
  assert.equal(b.echoMode, 'flow');
  assert.ok(ECHO.maxAlive > 0);
});
