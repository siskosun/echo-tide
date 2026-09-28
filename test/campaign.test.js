import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, update, ECHO, PLAYER, LEVELS, maxJumpHeight } from '../src/game.js';
import { playRoom } from './campaign-driver.js';
const dt = 1 / 60;
const tick = (g, input = {}) => update(g, input, dt);

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
  // One actual landing creates the fifth echo.
  stand(game, game.platforms[0]); game.player.y -= 2;
  game.player.grounded = false; game.player.vy = 200; game.airTime = 0.2;
  tick(game);
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
  game.player.x = 50; game.player.facing = 1; game.player.y -= 2;
  game.player.grounded = false; game.player.vy = 200; game.airTime = 0.2;
  tick(game);
  assert.deepEqual(bridge, before);
});

test('exit stays locked until the objective is collected; restart clears objective and anchors', () => {
  for (const level of [0, 2]) {
    let game = createGame({ level });
    Object.assign(game.player, { x: game.exit.x, y: game.exit.y, grounded: false, supportId: null });
    tick(game); assert.equal(game.status, 'playing');
    Object.assign(game.player, { x: game.level.objective.x, y: game.level.objective.y, vy: 0 });
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
