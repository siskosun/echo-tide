import test from 'node:test';
import assert from 'node:assert/strict';
import { AIR_BRIDGE, airborneChoice } from '../src/airborne_bridge.js';
import { PLAYER, createGame, update, airborneCandidates } from '../src/game.js';
import { draw } from '../src/render.js';

const dt = 1 / 60;
const tick = (g, input = {}) => update(g, input, dt);

function branchSeeds(level, nextId = 2) {
  const found = {};
  for (let seed = 0; seed < 100 && (!('near' in found) || !('far' in found)); seed += 1) {
    found[airborneChoice(seed, level, nextId)] ??= seed;
  }
  assert.ok(Number.isInteger(found.near) && Number.isInteger(found.far));
  return found;
}

function firstEchoLanding(level, seed) {
  let game = createGame({ level, seed, challenge: true });
  const dir = level === 1 ? { right: true } : { left: true };
  for (let i = 0; i < 85 && !game.route.revealed; i += 1) {
    game = tick(game, { ...dir, jump: i < 18 });
    assert.notEqual(game.status, 'lost');
  }
  assert.equal(game.route.revealed, true, 'the safe tutorial hop must not depend on challenge seed');
  assert.equal(game.player.supportId, 'echo-1');
  assert.equal(game.echoes[0].w, 210, 'first tutorial echo retains forgiving width');
  return game;
}

function secondHop(level, seed, adaptive) {
  let game = firstEchoLanding(level, seed);
  const dir = level === 1 ? { right: true } : { left: true };
  game = tick(game, {});
  game = tick(game, { ...dir, jump: true });
  assert.ok(game.pendingEcho, 'the advanced jump needs a pending air reveal');
  assert.equal(game.echoes.length, 1, 'no exact landing target should be leaked at takeoff');
  const announcedCandidates = Object.values(airborneCandidates({
    ...game, player: { ...game.player, grounded: true, supportId: 'echo-1' },
  }));
  assert.equal(announcedCandidates.length, 2);
  let firstRevealFrame = null;
  let landed = false;
  for (let i = 0; i < 75 && game.status === 'playing'; i += 1) {
    const target = game.echoes.find(e => e.id === 'echo-2');
    if (target && firstRevealFrame === null) firstRevealFrame = i + 1;
    let steering = dir;
    if (adaptive && target) {
      // React only to a *visible, generated* solid echo, never pending state.
      const center = game.player.x + PLAYER.w / 2;
      const aim = target.x + target.w / 2;
      steering = center > aim + 4 ? { left: true }
        : center < aim - 4 ? { right: true }
          : { left: center > aim, right: center <= aim };
    }
    game = tick(game, { ...steering, jump: i < 18 });
    if (game.player.supportId === 'echo-2') { landed = true; break; }
  }
  return { game, landed, firstRevealFrame };
}

test('seeded landings are repeatable without degenerating to one branch', () => {
  const choices = Array.from({ length: 40 }, (_, seed) => airborneChoice(seed, 0, 2));
  assert.ok(choices.includes('near'));
  assert.ok(choices.includes('far'));
  assert.equal(airborneChoice(21, 0, 2), airborneChoice(21, 0, 2));
  assert.throws(() => airborneChoice(-1, 0, 2));
  assert.throws(() => airborneChoice(0, 0, 0));
});

test('after a forgiving first hop, hard mode previews only two narrower locations', () => {
  const game = firstEchoLanding(0, 5);
  const options = airborneCandidates(game);
  assert.equal(options.near.w, AIR_BRIDGE.w);
  assert.equal(options.far.w, AIR_BRIDGE.w);
  assert.ok(Math.abs(options.far.x - options.near.x) > 80);
  assert.ok(options.near.w < game.echoes[0].w * 0.60);
});

test('airborne reveal waits for reaction cue and appears solid without rise', () => {
  let game = firstEchoLanding(0, 5);
  game = tick(game, {});
  game = tick(game, { left: true, jump: true });
  assert.ok(game.pendingEcho);
  assert.equal(game.echoes.length, 1);
  let delay = 0;
  for (; delay < 20 && game.pendingEcho; delay += 1) {
    game = tick(game, { left: true, jump: delay < 8 });
  }
  assert.ok(delay >= 8 && delay <= 12, 'reveal must occur about 160ms after launch');
  const bridge = game.echoes.find(e => e.id === 'echo-2');
  assert.equal(bridge?.phase, 'solid', 'the air-revealed bridge must skip redundant rise animation');
  assert.equal(bridge.w, AIR_BRIDGE.w);
});

test('both alternative landing spots can be caught by steering after the reveal', () => {
  for (const level of [0, 1, 2]) {
    for (const [side, seed] of Object.entries(branchSeeds(level))) {
      const attempt = secondHop(level, seed, true);
      assert.equal(attempt.landed, true,
        'room ' + (level + 1) + ' ' + side + ' did not land: ' + JSON.stringify({status: attempt.game.status, x: attempt.game.player.x, y: attempt.game.player.y, support: attempt.game.player.supportId, time: attempt.game.time, echo: attempt.game.echoes.find(e => e.id === 'echo-2'), revealFrame: attempt.firstRevealFrame}));
      assert.equal(attempt.game.echoes.find(e => e.id === 'echo-2')?.w, AIR_BRIDGE.w);
    }
  }
});

test('fixed direction input does not solve both second-hop possibilities', () => {
  const seeds = branchSeeds(0);
  const results = Object.entries(seeds).map(([side, seed]) => ({
    side, seed, ...secondHop(0, seed, false),
  }));
  assert.ok(results.some(result => result.landed), 'at least one fixed-input path must work');
  assert.ok(results.some(result => !result.landed),
    'a predictable held direction should no longer auto-catch both narrow choices');
  const missed = results.find(result => !result.landed);
  assert.equal(secondHop(0, missed.seed, true).landed, true,
    'the missed bridge must be catchable via a live steering response');
});

test('standard mode retains full-width instant solid bridges and no pending roll', () => {
  let game = createGame({ level: 0, seed: 7, challenge: false });
  game = tick(game, { left: true, jump: true });
  assert.equal(game.echoes[0].w, 210);
  assert.equal(game.echoes[0].phase, 'solid');
  assert.equal(game.pendingEcho, null);
  assert.equal(tick(game, { restart: true }).challengeEnabled, false);
  assert.equal(tick(createGame({ level: 0, challenge: true }), { restart: true }).challengeEnabled, true);
});

test('actual render announces candidate positions without flashing forming labels', () => {
  let game = firstEchoLanding(0, 7);
  const labels = [];
  const ctx = new Proxy({}, {
    get: (_, name) => name === 'createLinearGradient'
      ? () => ({ addColorStop() {} })
      : name === 'fillText' ? str => labels.push(String(str))
        : () => {},
    set: () => true,
  });
  draw(ctx, game);
  assert.ok(labels.some(x => x.includes('候选落点二选一')));
  assert.ok(labels.every(x => !x.includes('显形 forming')));
});