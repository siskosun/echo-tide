import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRoute, ROUTE_FORKS } from '../src/route_fork.js';
import { ECHO, PLAYER, createGame, predictEcho, update } from '../src/game.js';
import { draw } from '../src/render.js';

const dt = 1 / 60;
const tick = (g, input = {}) => update(g, input, dt);

function launchAndReveal(level, seed = 0) {
  let game = createGame({ level, seed });
  assert.equal(game.route.revealed, false);
  assert.equal(game.level.objective, null, 'route cannot be read from rendered objective at spawn');
  const dir = level === 1 ? { right: true } : { left: true };
  let frame = 0;
  for (; frame < 80 && !game.route.revealed; frame += 1) {
    game = tick(game, { ...dir, jump: frame < 18 });
    assert.notEqual(game.status, 'lost', 'first jump must not be made deadly by route choice');
  }
  assert.ok(game.route.revealed, 'room ' + (level + 1) + ' should reveal after real echo landing');
  assert.ok(String(game.player.supportId).startsWith('echo'), 'reveal requires a real echo landing');
  return { game, frame };
}

test('every room has two different safe replayable mid-run objectives', () => {
  const supports = [
    [[180, 390, 326], [620, 900, 174]],
    [[30, 360, 478], [740, 930, 250]],
    [[40, 240, 250], [760, 930, 326]],
  ];
  for (let level = 0; level < 3; level += 1) {
    const a = chooseRoute(0, level), b = chooseRoute(1, level);
    assert.notEqual(a.side, b.side);
    assert.ok(Math.abs(a.objective.x - b.objective.x) >= 400,
      'actual route decision must be more than a few pixels of drift');
    assert.deepEqual(a, chooseRoute(0, level));
    assert.deepEqual(b, chooseRoute(1, level));
    for (const objective of [a.objective, b.objective]) {
      assert.ok(supports[level].some(([lo, hi, top]) =>
        objective.x >= lo && objective.x + objective.w <= hi && objective.y + objective.h === top),
      'room ' + (level + 1) + ' objective must be on a real safe ledge');
    }
  }
});

test('different seeds reveal distinct goals only after identical real jump histories', () => {
  for (let level = 0; level < 3; level += 1) {
    const a = launchAndReveal(level, 0);
    const b = launchAndReveal(level, 1);
    assert.equal(a.frame, b.frame, 'branch must not alter the first-jump physics');
    assert.equal(a.game.stats.echoLandings, 1);
    assert.equal(b.game.stats.echoLandings, 1);
    assert.notEqual(a.game.route.side, b.game.route.side);
    assert.ok(Math.abs(a.game.level.objective.x - b.game.level.objective.x) >= 400);
    assert.equal(a.game.objectiveCollected, false);
    assert.equal(b.game.objectiveCollected, false);
    assert.ok(a.game.events.some(e => e.type === 'route_reveal'));
  }
});

test('a fixed target-specific action cannot collect both branches (unit gate fixture)', () => {
  const left = launchAndReveal(0, 0).game;
  const right = launchAndReveal(0, 1).game;
  const target = chooseRoute(0, 0).objective;
  // Fixture isolates objective gate; full winning-route tests are input-only.
  for (const g of [left, right]) {
    Object.assign(g.player, {
      x: target.x, y: target.y, grounded: false, supportId: null, vy: 0, vx: 0,
    });
    tick(g);
  }
  assert.equal(left.objectiveCollected, true);
  assert.equal(right.objectiveCollected, false);
  assert.equal(right.status, 'playing');
});

test('previewed flow bridge is solid immediately, never animates through rise', () => {
  let game = createGame({ level: 0 });
  const forecast = predictEcho(game);
  game = tick(game, { left: true, jump: true });
  assert.equal(game.stats.stamps, 1);
  assert.equal(game.echoes.length, 1);
  assert.equal(game.echoes[0].phase, 'solid');
  assert.deepEqual(
    { x: game.echoes[0].x, y: game.echoes[0].y },
    { x: forecast.x, y: forecast.y },
  );
  for (let i = 0; i < 15; i += 1) game = tick(game, { left: true, jump: true });
  assert.equal(game.stats.stamps, 1);
  assert.equal(game.echoes[0].phase, 'solid');
});

test('rendering a flow echo never uses an animated forming label', () => {
  const labels = [];
  const fakeCtx = new Proxy({}, {
    get: (_, name) => name === 'createLinearGradient'
      ? () => ({ addColorStop() {} })
      : name === 'fillText'
        ? text => labels.push(String(text))
        : () => {},
    set: () => true,
  });
  let game = createGame({ level: 0 });
  draw(fakeCtx, game);
  assert.ok(labels.includes('起跳立即成桥'));
  game = tick(game, { left: true, jump: true });
  draw(fakeCtx, game);
  assert.equal(labels.some(label => label.includes('显形 forming')), false);
  assert.equal(game.echoes[0].phase, 'solid');
});

test('an input-only leftward jump can use its solid echo and keep jumping', () => {
  let game = createGame({ level: 0 });
  game = tick(game, { left: true, jump: true });
  let landed = false;
  for (let i = 0; i < 65 && game.status === 'playing'; i += 1) {
    game = tick(game, { left: true, jump: i < 9 });
    if (String(game.player.supportId).startsWith('echo')) { landed = true; break; }
  }
  assert.equal(landed, true);
  assert.ok(game.stats.echoLandings >= 1);
  assert.equal(game.route.revealed, true);
  const count = game.stats.stamps;
  game = tick(game, { left: true, jump: false });
  game = tick(game, { left: true, jump: true });
  assert.equal(game.stats.stamps, count + 1);
});

test('airborne repeated button presses cannot generate extra bridges', () => {
  let game = tick(createGame({ level: 0 }), { left: true, jump: true });
  for (let i = 0; i < 21; i += 1) {
    game = tick(game, { left: true, jump: i % 2 === 0 });
    assert.equal(game.stats.stamps, 1);
  }
});

test('classic practice route still stamps on landing then rises', () => {
  let game = tick(createGame({ level: 'classic' }), { jump: true });
  assert.equal(game.route, null);
  assert.equal(game.stats.stamps, 0);
  for (let i = 0; i < 80 && game.stats.stamps === 0; i += 1) game = tick(game, { jump: i < 10 });
  assert.equal(game.stats.stamps, 1);
  assert.equal(game.echoes[0].phase, 'rise');
});

test('restart resets hidden stage and preserves headless replay seed', () => {
  const first = launchAndReveal(2, 1).game;
  const expected = first.route.side;
  const restart = tick(first, { restart: true });
  assert.equal(restart.seed, 1);
  assert.equal(restart.route.revealed, false);
  assert.equal(restart.objectiveCollected, false);
  assert.equal(restart.level.objective, null);
  assert.equal(launchAndReveal(2, 1).game.route.side, expected);
  assert.equal(tick(createGame({ level: 0, echoes: false }), { jump: true }).echoes.length, 0);
});

test('invalid branch seeds and levels fail closed', () => {
  for (const seed of [-1, 2 ** 32, NaN, 1.2]) assert.throws(() => createGame({ seed }));
  assert.throws(() => chooseRoute(2, -1));
  const obj = chooseRoute(0, 0);
  obj.objective.x = -7;
  assert.equal(chooseRoute(0, 0).objective.x, 300);
});