import test from 'node:test';
import assert from 'node:assert/strict';
import { AIR_BRIDGE, airborneChoice } from '../src/airborne_bridge.js';
import { PLAYER, ECHO, RECOVERY, createGame, update, airborneCandidates, overlaps, hasReachableStone, solidRects } from '../src/game.js';
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
  game = tick(game, {}); // Neutral ground frame can still drift via run grace.
  assert.equal(hasReachableStone(game), true);
  const candidates = airborneCandidates(game);
  assert.equal(candidates.near.role, 'echo');
  assert.equal(candidates.far.role, 'stone');
  assert.equal(candidates.far.id, 'relay');
  assert.ok(game.platforms.every(p => !overlaps(candidates.near, p)),
    'the echo option must not paint a second bridge over a stone');
  const count = game.stats.stamps;
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
  snapshot(airborneCandidates(game));
  game = tick(game, {});
  const expected = structuredClone(airborneCandidates(game));
  snapshot(expected);
  game = tick(game, { right: true, jump: true });
  snapshot(expected);
  for (let i = 0; i < 12 && game.pendingEcho; i += 1) {
    game = tick(game, { right: i < 6, left: i >= 6, jump: true });
  }
  assert.equal(game.airborneCue.phase, 'revealed');
  snapshot(expected);
});

test('input-only standing jump cannot bank a new bridge for the next jump', () => {
  // Repeat the exact reported exploit for BOTH seeded alternatives:
  // land on teaching echo, stop, jump vertically, wait for the new bridge,
  // land back on the teaching echo, then try a second jump.
  for (const [side, seed] of Object.entries(branchSeeds(1))) {
    let game = firstEchoLanding(1, seed);
    for (let frame = 0; frame < 14; frame += 1) game = tick(game, {});
    assert.equal(game.player.supportId, 'echo-1',
      side + ': neutral input must remain on the teaching bridge');
    assert.equal(game.player.vx, 0,
      side + ': standstill exploit must truly start with zero horizontal velocity');
    const launchX = game.player.x;
    const launchY = game.player.y;
    const candidates = airborneCandidates(game);
    for (const candidate of Object.values(candidates)) {
      if (candidate.role === 'stone') continue;
      assert.ok(candidate.x >= launchX + PLAYER.w + 4
        || candidate.x + candidate.w <= launchX - 4,
      side + ': narrow bridge must not overlap the stationary takeoff footprint');
    }

    game = tick(game, { jump: true });
    assert.ok(game.pendingEcho);
    let revealed = null;
    let landedBack = false;
    for (let frame = 0; frame < 75 && game.status === 'playing'; frame += 1) {
      game = tick(game, { jump: frame < 18 });
      revealed ??= game.echoes.find(echo => echo.id === 'echo-2') ?? null;
      if (game.player.grounded) {
        assert.equal(game.player.supportId, 'echo-1',
          side + ': standing jump must return to original bridge');
        landedBack = true;
        break;
      }
    }
    assert.ok(revealed, side + ': this test must exercise a REAL newly generated bridge');
    assert.equal(landedBack, true);
    assert.equal(game.echoes.find(echo => echo.id === 'echo-2')?.phase, 'sink',
      side + ': unclaimed new bridge must become intangible on same-jump landing');
    assert.ok(!solidRects(game).some(rect => rect.id === 'echo-2'),
      side + ': abandoned bridge cannot remain solid for a later jump');
    assert.equal(game.flightBridgeId, null);
    assert.equal(game.airborneCue, null);
    assert.equal(game.player.x, launchX,
      side + ': no hidden horizontal movement permitted in the exploit test');

    game = tick(game, { jump: false });
    game = tick(game, { right: true, jump: true });
    assert.ok(!solidRects(game).some(rect => rect.id === 'echo-2'),
      side + ': a second takeoff cannot resurrect a banked bridge');
  }
});

test('first wide teaching platform cannot be banked by a vertical jump', () => {
  let game = createGame({ level: 1, seed: 7, challenge: true });
  game = tick(game, { jump: true });
  assert.equal(game.echoes.length, 1);
  let returned = false;
  for (let i = 0; i < 80 && game.status === 'playing'; i += 1) {
    game = tick(game, { jump: i < 18 });
    if (game.player.grounded) { returned = true; break; }
  }
  assert.equal(returned, true);
  assert.equal(game.player.supportId, 'start');
  assert.equal(game.echoes[0].phase, 'sink',
    'even the first tutorial bridge must be caught in the jump that created it');
  assert.equal(game.route.revealed, false);
  assert.equal(game.stats.echoLandings, 0);
});

test('a missed new echo never sinks a previously earned and anchored bridge', () => {
  let game = firstEchoLanding(1, branchSeeds(1).near);
  for (let i = 0; i < 14; i += 1) game = tick(game, {});
  game = tick(game, { anchor: true });
  assert.equal(game.anchorId, 'echo-1');
  game = tick(game, { anchor: false, jump: true });
  for (let i = 0; i < 80 && !game.player.grounded; i += 1) {
    game = tick(game, { jump: i < 18 });
  }
  assert.equal(game.player.supportId, 'echo-1');
  assert.equal(game.echoes.find(echo => echo.id === 'echo-1')?.phase, 'solid');
  assert.equal(game.anchorId, 'echo-1');
  assert.equal(game.echoes.find(echo => echo.id === 'echo-2')?.phase, 'sink');
});

test('catching the bridge during the creating jump preserves normal next-jump use', () => {
  for (const [side, seed] of Object.entries(branchSeeds(1))) {
    const { game, landed } = secondHop(1, seed, true);
    assert.equal(landed, true, side + ': the actual live correction path should still work');
    const earned = game.echoes.find(echo => echo.id === 'echo-2');
    assert.equal(earned?.phase, 'solid',
      side + ': same-flight landing must preserve the bridge after touchdown');
    assert.equal(game.flightBridgeId, null);
    assert.ok(solidRects(game).some(rect => rect.id === 'echo-2'));
  }
});

test('returning to the previously earned echo grants one safe retry instead of sudden collapse', () => {
  for (const [side, seed] of Object.entries(branchSeeds(1))) {
    let game = firstEchoLanding(1, seed);
    for (let i = 0; i < 14; i += 1) game = tick(game, {});
    assert.equal(game.player.supportId, 'echo-1');
    assert.equal(game.player.vx, 0, 'failed jump must start with no hidden sideways motion');
    game.echoes[0].age = ECHO.solid - 0.05; // Boundary: expires during a normal hop without a guard.
    game = tick(game, { jump: true });
    assert.equal(game.takeoffSupportId, 'echo-1');
    let resolved = false;
    for (let i = 0; i < 80 && game.status === 'playing'; i += 1) {
      game = tick(game, { jump: i < 18 });
      const support = game.echoes.find(e => e.id === 'echo-1');
      assert.equal(support?.phase, 'solid', 'earned takeoff support must not disappear midflight');
      if (game.player.grounded) { resolved = true; break; }
    }
    assert.equal(resolved, true, side + ': real jump must return to its previous echo');
    assert.equal(game.player.supportId, 'echo-1');
    assert.equal(game.echoes.find(e => e.id === 'echo-1')?.phase, 'solid');
    assert.equal(game.echoes.find(e => e.id === 'echo-1')?.recoveryUsed, true);
    assert.ok(game.echoes.find(e => e.id === 'echo-1').age
      <= ECHO.solid - RECOVERY.retrySeconds + dt,
    'touchdown grants enough room for another human jump');
    assert.ok(game.events.some(e => e.type === 'recovery_grace'),
      'the once-only retry must have an explicit testable event');
    assert.equal(game.echoes.find(e => e.id === 'echo-2')?.phase, 'sink',
      'the missed new echo cannot be stored for the next jump');
    assert.equal(game.flightBridgeId, null);
    assert.equal(game.takeoffSupportId, null);

    // Old bridge remains usable throughout a meaningful human reaction window.
    for (let i = 0; i < 48; i += 1) {
      game = tick(game);
      assert.equal(game.echoes.find(e => e.id === 'echo-1')?.phase, 'solid');
      assert.equal(game.player.supportId, 'echo-1');
    }
  }
});

test('repeat idle jumps cannot extend the same earned echo indefinitely', () => {
  let game = firstEchoLanding(1, branchSeeds(1).near);
  for (let i = 0; i < 14; i += 1) game = tick(game, {});
  game.echoes[0].age = ECHO.solid - 0.04;

  // One failed hop earns ONE recovery. The second vertical hop cannot reset it again.
  for (let hop = 0; hop < 2; hop += 1) {
    game = tick(game, { jump: true });
    let landed = false;
    for (let i = 0; i < 80 && game.status === 'playing'; i += 1) {
      game = tick(game, { jump: i < 18 });
      if (game.player.grounded) { landed = true; break; }
    }
    assert.equal(landed, true);
    assert.equal(game.player.supportId, 'echo-1');
    assert.equal(game.echoes.find(e => e.id === 'echo-1')?.recoveryUsed, true);
    game = tick(game, { jump: false });
  }
  const old = game.echoes.find(e => e.id === 'echo-1');
  assert.ok(old.age > ECHO.solid - RECOVERY.retrySeconds + 0.01,
    'second failed hop may NOT receive another timer reset');
  const earliest = old.age;
  for (let i = 0; i < 180 && old.phase === 'solid'; i += 1) game = tick(game);
  assert.notEqual(old.phase, 'solid',
    'a single echo can still expire after its bounded recovery, preserving the timer challenge');
  assert.ok(earliest < old.age, 'real idle time must continue progressing');
});

test('capacity eviction cannot consume the bridge a player just launched from', () => {
  let game = firstEchoLanding(1, branchSeeds(1).near);
  for (let i = 0; i < 14; i += 1) game = tick(game, {});
  const safeBridge = game.echoes[0];
  game.echoes.push(
    { id: 'echo-2', x: 25, y: 100, w: 80, h: 14, phase: 'solid', age: 1 },
    { id: 'echo-3', x: 430, y: 80, w: 80, h: 14, phase: 'solid', age: 1 },
    { id: 'echo-4', x: 800, y: 100, w: 80, h: 14, phase: 'solid', age: 1 },
  );
  game.anchorId = 'echo-4';
  game.nextId = 5;
  game.echoes[0].age = ECHO.solid - 0.01;
  game = tick(game, { right: true, jump: true });
  assert.equal(game.takeoffSupportId, 'echo-1');
  let spawned = false;
  for (let i = 0; i < 18 && !spawned; i += 1) {
    game = tick(game, { right: true, jump: true });
    spawned = game.echoes.some(e => e.id === 'echo-5');
  }
  assert.equal(spawned, true, 'fifth real jump bridge must trigger capacity enforcement');
  assert.equal(safeBridge.phase, 'solid', 'departing echo must stay solid for fallback');
  assert.equal(game.echoes.find(e => e.id === 'echo-4').phase, 'solid',
    'anchored echo must remain immune to capacity eviction');
  assert.equal(game.echoes.find(e => e.id === 'echo-2').phase, 'sink',
    'another older and unprotected echo is the correct eviction target');
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