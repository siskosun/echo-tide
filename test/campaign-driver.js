import assert from 'node:assert/strict';
import { createGame, update, PLAYER, PHYSICS, solidRects } from '../src/game.js';

// Input-only routes from spawn. No teleporting, injected platforms or state edits.
export function playRoom(level, { flow = false } = {}) {
  let game = createGame({ level });
  const inputs = [];
  const supports = [];
  const dt = 1 / 60;
  function step(input = {}) {
    inputs.push(input);
    game = update(game, input, dt);
    supports.push(game.player.supportId);
    assert.notEqual(game.status, 'lost', `room ${level}: route fell or timed out`);
  }
  function wait(n = flow ? 0 : 45) {
    const x = game.player.x;
    for (let i = 0; i < n; i++) step({ left: game.player.x > x, right: game.player.x <= x });
  }
  function jumpTo(id, x, facing, { launchFacing = null } = {}) {
    step();
    for (let i = 0; i < 130; i++) {
      const target = solidRects(game).find(p => p.id === id);
      let dir = game.player.x < x ? 1 : -1;
      // In the new takeoff-stamp mode, returning via a retained echo can
      // intentionally launch facing *away* from it, avoiding a fresh bridge
      // intercepting the return. After launch, steer toward the real target.
      if (i === 0 && launchFacing !== null) dir = launchFacing;
      const feet = game.player.y + PLAYER.h;
      if (target && game.player.vy >= 0 && feet <= target.y + 8 && feet + (game.player.vy + PHYSICS.gravity * dt) * dt >= target.y) dir = facing;
      step({ jump: true, left: dir < 0, right: dir > 0 });
      if (i > 2 && game.player.grounded) return;
    }
    assert.fail(`room ${level}: no landing towards ${id}`);
  }
  function echo(y) {
    const found = game.echoes.find(e => (e.phase === 'solid' || (flow && e.phase === 'rise')) && Math.abs(e.y - y) < 3);
    assert.ok(found, `room ${level}: no solid echo at y=${y}`);
    return found;
  }
  let reusedAnchor = null;
  if (level === 0) {
    jumpTo('start', 605, -1); wait(); jumpTo(echo(402).id, 470, -1); wait();
    jumpTo('relay', 340, 1); wait(); jumpTo('relay', 320, 1); wait();
    jumpTo(echo(250).id, 457, 1); wait(); jumpTo('goal', 630, 1);
    for (let i = 0; i < 60 && game.status === 'playing'; i++) step({ right: true });
  } else if (level === 1) {
    jumpTo('start', 290, 1); wait(); jumpTo(echo(402).id, 425, 1);
    step({ anchor: true }); wait(360); // Outwait the normal lifetime on a retained bridge.
    jumpTo(game.anchorId, 440, 1); wait(); jumpTo(echo(326).id, 575, 1); wait();
    jumpTo('goal', 740, 1);
    for (let i = 0; i < 50 && game.status === 'playing'; i++) step({ right: true });
  } else {
    jumpTo('start', 680, -1); wait(); jumpTo(echo(402).id, 546, -1); wait();
    // With takeoff stamping, the next bridge exists only AFTER this jump begins.
    const outbound = `echo-${game.nextId}`;
    jumpTo(outbound, 410, -1);
    assert.equal(game.player.supportId, outbound, 'actual jump lands on the newly created outbound bridge');
    step({ anchor: true }); wait();
    reusedAnchor = game.anchorId;
    jumpTo('relic', 230, -1);
    for (let i = 0; i < 45; i++) step({ left: true });
    assert.equal(game.objectiveCollected, true, 'collect on the fixed ledge');
    for (let i = 0; i < 24; i++) step({ right: true });
    wait(360); // Return after every unanchored outbound bridge has disappeared.
    assert.equal(game.echoes.length, 1);
    jumpTo(reusedAnchor, 390, 1, { launchFacing: -1 });
    assert.equal(game.player.supportId, reusedAnchor, 'reuse the outbound anchor on the return trip');
    wait();
    const returning = `echo-${game.nextId}`;
    jumpTo(returning, 530, 1);
    assert.equal(game.player.supportId, returning, 'actual jump lands on the newly created return bridge');
    for (let i = 0; i < 90 && game.status === 'playing'; i++) step({ right: true });
  }
  assert.equal(game.status, 'won', `room ${level} must reach its exit`);
  return { game, inputs, supports, reusedAnchor };
}
