import test from 'node:test';
import './route_fork.test.js';
import './airborne_bridge.test.js';
import './surf_dash.test.js';
import assert from 'node:assert/strict';
import { createGame, update, ECHO, PLAYER, LEVELS, maxJumpHeight } from '../src/game.js';
import { playRoom } from './campaign-driver.js';
import { draw } from '../src/render.js';
const dt = 1 / 60;
const tick = (g, input = {}) => update(g, input, dt);

test('human-facing room hints explain takeoff stamping rather than old landing stamping', () => {
  for (const [index, level] of LEVELS.entries()) {
    assert.match(level.hint, /起跳/, `room ${index + 1} must explain the takeoff action`);
    assert.match(level.hint, /首跳/, `room ${index + 1} must distinguish the first teaching jump`);
    assert.match(level.hint, /提前显示|确定目标|确认下一落点/, `room ${index + 1} must preview the real target`);
    assert.doesNotMatch(level.hint, /朝左落地|落地(?:后|时).*造桥/,
      `room ${index + 1} must not teach the superseded landing-stamp mechanism`);
  }
});

test('relay room supports immediate successive jumps with no wait for forming echoes', () => {
  const { game } = playRoom(0, { flow: true });
  assert.equal(game.status, 'won');
  assert.ok(game.stats.echoLandings >= 2);
  assert.ok(game.time < 7, `continuous route took ${game.time}s`);
});

test('renderer gives a static forecast then a stable solid bridge without a second rise animation', () => {
  const labels = [];
  const ctx = new Proxy({}, {
    get: (_, name) => name === 'createLinearGradient' ? () => ({ addColorStop() {} })
      : name === 'fillText' ? value => labels.push(String(value)) : () => {},
    set: () => true,
  });
  const game = createGame();
  draw(ctx, game);
  assert.ok(labels.includes('起跳立即成桥'));
  assert.equal(game.echoes.length, 0);
  tick(game, { left: true, jump: true });
  assert.equal(game.echoes[0].phase, 'solid');
  draw(ctx, game);
  assert.equal(labels.some(label => label.includes('显形 forming')), false);
});

for (let level = 0; level < LEVELS.length; level++) {
  test(`room ${level + 1} has an input-only winning route using echoes`, () => {
    const { game } = playRoom(level);
    assert.ok(game.stats.echoLandings >= 2);
    if (level === 0 || level === 2) {
      assert.ok(game.stats.leftStamps > 0 && game.stats.rightStamps > 0);
      assert.equal(game.objectiveCollected, true);
    } else assert.ok(game.stats.anchors > 0);
  });
  test(`room ${level + 1} cannot leave the starting dock upwards without echoes`, () => {
    const [start, ...rest] = LEVELS[level].platforms;
    for (const platform of rest) assert.ok(start.y - platform.y > maxJumpHeight());
  });
}

for (let level = 0; level < LEVELS.length; level += 1) {
  test('room ' + (level + 1) + ' alternate hidden route has an input-only winning path', () => {
    const result = playRoom(level, { seed: 1 });
    assert.equal(result.game.status, 'won');
    assert.equal(result.game.objectiveCollected, true);
    assert.equal(result.game.route.revealed, true);
    assert.equal(result.game.route.side, level === 1 ? 'left' : 'right');
    assert.ok(result.game.stats.echoLandings >= 2);
  });
}

test('one fixed right-bank winning input script cannot also complete the left-bank route', () => {
  const right = playRoom(1, { seed: 0 });
  assert.equal(right.game.route.side, 'right');
  assert.equal(right.game.status, 'won');

  // Replay EVERY actual input at the same 60 Hz; change only the hidden seed.
  let wrong = createGame({ level: 1, seed: 1 });
  for (const input of right.inputs) wrong = update(wrong, input, dt);
  assert.equal(wrong.route.side, 'left');
  assert.equal(wrong.objectiveCollected, false);
  assert.notEqual(wrong.status, 'won',
    'the old fixed solution must fail to acquire the alternative objective');

  const adaptive = playRoom(1, { seed: 1 });
  assert.equal(adaptive.game.status, 'won');
  assert.equal(adaptive.game.route.side, 'left');
  assert.equal(adaptive.game.objectiveCollected, true);
  assert.ok(adaptive.game.time > right.game.time + 0.5,
    'reaching the opposite bank must impose an actual detour');
});

function anchorFixture() {
  const game = createGame({ level: 1 });
  game.echoes = [
    { id: 'echo-1', x: 100, y: 402, w: ECHO.w, h: ECHO.h, phase: 'solid', age: 2 },
    { id: 'echo-2', x: 430, y: 326, w: ECHO.w, h: ECHO.h, phase: 'solid', age: 1 },
  ];
  game.nextId = 3;
  stand(game, game.echoes[0]);
  return game;
}
function stand(game, echo) {
  Object.assign(game.player, { x: echo.x + 50, y: echo.y - PLAYER.h, vy: 0, vx: 0, grounded: true, supportId: echo.id });
}

test('anchor freezes exactly one lifetime; held key does not toggle; transfer resumes the old lifetime', () => {
  const game = anchorFixture();
  tick(game, { anchor: true });
  const age = game.echoes[0].age;
  for (let i = 0; i < 60; i++) tick(game, { anchor: true });
  assert.equal(game.anchorId, 'echo-1');
  assert.equal(game.echoes[0].age, age);
  assert.ok(game.echoes[1].age > 1.9);
  tick(game);
  stand(game, game.echoes[1]);
  const oldAge = game.echoes[0].age;
  const newAge = game.echoes[1].age;
  tick(game, { anchor: true });
  assert.equal(game.anchorId, 'echo-2');
  assert.ok(game.echoes[0].age > oldAge);
  assert.equal(game.echoes[1].age, newAge);
  for (let i = 0; i < 230; i++) tick(game);
  assert.equal(game.echoes.some(e => e.id === 'echo-1'), false);
  assert.equal(game.player.supportId, 'echo-2');
});

test('airborne or stone anchor requests do not consume the retained bridge; E on it releases', () => {
  const game = anchorFixture();
  tick(game, { anchor: true }); tick(game);
  game.player.grounded = false; game.player.supportId = null; game.player.y -= 20;
  tick(game, { anchor: true });
  assert.equal(game.anchorId, 'echo-1');
  tick(game); stand(game, game.platforms[0]);
  tick(game, { anchor: true });
  assert.equal(game.anchorId, 'echo-1');
  tick(game); stand(game, game.echoes[0]);
  tick(game, { anchor: true });
  assert.equal(game.anchorId, null);
});

test('capacity pressure protects the anchored echo and expires an unanchored one', () => {
  const game = anchorFixture();
  tick(game, { anchor: true });
  game.echoes.push(
    { ...game.echoes[1], id: 'echo-3', x: 600, y: 174 },
    { ...game.echoes[1], id: 'echo-4', x: 30, y: 100 },
  );
  game.nextId = 5;
  // One successful launch creates the fifth echo in the new flow mode.
  stand(game, game.platforms[0]); game.player.x = 160;
  game.player.facing = 1;
  tick(game, { jump: true });
  assert.equal(game.echoes.find(e => e.id === 'echo-1').phase, 'solid');
  assert.equal(game.echoes.find(e => e.id === 'echo-2').phase, 'sink');
  assert.equal(game.echoes.filter(e => e.phase !== 'sink').length, ECHO.maxAlive);
});

test('a repeat stamp never moves or phases out an anchored bridge', () => {
  const game = anchorFixture();
  tick(game, { anchor: true });
  const bridge = game.echoes[0];
  Object.assign(bridge, { x: 189, y: 402 });
  const before = { ...bridge };
  stand(game, game.platforms[0]);
  game.player.x = 50; game.player.facing = 1;
  tick(game, { jump: true });
  assert.deepEqual(bridge, before);
});

test('exit stays locked until the objective is collected; restart clears objective and anchors', () => {
  for (const level of [0, 2]) {
    let game = createGame({ level });
    Object.assign(game.player, { x: game.exit.x, y: game.exit.y, grounded: false, supportId: null });
    tick(game); assert.equal(game.status, 'playing');
    // From a clean spawn, actual first-jump input is needed to reveal the branch.
    game = createGame({ level });
    let frame = 0;
    for (; frame < 80 && !game.route.revealed; frame += 1) {
      tick(game, { left: true, jump: frame < 18 });
    }
    assert.equal(game.route.revealed, true);
    Object.assign(game.player, { x: game.level.objective.x, y: game.level.objective.y, vy: 0,
      grounded: false, supportId: null });
    tick(game); assert.equal(game.objectiveCollected, true);
    Object.assign(game.player, { x: game.exit.x, y: game.exit.y, vy: 0 });
    tick(game); assert.equal(game.status, 'won');
    game = tick(game, { restart: true });
    assert.equal(game.levelIndex, level);
    assert.equal(game.objectiveCollected, false);
    assert.equal(game.anchorId, null);
    assert.equal(game.echoes.length, 0);
  }
});

test('next only advances a won room; final room cannot overflow; terminal events fire once', () => {
  let game = createGame();
  assert.equal(tick(game, { next: true }).levelIndex, 0);
  game = playRoom(0).game;
  assert.ok(game.events.some(e => e.type === 'win'));
  tick(game); assert.deepEqual(game.events, []);
  game = tick(game, { next: true });
  assert.equal(game.levelIndex, 1); assert.equal(game.status, 'playing');
  assert.equal(game.anchorId, null); assert.equal(game.stats.stamps, 0);
  game = playRoom(2).game;
  assert.equal(tick(game, { next: true }).levelIndex, 2);
});

for (let level = 0; level < LEVELS.length; level++) {
  test(`opt-in surf mode preserves an input-only winning path in room ${level + 1}`, () => {
    const { game, inputs } = playRoom(level, { surf: true });
    assert.equal(game.status, 'won');
    assert.equal(game.surfEnabled, true);
    assert.equal(game.objectiveCollected, true);
    assert.ok(inputs.every(input => !input.dash),
      'the core campaign must never require dashes to remain finishable');
  });
}
