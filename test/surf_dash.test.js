import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update, ECHO, PLAYER, SURF, airborneForecast, echoMotionPlan, echoMotionX, solidRects } from '../src/game.js';
import { draw } from '../src/render.js';

const dt = 1 / 60;
const tick = (game, input = {}) => update(game, input, dt);

function airborneLandingFixture() {
  const game = createGame({ level: 1, seed: 3, challenge: true, surf: true });
  game.route.revealed = true;
  game.echoes = [{ id: 'echo-1', x: 330, y: 402, w: 80, h: ECHO.h,
    phase: 'solid', age: 0 }];
  game.nextId = 2;
  Object.assign(game.player, { x: 364, y: 402 - PLAYER.h, vx: 0, vy: 0,
    facing: 1, grounded: true, supportId: 'echo-1' });
  const preview = airborneForecast(game);
  assert.equal(preview.blocked, false);
  assert.equal(preview.target.role, 'echo');
  tick(game, { jump: true });
  const landing = game.echoes.find(e => e.id === game.flightBridgeId);
  assert.ok(landing);
  assert.equal(landing.phase, 'solid');
  return { game, landing };
}

function fallOnto(game, rect, center = true) {
  game.surgeCharge = 0;
  Object.assign(game.player, {
    x: center ? rect.x + rect.w / 2 - PLAYER.w / 2 : rect.x + 2,
    y: rect.y - PLAYER.h - 3, vx: 0, vy: 130,
    grounded: false, supportId: null,
  });
  for (let i = 0; i < 8 && !game.player.grounded; i++) tick(game);
  assert.equal(game.player.grounded, true);
}

test('surf is opt-in, baseline physics stays identical without a dash', () => {
  const plain = createGame({ level: 1, seed: 5, challenge: true });
  const surf = createGame({ level: 1, seed: 5, challenge: true, surf: true });
  assert.equal(plain.surfEnabled, false);
  assert.equal(surf.surfEnabled, true);
  for (let i = 0; i < 26; i++) {
    const input = { right: true, jump: i < 18 };
    tick(plain, input);
    tick(surf, input);
    assert.equal(surf.player.x, plain.player.x);
    assert.equal(surf.player.y, plain.player.y);
    assert.equal(surf.player.vy, plain.player.vy);
    assert.deepEqual(surf.echoes, plain.echoes);
  }
  assert.equal(plain.stats.dashes, 0);
  assert.equal(surf.stats.dashes, 0);
});

test('midair dash is a deliberate one-charge horizontal impulse, never a new jump', () => {
  const surf = createGame({ level: 1, seed: 5, challenge: true, surf: true });
  const base = createGame({ level: 1, seed: 5, challenge: true });
  tick(surf, { right: true, dash: true }); // Ground cannot expend energy.
  tick(base, { right: true });
  assert.equal(surf.surgeCharge, 1);
  tick(surf); tick(base); // Release controls.
  tick(surf, { right: true, jump: true });
  tick(base, { right: true, jump: true });
  const firstBridges = surf.echoes.length;
  for (let i = 0; i < 19; i++) {
    tick(surf, { right: true, jump: i < 17, dash: i >= 4 });
    tick(base, { right: true, jump: i < 17 });
  }
  assert.equal(surf.stats.dashes, 1);
  assert.equal(surf.surgeCharge, 0);
  assert.ok(surf.player.x - base.player.x > 45, 'pulse must materially change air control');
  assert.equal(surf.player.y, base.player.y, 'dash must not add vertical lift');
  assert.equal(surf.player.vy, base.player.vy);
  assert.equal(surf.echoes.length, firstBridges, 'dash does not mint platforms');
  tick(surf, { dash: false });
  tick(surf, { dash: true });
  assert.equal(surf.stats.dashes, 1, 'cannot expend the same charge twice');
  assert.equal(SURF.duration > 0 && SURF.duration < 0.2, true);
});

test('a centered same-flight echo landing refills energy and builds a chain', () => {
  const { game, landing } = airborneLandingFixture();
  fallOnto(game, landing, true);
  assert.equal(game.player.supportId, landing.id);
  assert.equal(game.surgeCharge, 1);
  assert.equal(game.precisionChain, 1);
  assert.equal(game.stats.preciseLandings, 1);
  assert.equal(game.stats.bestChain, 1);
  assert.match(game.notice, /精准落脚 · 连击 1/);
});

test('landing outside the bright center refills dash but earns no precision chain', () => {
  const { game, landing } = airborneLandingFixture();
  fallOnto(game, landing, false);
  assert.equal(game.player.supportId, landing.id);
  assert.equal(game.surgeCharge, 1);
  assert.equal(game.precisionChain, 0);
  assert.equal(game.stats.preciseLandings, 0);
});

test('landing back on an old earned bridge restores one burst but no chain', () => {
  const { game } = airborneLandingFixture();
  const old = game.echoes.find(e => e.id === 'echo-1');
  fallOnto(game, old, true);
  assert.equal(game.player.supportId, old.id);
  assert.equal(game.surgeCharge, 1);
  assert.equal(game.precisionChain, 0);
  assert.equal(game.stats.preciseLandings, 0);
});

test('restart and next-room preserve the comparison variant', () => {
  let game = createGame({ level: 1, seed: 11, challenge: true, surf: true });
  game.surgeCharge = 0;
  game = tick(game, { restart: true });
  assert.equal(game.surfEnabled, true);
  assert.equal(game.surgeCharge, 1);
  game.status = 'won';
  game = tick(game, { next: true });
  assert.equal(game.levelIndex, 2);
  assert.equal(game.surfEnabled, true);
  assert.equal(game.surgeCharge, 1);
});

test('the actual canvas labels the skill loop and the available surge', () => {
  const game = createGame({ level: 1, challenge: true, surf: true });
  const labels = [];
  const ctx = new Proxy({}, {
    get: (_, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} })
      : key === 'fillText' ? str => labels.push(String(str))
        : () => {},
    set: () => true,
  });
  draw(ctx, game);
  assert.ok(labels.some(s => s.includes('Shift/J') && s.includes('落地自动恢复')));
  assert.ok(labels.some(s => s.includes('潮能●')));
  game.surgeCharge = 0;
  draw(ctx, game);
  assert.ok(labels.some(s => s.includes('潮能○')));
});

function startSurfChallenge(seed = 3) {
  const game = createGame({ level: 1, seed, challenge: true, surf: true });
  for (let i = 0; i < 90 && !game.route.revealed; i++) {
    tick(game, {right: true, jump: i < 18});
    assert.equal(game.status, 'playing');
  }
  assert.equal(game.player.supportId, 'echo-1');
  for (let i = 0; i < 15; i++) tick(game);
  assert.equal(game.player.vx, 0);
  return game;
}

test('the first post-tutorial narrow bridge has a pre-shown deterministic moving rail', () => {
  const game = startSurfChallenge();
  const forecast = airborneForecast(game);
  const plan = echoMotionPlan(game, forecast.target);
  assert.ok(plan, 'first later bridge must actually move in surf variant');
  assert.equal(plan.elapsed, 0);
  const startX = forecast.target.x;
  const endX = startX + plan.facing * plan.travel;
  assert.equal(echoMotionX(plan, 0), startX);
  assert.ok(Math.abs(echoMotionX(plan, plan.period / 2) - endX) < 1e-8);
  assert.ok(Math.abs(echoMotionX(plan, plan.period) - startX) < 1e-8);
  assert.ok(plan.travel >= 20 && plan.travel <= 50, 'readable and bounded travel');
  assert.equal(echoMotionPlan({ ...game, surfEnabled: false }, forecast.target), null,
    'comparison variant has no moving platforms');
  const original = airborneForecast(game);
  tick(game, { jump: true });
  const newId = game.flightBridgeId;
  assert.ok(newId);
  const platform = game.echoes.find(e => e.id === newId);
  assert.ok(platform.motion?.active);
  assert.equal(platform.motion.startX, original.target.x);
  let leftStart = false;
  for (let i = 0; i < 24; i++) {
    tick(game, { jump: i < 18 });
    assert.equal(platform.phase, 'solid');
    assert.ok(platform.x >= Math.min(startX, endX) - 1e-8);
    assert.ok(platform.x <= Math.max(startX, endX) + 1e-8);
    if (Math.abs(platform.x - startX) > 15) leftStart = true;
  }
  assert.equal(leftStart, true, 'the platform visibly moves while airborne');
  assert.deepEqual(game.airborneCue.options, original.options,
    'takeoff uses the exact forecast, not a fresh airborne lottery');
});

test('movement is collision-authoritative, and a caught rail freezes on landing', () => {
  const { game, landing } = airborneLandingFixture();
  assert.ok(landing.motion?.active);
  tick(game, {});
  const displaced = landing.x;
  assert.notEqual(displaced, landing.motion.startX);
  // Simulate the approaching player at the ACTUAL moving landing point.
  fallOnto(game, landing, true);
  assert.equal(game.player.supportId, landing.id);
  assert.equal(landing.motion.active, false);
  const caughtX = landing.x;
  for (let i = 0; i < 20; i++) tick(game, {});
  assert.equal(landing.x, caughtX, 'earned support must not slide the player away');
  assert.ok(solidRects(game).some(e => e.id === landing.id && e.x === caughtX));
});

test('every grounded landing resets burst once, never grants unlimited midair bursts', () => {
  const { game, landing } = airborneLandingFixture();
  tick(game, { dash: true }); // midair, intentionally spend it
  if (game.surgeCharge === 1) {
    tick(game, { dash: false });
    for (let i = 0; i < 5; i++) tick(game);
    tick(game, { dash: true });
  }
  assert.equal(game.surgeCharge, 0);
  assert.equal(game.stats.dashes, 1);
  const before = game.stats.dashes;
  tick(game, { dash: false });
  tick(game, { dash: true });
  assert.equal(game.stats.dashes, before, 'still one use per flight');
  fallOnto(game, landing, false);
  assert.equal(game.surgeCharge, 1, 'ordinary landed catch must recharge');
  // Launch again, spend, land back on earned old support, spend yet again.
  tick(game, {jump: true, right: false});
  for (let i = 0; i < 7; i++) tick(game, {jump: true});
  tick(game, {dash: true});
  assert.equal(game.stats.dashes, 2);
  assert.equal(game.surgeCharge, 0);
  const startingSupport = game.echoes.find(e => e.id === landing.id);
  fallOnto(game, startingSupport, true);
  assert.equal(game.surgeCharge, 1);
  tick(game, {jump: true});
  for (let i = 0; i < 7; i++) tick(game, {jump: true});
  tick(game, {dash: true});
  assert.equal(game.stats.dashes, 3, 'can use burst on successive jumps');
});

test('moving rail is not a collision shortcut or delayed midair random decision', () => {
  const game = startSurfChallenge();
  const forecast = airborneForecast(game);
  assert.equal(forecast.blocked, false);
  const x = game.player.x;
  tick(game, {jump: true});
  const id = game.flightBridgeId;
  for (let i = 0; i < 90 && !game.player.grounded; i++) {
    // Standstill jump never reaches the moving corridor.
    tick(game, {jump: i < 18});
    assert.ok(Math.abs(game.player.x - x) < 1e-6);
  }
  assert.notEqual(game.player.supportId, id);
  assert.ok(!solidRects(game).some(platform => platform.id === id),
    'missed moving echo cannot persist as a banked next jump');
  assert.ok(game.echoes.filter(e => e.motion?.active).length <= 1);
});

test('input-only chase: a normal near jump works and a timed dash catches the far moving rail', () => {
  const cases = {};
  for (let seed = 0; seed < 40 && (!cases.near || !cases.far); seed++) {
    const game = startSurfChallenge(seed);
    const plan = airborneForecast(game);
    if (plan.target?.role === 'echo' && echoMotionPlan(game, plan.target)) {
      cases[plan.selected] ??= seed;
    }
  }
  assert.ok(Number.isInteger(cases.near));
  assert.ok(Number.isInteger(cases.far));

  function follow(seed, dash) {
    const game = startSurfChallenge(seed);
    const forecast = airborneForecast(game);
    tick(game, { right: true, jump: true });
    const id = game.flightBridgeId;
    assert.ok(id, 'a fresh moving target must exist from takeoff');
    let touchedNew = false;
    for (let frame = 0; frame < 83 && game.status === 'playing'; frame++) {
      tick(game, { right: true, jump: frame < 20, dash: dash && frame === 12 });
      if (game.player.grounded) {
        touchedNew = game.player.supportId === id;
        break;
      }
    }
    return { touchedNew, game, forecast };
  }
  const near = follow(cases.near, false);
  assert.equal(near.touchedNew, true,
    'ordinary input-only forward jump must catch the near moving target');
  const far = follow(cases.far, true);
  assert.equal(far.game.stats.dashes, 1);
  assert.equal(far.touchedNew, true,
    'a player-timed single dash must catch the far moving target');
  const farNoDash = follow(cases.far, false);
  assert.equal(farNoDash.touchedNew, false,
    'the same right-only policy without dash should not trivially solve the far moving catch');
});
