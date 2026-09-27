import { ECHO, KILL_Y, WORLD, predictEcho } from './game.js';

const FONT = '"WenQuanYi Micro Hei", "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif';

const motes = [];
let squash = 0;

export function draw(ctx, game) {
  squash = Math.max(0, squash - 1 / 60);
  for (const event of game.events) {
    if (event.type === 'land') squash = 0.12;
    if (event.type === 'stamp') burst(game.player.x + 14, game.player.y + 36, '#b8fff0', 10);
    if (event.type === 'solid') {
      const echo = game.echoes.find((item) => item.id === event.id);
      if (echo) burst(echo.x + echo.w / 2, echo.y, '#efe7ff', 14);
    }
    if (event.type === 'win') burst(game.exit.x + 20, game.exit.y + 20, '#ffd78a', 18);
  }
  if (game.time < 0.02 && game.echoes.length === 0) motes.length = 0;

  drawSky(ctx, game);
  drawWater(ctx, game);
  if (game.status === 'playing' && game.player.grounded) drawPrediction(ctx, game);
  for (const echo of game.echoes) {
    if (echo.phase === 'rise') drawEcho(ctx, game, echo);
  }
  for (const platform of game.platforms) drawPlatform(ctx, platform);
  for (const echo of game.echoes) {
    if (echo.phase !== 'rise') drawEcho(ctx, game, echo);
  }
  drawExit(ctx, game);
  drawSigns(ctx, game);
  drawPlayer(ctx, game);
  drawMotes(ctx);
  drawHud(ctx, game);
  if (game.status !== 'playing') drawOverlay(ctx, game);
}

function drawSky(ctx, game) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  sky.addColorStop(0, '#071018');
  sky.addColorStop(0.45, '#0c2a32');
  sky.addColorStop(1, '#11464a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  ctx.fillStyle = 'rgba(232, 255, 246, 0.85)';
  ctx.beginPath();
  ctx.arc(468, 86, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(232, 255, 246, 0.08)';
  ctx.beginPath();
  ctx.arc(468, 86, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(158, 231, 216, 0.08)';
  ctx.lineWidth = 1;
  for (let band = 0; band < 6; band += 1) {
    ctx.beginPath();
    const base = 150 + band * 52;
    for (let x = 0; x <= WORLD.w; x += 6) {
      const y = base + Math.sin(x * 0.02 + game.time * 0.7 + band) * (3 + band);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawWater(ctx, game) {
  const crest = 500;
  const gradient = ctx.createLinearGradient(0, crest, 0, WORLD.h);
  gradient.addColorStop(0, 'rgba(14, 140, 146, 0.55)');
  gradient.addColorStop(1, 'rgba(4, 40, 48, 0.95)');
  ctx.beginPath();
  ctx.moveTo(0, WORLD.h);
  for (let x = 0; x <= WORLD.w; x += 8) {
    const y = crest + Math.sin(x * 0.035 + game.time * 2.2) * 4 + Math.sin(x * 0.01 - game.time) * 2;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WORLD.w, WORLD.h);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = 'rgba(217, 255, 246, 0.55)';
  ctx.textAlign = 'left';
  ctx.fillText('潮底  the tide', 20, KILL_Y - 2);
}

function drawPlatform(ctx, platform) {
  const goal = platform.role === 'goal';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  roundRect(ctx, platform.x, platform.y + 5, platform.w, platform.h, 5);
  ctx.fill();

  const body = ctx.createLinearGradient(0, platform.y, 0, platform.y + platform.h);
  if (goal) {
    body.addColorStop(0, '#ffe1a3');
    body.addColorStop(1, '#c9843a');
  } else {
    body.addColorStop(0, '#2f6d72');
    body.addColorStop(1, '#173e44');
  }
  ctx.fillStyle = body;
  roundRect(ctx, platform.x, platform.y, platform.w, platform.h, 5);
  ctx.fill();

  ctx.fillStyle = goal ? '#fff4d2' : '#b7f3e6';
  roundRect(ctx, platform.x, platform.y, platform.w, 4, 3);
  ctx.fill();
}

function drawEcho(ctx, game, echo) {
  const rising = echo.phase === 'rise';
  const sinking = echo.phase === 'sink';
  const t = rising ? echo.age / ECHO.rise : sinking ? echo.age / ECHO.sink : echo.age / ECHO.solid;
  const y = rising
    ? echo.y + (1 - ease(t)) * ECHO.riseFrom
    : sinking
      ? echo.y + t * 48
      : echo.y;
  const alpha = rising ? 0.28 + 0.4 * t : sinking ? 1 - t : 1;

  if (rising) {
    ctx.save();
    ctx.strokeStyle = `rgba(190, 255, 236, ${0.45 + 0.4 * Math.sin(game.time * 8)})`;
    ctx.setLineDash([5, 5]);
    ctx.lineDashOffset = -game.time * 24;
    ctx.lineWidth = 1.5;
    roundRect(ctx, echo.x, echo.y, echo.w, echo.h, 5);
    ctx.stroke();
    ctx.restore();
    label(ctx, echo.x + echo.w / 2, echo.y - 18, '显形 forming', 'rgba(217, 255, 246, 0.9)');
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  const fill = ctx.createLinearGradient(echo.x, y, echo.x, y + echo.h);
  if (echo.phase === 'solid') {
    const warn = t > 0.62;
    fill.addColorStop(0, warn ? '#ffe1a8' : '#d8fff4');
    fill.addColorStop(1, warn ? '#d07a4a' : '#7a5cff');
  } else {
    fill.addColorStop(0, '#d8fff4');
    fill.addColorStop(1, '#6e56d8');
  }
  ctx.fillStyle = fill;
  roundRect(ctx, echo.x, y, echo.w, echo.h, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  roundRect(ctx, echo.x + 6, y + 2, echo.w - 12, 3, 2);
  ctx.fill();
  ctx.restore();

  if (echo.phase === 'solid') {
    const remain = 1 - t;
    ctx.fillStyle = 'rgba(7, 16, 24, 0.45)';
    ctx.fillRect(echo.x, echo.y - 8, echo.w, 3);
    ctx.fillStyle = remain < 0.35 ? '#ffb089' : '#9ef6df';
    ctx.fillRect(echo.x, echo.y - 8, echo.w * remain, 3);
  }
}

function drawPrediction(ctx, game) {
  const ghost = predictEcho(game);
  const crowded = game.echoes.some((echo) => Math.abs(echo.x - ghost.x) < 20 && Math.abs(echo.y - ghost.y) < 16);
  if (crowded) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(184, 255, 240, 0.35)';
  ctx.setLineDash([3, 6]);
  ctx.lineWidth = 1;
  roundRect(ctx, ghost.x, ghost.y, ghost.w, ghost.h, 5);
  ctx.stroke();
  ctx.restore();
}

function drawExit(ctx, game) {
  const gate = game.exit;
  const pulse = 0.55 + Math.sin(game.time * 3) * 0.2;
  ctx.fillStyle = `rgba(255, 197, 107, ${0.12 + pulse * 0.1})`;
  ctx.fillRect(gate.x - 6, gate.y - 6, gate.w + 12, gate.h + 10);
  ctx.fillStyle = '#ffd78a';
  ctx.fillRect(gate.x, gate.y, 6, gate.h);
  ctx.fillRect(gate.x + gate.w - 6, gate.y, 6, gate.h);
  ctx.fillRect(gate.x, gate.y, gate.w, 6);
  ctx.fillStyle = `rgba(255, 236, 196, ${pulse})`;
  ctx.fillRect(gate.x + 10, gate.y + 12, gate.w - 20, gate.h - 18);
  label(ctx, gate.x + gate.w / 2, gate.y - 18, '出口 EXIT', '#ffe7b5');
}

function drawSigns(ctx, game) {
  const mid = game.platforms.find((platform) => platform.id === 'mid');
  const waiting = !game.echoes.some((echo) => echo.phase !== 'rise' || echo.age > 0.2);
  if (!mid || !waiting || game.stats.echoLandings > 0) return;
  label(ctx, mid.x + mid.w / 2, mid.y - 22, '在此朝右落地 · land facing right', '#d9fff6');
}

function drawPlayer(ctx, game) {
  const player = game.player;
  const stretch = player.grounded ? 1 - squash * 1.4 : 1 + Math.min(0.12, Math.abs(player.vy) / 6000);
  const height = 36 * stretch;
  const y = player.y + (36 - height);
  const bob = player.grounded ? Math.sin(game.time * 7) * 0.7 : 0;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(player.x + 14, player.y + 38, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  const finX = player.facing > 0 ? player.x - 6 : player.x + 22;
  ctx.fillStyle = '#e07a55';
  ctx.beginPath();
  ctx.moveTo(player.x + 14, y + 16 + bob);
  ctx.lineTo(finX, y + 10 + bob);
  ctx.lineTo(finX, y + 26 + bob);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffb089';
  roundRect(ctx, player.x + 4, y + 10 + bob, 20, height - 12, 8);
  ctx.fill();
  ctx.fillStyle = '#143f3d';
  ctx.beginPath();
  ctx.arc(player.x + 14, y + 12 + bob, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9fff6';
  ctx.beginPath();
  const eyeX = player.x + 14 + player.facing * 2;
  ctx.arc(eyeX, y + 12 + bob, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHud(ctx, game) {
  ctx.fillStyle = 'rgba(6, 14, 18, 0.72)';
  roundRect(ctx, 12, 10, WORLD.w - 24, 58, 8);
  ctx.fill();

  ctx.font = `13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e7fff8';
  ctx.fillText('←→ / A D 移动 move    空格 / W / ↑ 跳跃 jump    R 重开 restart', 24, 18);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = '#b7e4dc';
  ctx.fillText('落地后回声延迟升起成平台，再下沉。请面朝出口。  Landings stamp an echo that rises, then sinks. Face the exit.', 24, 40);

  const seconds = Math.ceil(game.timeLeft);
  ctx.textAlign = 'right';
  ctx.font = `13px ${FONT}`;
  ctx.fillStyle = seconds <= 15 ? '#ffb089' : '#ffe7b5';
  ctx.fillText(`潮汐 ${seconds}s`, WORLD.w - 24, 18);
}

function drawOverlay(ctx, game) {
  ctx.fillStyle = 'rgba(4, 10, 14, 0.55)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.fillStyle = 'rgba(10, 28, 32, 0.94)';
  roundRect(ctx, 250, 176, 460, 176, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(184, 255, 240, 0.35)';
  ctx.stroke();

  const won = game.status === 'won';
  const title = won ? '抵达出口' : game.reason === 'timeout' ? '潮汐退尽' : '坠入潮底';
  const sub = won ? 'You reached the exit' : game.reason === 'timeout' ? 'The tide ran out' : 'Fell into the tide';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `28px ${FONT}`;
  ctx.fillStyle = won ? '#ffe7b5' : '#ffb089';
  ctx.fillText(title, WORLD.w / 2, 206);
  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = '#d9fff6';
  ctx.fillText(sub, WORLD.w / 2, 248);
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = '#9ec7c0';
  ctx.fillText('按 R 或点击重开   ·   Press R or click to restart', WORLD.w / 2, 292);
}

function drawMotes(ctx) {
  for (let i = motes.length - 1; i >= 0; i -= 1) {
    const mote = motes[i];
    mote.life -= 1 / 60;
    mote.x += mote.vx;
    mote.y += mote.vy;
    mote.vy += 0.02;
    if (mote.life <= 0) {
      motes.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = Math.max(0, mote.life * 2);
    ctx.fillStyle = mote.color;
    ctx.fillRect(mote.x, mote.y, 2, 2);
    ctx.globalAlpha = 1;
  }
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    motes.push({
      x,
      y,
      vx: Math.cos(angle) * (0.6 + (i % 3) * 0.35),
      vy: Math.sin(angle) * 0.7 - 0.8,
      life: 0.45,
      color,
    });
  }
}

function label(ctx, x, y, text, color) {
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function ease(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}
