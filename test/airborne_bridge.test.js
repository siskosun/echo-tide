import test from 'node:test';
import assert from 'node:assert/strict';
import { AIR_BRIDGE, airborneChoice } from '../src/airborne_bridge.js';
import { PLAYER, createGame, update, airborneCandidates, overlaps, hasReachableStone } from '../src/game.js';
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
  const game = firstEchoLanding(1, 5);
  const options = airborneCandidates(game);
  assert.equal(options.near.w, AIR_BRIDGE.w);
  assert.equal(options.far.w, AIR_BRIDGE.w);
  assert.ok(Math.abs(options.far.x - options.near.x) > 80);
  assert.ok(options.near.w < game.echoes[0].w * 0.60);
  for (const candidate of [options.near, options.far]) {
    assert.equal(game.platforms.some(platform => overlaps(candidate, platform)), false,
      'a hidden static ledge cannot auto-catch the nominal challenge platform');
  }
});

test('airborne reveal waits for reaction cue and appears solid without rise', () => {
  let game = firstEchoLanding(1, 5);
  game = tick(game, {});
  game = tick(game, { right: true, jump: true });
  assert.ok(game.pendingEcho);
  assert.equal(game.echoes.length, 1);
  let delay = 0;
  for (; delay < 20 && game.pendingEcho; delay += 1) {
    game = tick(game, { right: true, jump: delay < 18 });
  }
  assert.ok(delay >= 8 && delay <= 12, 'reveal must occur about 160ms after launch');
  const bridge = game.echoes.find(e => e.id === 'echo-2');
  assert.equal(bridge?.phase, 'solid', 'the air-revealed bridge must skip redundant rise animation');
  assert.equal(bridge.w, AIR_BRIDGE.w);
});

test('both alternative landing spots can be caught by steering after the reveal', () => {
  for (const level of [1, 2]) {
    for (const [side, seed] of Object.entries(branchSeeds(level))) {
      const attempt = secondHop(level, seed, true);
      assert.equal(attempt.landed, true,
        'room ' + (level + 1) + ' ' + side + ' did not land: ' + JSON.stringify({status: attempt.game.status, x: attempt.game.player.x, y: attempt.game.player.y, support: attempt.game.player.supportId, time: attempt.game.time, echo: attempt.game.echoes.find(e => e.id === 'echo-2'), revealFrame: attempt.firstRevealFrame}));
      assert.equal(attempt.game.echoes.find(e => e.id === 'echo-2')?.w, AIR_BRIDGE.w);
    }
  }
});

test('fixed direction input does not solve both second-hop possibilities', () => {
  const seeds = branchSeeds(1);
  const results = Object.entries(seeds).map(([side, seed]) => ({
    side, seed, ...secondHop(1, seed, false),
  }));
  assert.ok(results.some(result => !result.landed),
    'a predictable held direction should no longer auto-catch both narrow choices');
  const missed = results.find(result => !result.landed);
  assert.equal(secondHop(1, missed.seed, true).landed, true,
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

test('existing stone is one visible choice, without the previous disappearing two-box preview', () => {
  const seed = branchSeeds(0).far;
  let game = firstEchoLanding(0, seed);
  assert.equal(hasReachableStone(game), true);
  const candidates = airborneCandidates(game);
  assert.equal(candidates.near.role, 'echo');
  assert.equal(candidates.far.role, 'stone');
  assert.equal(candidates.far.id, 'relay');
  assert.ok(game.platforms.every(p => !overlaps(candidates.near, p)),
    'the echo option must not paint a second bridge over a stone');
  const count = game.stats.stamps;
  game = tick(game, {});
  game = tick(game, { left: true, jump: true });
  assert.ok(game.pendingEcho, 'the choice remains visible even when rock can be reached');
  assert.equal(game.airborneCue.phase, 'pending');
  assert.deepEqual(game.airborneCue.options, candidates);
  for (let i = 0; i < 12 && game.pendingEcho; i += 1) {
    game = tick(game, { left: true, jump: true });
  }
  assert.equal(game.pendingEcho, null);
  assert.equal(game.airborneCue.phase, 'revealed');
  assert.equal(game.airborneCue.selected, 'far');
  assert.equal(game.stats.stamps, count, 'selecting solid stone must not stamp a duplicate bridge');
  assert.equal(game.echoes.length, 1, 'the first teaching bridge remains untouched');
  let reached = false;
  for (let i = 0; i < 85 && game.status === 'playing'; i += 1) {
    game = tick(game, { left: true, jump: i < 7 });
    if (game.player.supportId === 'relay') { reached = true; break; }
  }
  assert.equal(reached, true, 'the known stone remains reachable through real input');
  assert.equal(game.airborneCue, null, 'cue is cleared only on an actual landing');
});

test('chosen cue geometry stays fixed from takeoff through confirmation and descent', () => {
  let game = firstEchoLanding(1, 7);
  game = tick(game, {});
  game = tick(game, { right: true, jump: true });
  assert.equal(game.airborneCue?.phase, 'pending');
  const positions = structuredClone(game.airborneCue.options);
  let revealed = false;
  for (let i = 0; i < 35 && !game.player.grounded; i += 1) {
    game = tick(game, { right: i < 10, left: i >= 10, jump: i < 18 });
    if (game.airborneCue) {
      assert.deepEqual(game.airborneCue.options, positions,
        'flight cue must not follow the changing player position or facing');
      if (game.airborneCue.phase === 'revealed') {
        revealed = true;
        assert.equal(game.pendingEcho, null);
      }
    }
  }
  assert.equal(revealed, true, 'both landing outlines remain available after choice is revealed');
});

test('same two outlined choices are drawn before, during, and after midair reveal', () => {
  let game = firstEchoLanding(1, 7);
  const rects = [];
  const labels = [];
  const ctx = new Proxy({}, {
    get: (_, name) => name === 'createLinearGradient'
      ? () => ({ addColorStop() {} })
      : name === 'strokeRect' ? (...args) => rects.push(args)
      : name === 'fillText' ? value => labels.push(String(value))
        : () => {},
    set: () => true,
  });
  function snapshot(expected) {
    rects.length = 0;
    labels.length = 0;
    draw(ctx, game);
    for (const r of [expected.near, expected.far]) {
      assert.ok(rects.some(x => x[0] === r.x && x[1] === r.y
        && x[2] === r.w && x[3] === r.h),
      'both known positions must be outlined, even when the real platform is already revealed');
    }
    assert.ok(!labels.some(x => x.includes('前方有固定石台 · 直接跳上去')),
      'reverting to a conditional hidden choice is forbidden');
  }
  const expected = structuredClone(airborneCandidates(game));
  snapshot(expected);
  game = tick(game, {});
  game = tick(game, { right: true, jump: true });
  snapshot(expected);
  for (let i = 0; i < 12 && game.pendingEcho; i += 1) {
    game = tick(game, { right: i < 6, left: i >= 6, jump: true });
  }
  assert.equal(game.airborneCue.phase, 'revealed');
  snapshot(expected);
});

test('actual render announces candidate positions without flashing forming labels', () => {
  let game = firstEchoLanding(1, 7);
  const labels = [];
  const ctx = new Proxy({}, {
    get: (_, name) => name === 'createLinearGradient'
      ? () => ({ addColorStop() {} })
      : name === 'fillText' ? str => labels.push(String(str))
        : () => {},
    set: () => true,
  });
  draw(ctx, game);
  assert.ok(labels.some(x => x.includes('两个落点 · 起跳后定一个')));
  assert.ok(labels.every(x => !x.includes('显形 forming')));
});