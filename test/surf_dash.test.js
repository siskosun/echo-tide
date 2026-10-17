import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update, ECHO, PLAYER, SURF, airborneForecast } from '../src/game.js';
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
  assert.match(game.notice, /潮能已恢复/);
});

test('landing outside the bright center earns no charge', () => {
  const { game, landing } = airborneLandingFixture();
  fallOnto(game, landing, false);
  assert.equal(game.player.supportId, landing.id);
  assert.equal(game.surgeCharge, 0);
  assert.equal(game.precisionChain, 0);
  assert.equal(game.stats.preciseLandings, 0);
});

test('bouncing on an old earned bridge never farms free air charges', () => {
  const { game } = airborneLandingFixture();
  const old = game.echoes.find(e => e.id === 'echo-1');
  fallOnto(game, old, true);
  assert.equal(game.player.supportId, old.id);
  assert.equal(game.surgeCharge, 0);
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
  assert.ok(labels.some(s => s.includes('Shift/J') && s.includes('亮心')));
  assert.ok(labels.some(s => s.includes('潮能●')));
  game.surgeCharge = 0;
  draw(ctx, game);
  assert.ok(labels.some(s => s.includes('潮能○')));
});
