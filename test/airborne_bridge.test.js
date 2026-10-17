import test from 'node:test';
import assert from 'node:assert/strict';
import { airborneChoice, AIR_BRIDGE } from '../src/airborne_bridge.js';
import { createGame, update, PLAYER, ECHO, airborneForecast, solidRects } from '../src/game.js';
import { draw } from '../src/render.js';

const dt = 1 / 60;
const tick = (game, input = {}) => update(game, input, dt);

function firstLanding(seed = 3) {
  const game = createGame({level: 1, seed, challenge: true});
  for (let i = 0; i < 85 && !game.route.revealed; i++) {
    tick(game, {right: true, jump: i < 18});
    assert.notEqual(game.status, 'lost');
  }
  assert.equal(game.route.revealed, true);
  assert.equal(game.player.supportId, 'echo-1');
  for (let i = 0; i < 15; i++) tick(game);
  assert.equal(game.player.vx, 0);
  return game;
}

test('pre-takeoff selected target is deterministic and actually previewed', () => {
  for (const seed of [0, 1, 2, 3, 11, 37]) {
    const game = firstLanding(seed);
    const forecast = airborneForecast(game);
    assert.deepEqual(airborneForecast(game), forecast);
    assert.ok(['near', 'far'].includes(forecast.selected));
    assert.equal(forecast.target, forecast.options[forecast.selected]);
    assert.equal(game.pendingEcho, null);
    tick(game, {jump: true});
    assert.equal(game.pendingEcho, null, 'there must be no deferred midair reveal');
    assert.equal(game.airborneCue.selected, forecast.selected);
    assert.deepEqual(game.airborneCue.options, forecast.options);
    if (forecast.target.role === 'echo') {
      const target = game.echoes.find(e => e.id === game.flightBridgeId);
      assert.ok(target, 'real bridge must exist on takeoff');
      assert.equal(target.phase, 'solid');
      for (const axis of ['x', 'y', 'w', 'h']) {
        assert.equal(target[axis], forecast.target[axis]);
      }
    }
  }
});

test('seed variation remains, but each target is known before action', () => {
  const options = Array.from({length: 40}, (_, seed) => airborneChoice(seed, 1, 2));
  assert.ok(options.includes('near'));
  assert.ok(options.includes('far'));
  assert.ok(AIR_BRIDGE.w > PLAYER.w);
});

test('renderer marks exactly the previously committed target', () => {
  const game = firstLanding(11);
  const target = airborneForecast(game).target;
  const rects = [];
  const labels = [];
  const ctx = new Proxy({}, {
    get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} })
      : key === 'strokeRect' ? (...args) => rects.push(args)
      : key === 'fillText' ? str => labels.push(String(str)) : () => {},
    set: () => true,
  });
  draw(ctx, game);
  assert.ok(labels.some(s => s.includes('目标已确定')));
  assert.ok(rects.some(r => r[0] === target.x && r[1] === target.y && r[2] === target.w && r[3] === target.h));
  assert.ok(!labels.some(s => s.includes('起跳后定一个')));
});

test('idle vertical jump cannot store a missed platform for a second jump', () => {
  const game = firstLanding(3);
  const x = game.player.x;
  const old = game.player.supportId;
  tick(game, {jump: true});
  const newId = game.flightBridgeId;
  assert.ok(newId, 'test seed must choose echo');
  for (let i = 0; i < 90 && !game.player.grounded; i++) tick(game, {jump: i < 18});
  assert.equal(game.player.supportId, old);
  assert.equal(game.player.x, x);
  assert.ok(!solidRects(game).some(r => r.id === newId));
  tick(game);
  tick(game, {right: true, jump: true});
  assert.ok(!solidRects(game).some(r => r.id === newId));
});

test('return to old bridge grants at most one bounded recovery', () => {
  const game = firstLanding(3);
  const old = game.echoes[0];
  old.age = ECHO.solid - 0.03;
  for (let hop = 0; hop < 2; hop++) {
    tick(game, {jump: true});
    for (let i = 0; i < 90 && !game.player.grounded; i++) tick(game, {jump: i < 18});
    assert.equal(game.player.supportId, old.id);
    assert.equal(old.recoveryUsed, true);
    tick(game);
  }
  assert.ok(old.age > ECHO.solid - 1.8 + 0.01);
});
