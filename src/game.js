/** Echo Tide / 叠影潮 — headless rules for the one-screen prototype. */

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
  rise: 0.7,
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
  const start = PLATFORMS[0];
  return {
    status: 'playing',
    reason: null,
    time: 0,
    timeLeft: TIME_LIMIT,
    echoesEnabled: options.echoes !== false,
    nextId: 1,
    airTime: 0,
    coyote: PHYSICS.coyote,
    jumpBuffer: 0,
    prevJump: false,
    jumpHeld: false,
    runGrace: 0,
    events: [],
    stats: { stamps: 0, echoLandings: 0 },
    exit: { ...EXIT },
    platforms: PLATFORMS.map((platform) => ({ ...platform })),
    echoes: [],
    player: {
      x: SPAWN.x,
      y: SPAWN.y,
      vx: 0,
      vy: 0,
      facing: 1,
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

export function echoRect(centerX, surfaceTop, facing) {
  let x = centerX + facing * ECHO.shiftX - ECHO.w / 2;
  let y = surfaceTop + ECHO.shiftY;
  x = clamp(x, 18, WORLD.w - ECHO.w - 18);
  y = clamp(y, 48, KILL_Y - 70);
  for (let i = 0; i < 6; i += 1) {
    const hit = PLATFORMS.find((platform) => overlaps({ x, y, w: ECHO.w, h: ECHO.h }, inflate(platform, 4)));
    if (!hit) break;
    y = hit.y - ECHO.h - 12;
  }
  return {
    x: clamp(x, 18, WORLD.w - ECHO.w - 18),
    y: clamp(y, 48, KILL_Y - 70),
    w: ECHO.w,
    h: ECHO.h,
  };
}

/** Where an echo would be stamped if the player landed at the current spot. */
export function predictEcho(game) {
  const player = game.player;
  const surfaceTop = player.grounded
    ? supportTop(game, player.supportId) ?? player.y + PLAYER.h
    : player.y + PLAYER.h;
  return echoRect(player.x + PLAYER.w / 2, surfaceTop, player.facing);
}

export function solidRects(game) {
  const rects = game.platforms.map((platform) => ({ ...platform }));
  for (const echo of game.echoes) {
    if (echo.phase === 'solid') rects.push({ id: echo.id, x: echo.x, y: echo.y, w: echo.w, h: echo.h, role: 'echo' });
  }
  return rects;
}

export function update(game, input = {}, dt = 1 / 60) {
  if (input.restart) return createGame({ echoes: game.echoesEnabled });

  dt = clamp(dt, 0, 1 / 20);
  if (dt === 0 || game.status !== 'playing') return game;

  game.events = [];
  game.time += dt;
  game.timeLeft = Math.max(0, game.timeLeft - dt);
  if (game.timeLeft <= 0) {
    return lose(game, 'timeout');
  }

  const player = game.player;
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
    const air = game.airTime;
    game.airTime = 0;
    game.events.push({ type: 'land', id: landedOn.id });
    if (String(landedOn.id).startsWith('echo')) game.stats.echoLandings += 1;
    if (game.echoesEnabled && air >= PHYSICS.minAirToStamp) stamp(game, player, landedOn.y);
  } else {
    game.airTime = 0;
  }

  if (!player.grounded) player.supportId = null;

  advanceEchoes(game, dt);

  if (overlaps(playerRect(player), game.exit)) {
    game.status = 'won';
    game.reason = 'exit';
    game.events.push({ type: 'win' });
    return game;
  }

  if (player.y + PLAYER.h >= KILL_Y) return lose(game, 'fall');
  return game;
}

function stamp(game, player, surfaceTop) {
  const rect = echoRect(player.x + PLAYER.w / 2, surfaceTop, player.facing);
  const existing = game.echoes.find((echo) => (
    echo.phase !== 'sink'
    && Math.abs(echo.x - rect.x) < 28
    && Math.abs(echo.y - rect.y) < 22
  ));
  if (existing) {
    existing.x = rect.x;
    existing.y = rect.y;
    existing.phase = 'rise';
    existing.age = 0;
    game.stats.stamps += 1;
    game.events.push({ type: 'stamp', id: existing.id, refreshed: true });
    return;
  }

  const echo = {
    id: `echo-${game.nextId}`,
    ...rect,
    phase: 'rise',
    age: 0,
  };
  game.nextId += 1;
  game.echoes.push(echo);
  game.stats.stamps += 1;
  game.events.push({ type: 'stamp', id: echo.id });

  const risingOrSolid = game.echoes.filter((item) => item.phase !== 'sink');
  if (risingOrSolid.length > ECHO.maxAlive) {
    const oldest = risingOrSolid[0];
    oldest.phase = 'sink';
    oldest.age = 0;
    game.events.push({ type: 'sink', id: oldest.id, forced: true });
  }
}

function advanceEchoes(game, dt) {
  const kept = [];
  for (const echo of game.echoes) {
    const before = echo.phase;
    echo.age += dt;
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
