/** Echo Tide / 叠影潮 — headless rules for the one-screen prototype. */
import { LEVELS } from './levels.js';
import { chooseRoute } from './route_fork.js';
import { AIR_BRIDGE, airborneChoice } from './airborne_bridge.js';
export { LEVELS } from './levels.js';

export const WORLD = { w: 960, h: 540 };

export const PLAYER = { w: 28, h: 36 };

export const PHYSICS = {
  gravity: 1700,
  jumpSpeed: 620,
  moveSpeed: 240,
  coyote: 0.16,
  jumpBuffer: 0.14,
  jumpCut: 0.9,
  maxFall: 1100,
  minAirToStamp: 0.08,
};

export const ECHO = {
  w: 210,
  h: 14,
  shiftX: 230,
  shiftY: -76,
  rise: 0.24,
  solid: 5,
  sink: 0.6,
  riseFrom: 44,
  maxAlive: 4,
};

export const TIME_LIMIT = 90;
export const KILL_Y = 518;

export const PLATFORMS = [
  { id: 'start', x: 20, y: 478, w: 390, h: 16, role: 'start' },
  { id: 'mid', x: 392, y: 428, w: 360, h: 16, role: 'stone' },
  { id: 'goal', x: 788, y: 276, w: 152, h: 16, role: 'goal' },
];

export const EXIT = { x: 820, y: 212, w: 96, h: 64 };

const SPAWN = { x: 78, y: PLATFORMS[0].y - PLAYER.h };

export function maxJumpHeight() {
  return (PHYSICS.jumpSpeed ** 2) / (2 * PHYSICS.gravity);
}

export function createGame(options = {}) {
  const levelIndex = options.level === 'classic' ? 'classic' : clamp(Math.trunc(options.level || 0), 0, LEVELS.length - 1);
  const level = levelIndex === 'classic' ? {
    title: '初潮', subtitle: '原始练习场', hint: '朝右落地，等待回声成形。',
    platforms: PLATFORMS, exit: EXIT, spawn: { ...SPAWN, facing: 1 }, anchor: false,
  } : LEVELS[levelIndex];
  const start = level.platforms[0];
  const flowCampaign = levelIndex !== 'classic';
  const seed = options.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Route seed must be an unsigned 32-bit integer');
  }
  return {
    levelIndex,
    // Hide the actual objective until the player first lands on an echo.
    level: flowCampaign ? { ...level, objective: null } : level,
    seed,
    route: flowCampaign ? { revealed: false, side: null } : null,
    anchorId: null,
    prevAnchor: false,
    objectiveCollected: flowCampaign ? false : !level.objective,
    notice: '',
    noticeTime: 0,
    status: 'playing',
    reason: null,
    time: 0,
    timeLeft: TIME_LIMIT,
    echoesEnabled: options.echoes !== false,
    // The classic practice route remains a frozen landing-stamp technical control.
    echoMode: levelIndex === 'classic' ? 'legacy' : 'flow',
    challengeEnabled: flowCampaign && options.challenge === true,
    pendingEcho: null,
    airborneCue: null,
    airborneTurn: 0,
    // A Challenge bridge can only be claimed during the takeoff that made it.
    flightBridgeId: null,
    nextId: 1,
    airTime: 0,
    coyote: PHYSICS.coyote,
    jumpBuffer: 0,
    prevJump: false,
    jumpHeld: false,
    runGrace: 0,
    events: [],
    stats: { stamps: 0, echoLandings: 0, anchors: 0, leftStamps: 0, rightStamps: 0 },
    exit: { ...level.exit },
    platforms: level.platforms.map((platform) => ({ ...platform })),
    echoes: [],
    player: {
      x: level.spawn.x,
      y: start.y - PLAYER.h,
      vx: 0,
      vy: 0,
      facing: level.spawn.facing,
      grounded: true,
      supportId: start.id,
    },
  };
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function playerRect(player) {
  return { x: player.x, y: player.y, w: PLAYER.w, h: PLAYER.h };
}

export function echoRect(centerX, surfaceTop, facing, platforms = PLATFORMS,
  { width = ECHO.w, shiftX = ECHO.shiftX } = {}) {
  let x = centerX + facing * shiftX - width / 2;
  let y = surfaceTop + ECHO.shiftY;
  x = clamp(x, 18, WORLD.w - width - 18);
  y = clamp(y, 48, KILL_Y - 70);
  for (let i = 0; i < 6; i += 1) {
    const hit = platforms.find((platform) => overlaps({ x, y, w: width, h: ECHO.h }, inflate(platform, 4)));
    if (!hit) break;
    // Join a stone ledge at its surface instead of silently adding jump height.
    y = hit.y;
    break;
  }
  return {
    x: clamp(x, 18, WORLD.w - width - 18),
    y: clamp(y, 48, KILL_Y - 70),
    w: width,
    h: ECHO.h,
  };
}

/** Preview the next take-off echo before the player commits to jump. */
export function predictEcho(game) {
  const player = game.player;
  const surfaceTop = player.grounded
    ? supportTop(game, player.supportId) ?? player.y + PLAYER.h
    : player.y + PLAYER.h;
  return flowEchoRect(game, player.x + PLAYER.w / 2, surfaceTop, player.facing);
}

/** A promised location never moves; the branching route is separate from bridge motion. */
function flowEchoRect(game, centerX, surfaceTop, facing) {
  return echoRect(centerX, surfaceTop, facing, game.platforms);
}

/** Both narrow targets are visible before takeoff, but neither is preselected. */
export function airborneCandidates(game) {
  const player = game.player;
  const surfaceTop = player.grounded
    ? supportTop(game, player.supportId) ?? player.y + PLAYER.h
    : player.y + PLAYER.h;
  const centerX = player.x + PLAYER.w / 2;
  let near = echoRect(centerX, surfaceTop, player.facing, game.platforms,
    { width: AIR_BRIDGE.w, shiftX: AIR_BRIDGE.near });
  let far = echoRect(centerX, surfaceTop, player.facing, game.platforms,
    { width: AIR_BRIDGE.w, shiftX: AIR_BRIDGE.far });
  const stone = reachableStone(game);
  if (stone) {
    // Every advanced jump keeps two visible choices. The existing ledge is
    // presented as an honest safe candidate, rather than silently switching
    // the landing rules and hiding the two previews.
    if (game.platforms.some(platform => overlaps(near, inflate(platform, 4)))) {
      near = echoRect(centerX, surfaceTop, player.facing, game.platforms,
        { width: AIR_BRIDGE.w, shiftX: -AIR_BRIDGE.backtrackWhenBlocked });
    }
    return {
      near: { ...near, role: 'echo' },
      far: { x: stone.x, y: stone.y, w: stone.w, h: stone.h,
        id: stone.id, role: 'stone' },
    };
  }
  // Else both options are temporary bridges. A far target is moved away from
  // stone geometry instead of painting a ghost on top of real rock.
  if (game.platforms.some(platform => overlaps(far, inflate(platform, 4)))) {
    far = echoRect(centerX, surfaceTop, player.facing, game.platforms,
      { width: AIR_BRIDGE.w, shiftX: -AIR_BRIDGE.backtrackWhenBlocked });
  }
  return { near: { ...near, role: 'echo' },
    far: { ...far, role: 'echo' } };
}

/** Find an actual reachable stone, never an inferred invisible step. */
function reachableStone(game) {
  if (!game.player.grounded) return null;
  const top = supportTop(game, game.player.supportId);
  if (top === null) return null;
  const maxRise = maxJumpHeight();
  return game.platforms.find(platform => {
    if (platform.id === game.player.supportId) return false;
    const rise = top - platform.y;
    if (rise < 8 || rise > maxRise) return false;
    const t = (PHYSICS.jumpSpeed
      + Math.sqrt(PHYSICS.jumpSpeed ** 2 - 2 * PHYSICS.gravity * rise)) / PHYSICS.gravity;
    const endX = game.player.x + game.player.facing * PHYSICS.moveSpeed * t;
    const left = Math.min(game.player.x, endX);
    const right = Math.max(game.player.x + PLAYER.w, endX + PLAYER.w);
    return right > platform.x + 3 && left < platform.x + platform.w - 3;
  }) ?? null;
}

export function hasReachableStone(game) {
  return reachableStone(game) !== null;
}

function queueAirborneBridge(game) {
  const options = airborneCandidates(game);
  const selected = airborneChoice(
    game.seed, game.levelIndex, game.nextId + game.airborneTurn,
  );
  game.airborneTurn += 1;
  // Persist *the same* two outlines through ascent, reveal and descent.
  // No fresh preview is recomputed from the airborne player's changing x.
  game.airborneCue = { options, selected: null, phase: 'pending' };
  game.pendingEcho = {
    options, selected, facing: game.player.facing,
    due: game.time + AIR_BRIDGE.revealAfter,
  };
}

function revealAirborneBridge(game) {
  if (!game.pendingEcho || game.time < game.pendingEcho.due) return;
  const { options, selected, facing } = game.pendingEcho;
  game.pendingEcho = null;
  if (game.airborneCue) {
    game.airborneCue.phase = 'revealed';
    game.airborneCue.selected = selected;
  }
  const target = options[selected];
  // An existing stone is always solid: never stamp a duplicate over it.
  if (target.role !== 'stone') {
    game.flightBridgeId = stamp(game, game.player, target.y, target, facing);
  }
  game.events.push({ type: 'airborne_reveal', selected, target: target.role });
}

export function solidRects(game) {
  const rects = game.platforms.map((platform) => ({ ...platform }));
  for (const echo of game.echoes) {
    if (echo.phase === 'solid') rects.push({ id: echo.id, x: echo.x, y: echo.y, w: echo.w, h: echo.h, role: 'echo' });
  }
  return rects;
}

export function update(game, input = {}, dt = 1 / 60) {
  game.events = [];
  if (input.restart) return createGame({ echoes: game.echoesEnabled, level: game.levelIndex, seed: game.seed, challenge: game.challengeEnabled });
  if (input.next && game.status === 'won' && Number.isInteger(game.levelIndex) && game.levelIndex < LEVELS.length - 1) {
    return createGame({ echoes: game.echoesEnabled, level: game.levelIndex + 1, seed: game.seed, challenge: game.challengeEnabled });
  }

  dt = clamp(dt, 0, 1 / 20);
  if (dt === 0 || game.status !== 'playing') return game;

  game.noticeTime = Math.max(0, game.noticeTime - dt);
  game.time += dt;
  game.timeLeft = Math.max(0, game.timeLeft - dt);
  if (game.timeLeft <= 0) {
    return lose(game, 'timeout');
  }

  const player = game.player;
  if (input.anchor && !game.prevAnchor) toggleAnchor(game);
  game.prevAnchor = !!input.anchor;
  const startedGrounded = player.grounded;
  const jumpDown = !!input.jump;
  const jumpPressed = jumpDown && !game.prevJump;
  game.prevJump = jumpDown;

  if (input.left && !input.right) {
    player.vx = -PHYSICS.moveSpeed;
    player.facing = -1;
    game.runGrace = 0.18;
  } else if (input.right && !input.left) {
    player.vx = PHYSICS.moveSpeed;
    player.facing = 1;
    game.runGrace = 0.18;
  } else {
    game.runGrace = Math.max(0, game.runGrace - dt);
    if (player.grounded && game.runGrace <= 0 && !jumpPressed) player.vx = 0;
  }

  if (jumpPressed) game.jumpBuffer = PHYSICS.jumpBuffer;
  else game.jumpBuffer = Math.max(0, game.jumpBuffer - dt);

  if (player.grounded) game.coyote = PHYSICS.coyote;
  else game.coyote = Math.max(0, game.coyote - dt);

  if (game.jumpBuffer > 0 && (player.grounded || game.coyote > 0)) {
    game.flightBridgeId = null;
    const launchTop = player.grounded
      ? supportTop(game, player.supportId) ?? player.y + PLAYER.h
      : player.y + PLAYER.h;
    // One echo per *actual* jump (not keydown). A failed airborne press makes none.
    if (game.echoMode === 'flow' && game.echoesEnabled) {
      if (game.challengeEnabled && game.route?.revealed) {
        // Same two-choice rule on every advanced takeoff, including jumps
        // toward existing ledges. No position-dependent mode switch.
        queueAirborneBridge(game);
      } else {
        const tutorial = game.challengeEnabled && game.route && !game.route.revealed
          ? predictEcho(game) : null;
        const created = stamp(game, player, launchTop);
        if (game.challengeEnabled) game.flightBridgeId = created;
        if (tutorial) {
          // The initial wide-bridge lesson is the only one-candidate jump.
          // Freeze this preview too, so it does not slide with the player.
          game.airborneCue = {
            options: { near: tutorial }, phase: 'tutorial', selected: 'near',
          };
        }
      }
    }
    player.vy = -PHYSICS.jumpSpeed;
    player.grounded = false;
    player.supportId = null;
    game.coyote = 0;
    game.jumpBuffer = 0;
    game.jumpHeld = true;
    game.events.push({ type: 'jump' });
  } else if (!jumpDown && game.jumpHeld && player.vy < 0) {
    player.vy *= PHYSICS.jumpCut;
    game.jumpHeld = false;
  }
  if (player.vy >= 0) game.jumpHeld = false;

  player.x += player.vx * dt;
  player.x = clamp(player.x, 10, WORLD.w - PLAYER.w - 10);

  player.vy = Math.min(PHYSICS.maxFall, player.vy + PHYSICS.gravity * dt);
  const prevBottom = player.y + PLAYER.h;
  player.y += player.vy * dt;

  player.grounded = false;
  let landedOn = null;
  revealAirborneBridge(game);
  if (player.vy >= 0) {
    const feet = player.y + PLAYER.h;
    let best = null;
    for (const rect of solidRects(game)) {
      const overlapX = player.x + PLAYER.w - 2 > rect.x && player.x + 2 < rect.x + rect.w;
      const crossed = prevBottom <= rect.y + 8 && feet >= rect.y && prevBottom <= rect.y + rect.h + 8;
      if (!overlapX || !crossed) continue;
      if (!best || rect.y < best.y) best = rect;
    }
    if (best) {
      player.y = best.y - PLAYER.h;
      player.vy = 0;
      player.grounded = true;
      player.supportId = best.id;
      landedOn = best;
    }
  }

  if (!player.grounded) {
    game.airTime += dt;
  } else if (!startedGrounded && landedOn) {
    // A preview is not a bridge that can be banked for the next hop:
    // only catching the just-created echo with this jump grants its lifespan.
    // An uncaught echo becomes immediately non-solid and fades out, leaving
    // previously earned bridges and anchored platforms untouched.
    if (game.challengeEnabled && game.flightBridgeId
      && landedOn.id !== game.flightBridgeId) {
      const missed = game.echoes.find(echo => echo.id === game.flightBridgeId);
      if (missed && missed.phase === 'solid') {
        missed.phase = 'sink';
        missed.age = 0;
        game.events.push({ type: 'bridge_missed', id: missed.id });
      }
    }
    game.flightBridgeId = null;
    game.airborneCue = null;
    const air = game.airTime;
    game.airTime = 0;
    game.events.push({ type: 'land', id: landedOn.id });
    if (String(landedOn.id).startsWith('echo')) {
      game.stats.echoLandings += 1;
      if (game.route && !game.route.revealed && game.echoesEnabled) {
        const chosen = chooseRoute(game.seed, game.levelIndex);
        game.route.revealed = true;
        game.route.side = chosen.side;
        game.level.objective = chosen.objective;
        game.events.push({ type: 'route_reveal', side: chosen.side });
        notify(game, `潮印已显现 · ${chosen.side === 'left' ? '向左岸' : '向右岸'}！`);
      }
    }
    if (game.echoesEnabled && game.echoMode === 'legacy' && air >= PHYSICS.minAirToStamp) stamp(game, player, landedOn.y);
  } else {
    game.airTime = 0;
  }

  if (!player.grounded) player.supportId = null;

  advanceEchoes(game, dt);

  if (!game.objectiveCollected && game.level.objective && overlaps(playerRect(player), game.level.objective)) {
    game.objectiveCollected = true;
    game.events.push({ type: 'collect' });
    notify(game, game.levelIndex === 0 ? '潮灯已点亮 · 朝右造路！' : '核心已取得 · 返回右侧出口！');
  }

  if (overlaps(playerRect(player), game.exit) && game.objectiveCollected) {
    game.status = 'won';
    game.reason = 'exit';
    game.events.push({ type: 'win' });
    return game;
  }

  if (player.y + PLAYER.h >= KILL_Y) return lose(game, 'fall');
  return game;
}

function stamp(game, player, surfaceTop, overrideRect = null, facing = player.facing) {
  const rect = overrideRect ?? flowEchoRect(game, player.x + PLAYER.w / 2, surfaceTop, facing);
  const phase = game.echoMode === 'flow' ? 'solid' : 'rise';
  game.stats[facing < 0 ? 'leftStamps' : 'rightStamps'] += 1;
  const existing = game.echoes.find((echo) => (
    echo.phase !== 'sink'
    && Math.abs(echo.x - rect.x) < 28
    && Math.abs(echo.y - rect.y) < 22
  ));
  if (existing) {
    // A retained bridge must never move or become intangible on a repeat stamp.
    if (existing.id === game.anchorId) return null;
    existing.x = rect.x;
    existing.y = rect.y;
    existing.phase = phase;
    existing.age = 0;
    game.stats.stamps += 1;
    game.events.push({ type: 'stamp', id: existing.id, refreshed: true });
    return null; // An existing bridge belongs to a previous successful hop.
  }

  const echo = {
    id: `echo-${game.nextId}`,
    ...rect,
    phase,
    age: 0,
  };
  game.nextId += 1;
  game.echoes.push(echo);
  game.stats.stamps += 1;
  game.events.push({ type: 'stamp', id: echo.id });

  const risingOrSolid = game.echoes.filter((item) => item.phase !== 'sink');
  if (risingOrSolid.length > ECHO.maxAlive) {
    const oldest = risingOrSolid.find((item) => item.id !== game.anchorId);
    oldest.phase = 'sink';
    oldest.age = 0;
    game.events.push({ type: 'sink', id: oldest.id, forced: true });
  }
  return echo.id;
}

function advanceEchoes(game, dt) {
  const kept = [];
  for (const echo of game.echoes) {
    const before = echo.phase;
    if (echo.id !== game.anchorId) echo.age += dt;
    let guard = 0;
    while (echo.age >= phaseTime(echo.phase) && guard < 4) {
      echo.age -= phaseTime(echo.phase);
      if (echo.phase === 'rise') echo.phase = 'solid';
      else if (echo.phase === 'solid') echo.phase = 'sink';
      else {
        echo.phase = 'dead';
        break;
      }
      guard += 1;
    }
    if (echo.phase === 'dead') continue;
    if (before !== 'solid' && echo.phase === 'solid') game.events.push({ type: 'solid', id: echo.id });
    if (before !== 'sink' && echo.phase === 'sink') game.events.push({ type: 'sink', id: echo.id });
    kept.push(echo);
  }
  game.echoes = kept;
}

function toggleAnchor(game) {
  if (!game.level.anchor) return;
  const echo = game.player.grounded && game.echoes.find((item) => item.id === game.player.supportId && item.phase === 'solid');
  if (!echo) {
    notify(game, '站在实心回声上按 E 锚定');
    return;
  }
  const old = game.echoes.find((item) => item.id === game.anchorId);
  game.anchorId = game.anchorId === echo.id ? null : echo.id;
  if (game.anchorId) game.stats.anchors += 1;
  notify(game, game.anchorId ? (old ? `锚已转移 · 旧平台余 ${(ECHO.solid - old.age).toFixed(1)} 秒` : '已锚定 · 此平台暂停消失') : `已松锚 · 余 ${(ECHO.solid - echo.age).toFixed(1)} 秒`);
  game.events.push({ type: 'anchor' });
}

function notify(game, message) {
  game.notice = message;
  game.noticeTime = 3;
}

function phaseTime(phase) {
  if (phase === 'rise') return ECHO.rise;
  if (phase === 'solid') return ECHO.solid;
  return ECHO.sink;
}

function supportTop(game, id) {
  if (!id) return null;
  const solid = solidRects(game).find((rect) => rect.id === id);
  return solid ? solid.y : null;
}

function lose(game, reason) {
  game.status = 'lost';
  game.reason = reason;
  game.events.push({ type: 'lose', reason });
  return game;
}

function inflate(rect, pad) {
  return { x: rect.x - pad, y: rect.y - pad, w: rect.w + pad * 2, h: rect.h + pad * 2 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
