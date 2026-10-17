import test from 'node:test';
import assert from 'node:assert/strict';
import { airborneChoice, AIR_BRIDGE } from '../src/airborne_bridge.js';
import { createGame, update, PLAYER, ECHO, airborneForecast, canPlaceFlowEcho, solidRects } from '../src/game.js';
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

/** Reproduce the reported world-edge staircase with ordinary repeated key presses. */
function edgeFixture({ challenge, side = 'right' }) {
  const game = createGame({ level: side === 'right' ? 1 : 0, seed: 7, challenge });
  const w = challenge ? AIR_BRIDGE.w : ECHO.w;
  const x = side === 'right' ? 960 - w - 18 : 18;
  const playerX = side === 'right' ? 960 - PLAYER.w - 10 : 10;
  game.echoes = [{
    id: 'echo-1', x, y: 402, w, h: ECHO.h, phase: 'solid', age: 0,
  }];
  game.nextId = 2;
  game.route = { revealed: true, side: 'right' };
  game.player = {
    x: playerX, y: 402 - PLAYER.h, vx: 0, vy: 0,
    grounded: true, supportId: 'echo-1', facing: side === 'right' ? 1 : -1,
  };
  return game;
}

for (const challenge of [true, false]) {
  for (const side of ['right', 'left']) {
    test(`wall staircase is blocked after repeated real jumps: ${challenge ? 'challenge' : 'standard'} ${side}`, () => {
      const game = edgeFixture({ challenge, side });
      const top = game.echoes[0].y;
      const echoCount = game.echoes.length;
      if (challenge) {
        const forecast = airborneForecast(game);
        assert.equal(forecast.blocked, true, 'ground preview must disclose invalid placement');
        assert.equal(forecast.target, null);
      }
      for (let hop = 0; hop < 4; hop += 1) {
        tick(game, { right: side === 'right', left: side === 'left', jump: true });
        assert.ok(game.events.some(event => event.type === 'bridge_blocked'));
        assert.equal(game.echoes.length, echoCount, 'jump cannot mint a vertically stacked echo');
        let landed = false;
        for (let frame = 0; frame < 85 && game.status === 'playing'; frame += 1) {
          tick(game, { right: side === 'right', left: side === 'left', jump: frame < 17 });
          if (game.player.grounded) { landed = true; break; }
        }
        assert.equal(landed, true, 'a blocked jump must safely land on the earned bridge');
        assert.equal(game.player.supportId, 'echo-1');
        assert.equal(game.echoes[0].y, top, 'no climb despite repeated boundary jumps');
        assert.equal(game.echoes.length, echoCount);
        tick(game, {});
      }
      assert.equal(game.stats.stamps, 0);
      assert.equal(game.status, 'playing');
    });
  }
}

test('narrow echo cannot stack vertically over a nearly coincident older echo', () => {
  const game = edgeFixture({ challenge: true });
  game.player.x = 500;
  game.player.facing = 1;
  game.player.y = 402 - PLAYER.h;
  game.echoes[0].x = 500;
  assert.equal(canPlaceFlowEcho(game,
    { x: 530, y: 326, w: 80, h: 14, role: 'echo' }), false,
  'strong horizontal overlap must not mint a stair even off the world edge');
  assert.equal(canPlaceFlowEcho(game,
    { x: 568, y: 326, w: 80, h: 14, role: 'echo' }), true,
  'lightly overlapping stepping stones must remain possible');
});

test('when the seeded target would stack, fallback is decided before takeoff', () => {
  const game = createGame({ level: 1, challenge: true });
  game.platforms.push({ id: 'test-dock', x: 580, y: 478, w: 90, h: 16, role: 'stone' });
  Object.assign(game.player, {
    x: 600, y: 478 - PLAYER.h, vx: 0, vy: 0,
    facing: 1, grounded: true, supportId: 'test-dock',
  });
  game.echoes = [{ id: 'echo-1', x: 646, y: 402, w: 80, h: 14,
    phase: 'solid', age: 0 }];
  game.nextId = 2;
  game.route.revealed = true;
  let seed = null;
  for (let trial = 0; trial < 100; trial += 1) {
    if (airborneChoice(trial, 1, 2) === 'near') { seed = trial; break; }
  }
  assert.notEqual(seed, null);
  game.seed = seed;
  const choice = airborneForecast(game);
  assert.equal(choice.blocked, false);
  assert.equal(choice.selected, 'far');
  assert.equal(choice.target, choice.options.far);
  assert.equal(canPlaceFlowEcho(game, choice.target), true);
  tick(game, { jump: true });
  assert.equal(game.airborneCue.selected, 'far');
  assert.ok(game.flightBridgeId);
  const spawned = game.echoes.find(e => e.id === game.flightBridgeId);
  assert.equal(spawned.x, choice.target.x);
  assert.equal(spawned.y, choice.target.y);
});

test('blocked jump is visibly explained without ghost landing outlines', () => {
  const game = edgeFixture({ challenge: true });
  const labels = [];
  const ctx = new Proxy({}, {
    get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} })
      : key === 'fillText' ? str => labels.push(String(str)) : () => {},
    set: () => true,
  });
  draw(ctx, game);
  assert.ok(labels.some(t => t.includes('不能叠桥')));
  assert.ok(!labels.some(t => t.includes('目标已确定')));
});
