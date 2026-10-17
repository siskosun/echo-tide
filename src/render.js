import { ECHO, KILL_Y, WORLD, SURF, predictEcho, airborneForecast, canPlaceFlowEcho } from './game.js';

const FONT = '"WenQuanYi Micro Hei", "Noto Sans CJK SC", "Microsoft YaHei", system-ui, sans-serif';

const motes = [];
let squash = 0;

export function draw(ctx, game) {
  squash = Math.max(0, squash - 1 / 60);
  for (const event of game.events) {
    if (event.type === 'land') squash = 0.12;
    if (event.type === 'precision' && game.surfEnabled) {
      burst(game.player.x + 14, game.player.y + 30, '#aefbdc', 8);
    }
    if (event.type === 'stamp' && game.echoMode === 'legacy') burst(game.player.x + 14, game.player.y + 36, '#b8fff0', 10);
    if (event.type === 'solid') {
      const echo = game.echoes.find((item) => item.id === event.id);
      if (echo) burst(echo.x + echo.w / 2, echo.y, '#efe7ff', 14);
    }
    if (event.type === 'win') burst(game.exit.x + 20, game.exit.y + 20, '#ffd78a', 18);
  }
  if (game.time < 0.02 && game.echoes.length === 0) motes.length = 0;

  drawSky(ctx, game);
  drawWater(ctx, game);
  for (const echo of game.echoes) {
    if (echo.phase === 'rise') drawEcho(ctx, game, echo);
  }
  for (const platform of game.platforms) drawPlatform(ctx, platform);
  for (const echo of game.echoes) {
    if (echo.phase !== 'rise') drawEcho(ctx, game, echo);
  }
  if (game.echoMode === 'flow' && game.status === 'playing'
      && (game.player.grounded || game.pendingEcho || game.airborneCue) && game.echoesEnabled) {
    drawLaunchForecast(ctx, game);
  }
  drawExit(ctx, game);
  drawObjective(ctx, game);
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

function drawLaunchForecast(ctx, game) {
  if (game.challengeEnabled && game.route?.revealed) {
    // Preview and real takeoff use the SAME deterministic selection.
    const cue = game.airborneCue;
    const forecast = cue ?? airborneForecast(game);
    if (forecast.phase === 'blocked' || forecast.blocked || forecast.selected === null) {
      label(ctx, Math.max(130, Math.min(WORLD.w - 130, game.player.x + 14)),
        Math.max(106, game.player.y - 22),
        '跳跃空间不足 · 移动或转身', '#ffb089');
      return;
    }
    const { options, selected } = forecast;
    const rect = options[selected];
    const stone = rect.role === 'stone';
    ctx.save();
    ctx.strokeStyle = stone ? '#9af2e2' : '#e8ffad';
    ctx.fillStyle = stone ? 'rgba(56, 148, 133, 0.10)' : 'rgba(232, 255, 173, 0.14)';
    ctx.lineWidth = 3;
    ctx.setLineDash(stone ? [] : [6, 4]);
    if (!stone) ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (game.surfEnabled && !stone) {
      const zone = Math.min(SURF.centerToleranceMax, rect.w * SURF.centerFraction) * 2;
      ctx.setLineDash([]);
      ctx.fillStyle = '#aefbdc';
      ctx.fillRect(rect.x + (rect.w - zone) / 2, rect.y - 2, zone, 5);
    }
    ctx.restore();
    label(ctx, Math.max(130, Math.min(WORLD.w - 130, rect.x + rect.w / 2)),
      Math.max(106, rect.y - 24), '目标已确定 · 向前横跳', '#e8ffad');
    return;
  }
  const rect = game.airborneCue?.phase === 'tutorial'
    ? game.airborneCue.options.near : predictEcho(game);
  if (game.player.grounded && game.echoMode === 'flow'
    && !canPlaceFlowEcho(game, rect)) {
    label(ctx, Math.max(130, Math.min(WORLD.w - 130, game.player.x + 14)),
      Math.max(106, game.player.y - 22),
      '无法从这里跨越 · 先调整站位', '#ffb089');
    return;
  }
  ctx.save();
  ctx.strokeStyle = '#ffe7b5';
  ctx.fillStyle = 'rgba(255, 231, 181, 0.13)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([9, 6]);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  label(ctx, rect.x + rect.w / 2, rect.y - 18,
    game.challengeEnabled ? '首跳教学：固定宽桥 · 落脚后预告真实目标' : '起跳立即成桥', '#ffe7b5');
}

function drawEcho(ctx, game, echo) {
  const rising = echo.phase === 'rise';
  const sinking = echo.phase === 'sink';
  const t = rising ? echo.age / ECHO.rise : sinking ? echo.age / ECHO.sink : echo.age / ECHO.solid;
  const y = rising
    ? echo.y + (1 - ease(t)) * ECHO.riseFrom
    : sinking && game.echoMode === 'legacy'
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

  if (game.surfEnabled && echo.phase === 'solid') {
    const zone = Math.min(SURF.centerToleranceMax, echo.w * SURF.centerFraction) * 2;
    ctx.fillStyle = '#aefbdc';
    ctx.fillRect(echo.x + (echo.w - zone) / 2, echo.y - 2, zone, 5);
  }

  if (echo.phase === 'solid') {
    const remain = 1 - t;
    ctx.fillStyle = 'rgba(7, 16, 24, 0.45)';
    ctx.fillRect(echo.x, echo.y - 8, echo.w, 3);
    ctx.fillStyle = remain < 0.35 ? '#ffb089' : '#9ef6df';
    ctx.fillRect(echo.x, echo.y - 8, echo.w * remain, 3);
    label(ctx, echo.x + echo.w / 2, echo.y - 14,
      echo.id === game.anchorId ? '⚓ 已锚定 · E 松开' : `${(ECHO.solid - echo.age).toFixed(1)} 秒`,
      echo.id === game.anchorId ? '#ffe7b5' : '#d9fff6');
    if (echo.id === game.anchorId) {
      ctx.strokeStyle = '#ffe7b5';
      ctx.lineWidth = 2;
      ctx.strokeRect(echo.x - 2, echo.y - 2, echo.w + 4, echo.h + 4);
    }
  }
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
  label(ctx, gate.x + gate.w / 2, gate.y - 8, game.objectiveCollected ? '出口' : '出口 · 未开启', '#ffe7b5');
  if (!game.objectiveCollected) {
    ctx.fillStyle = '#173e44';
    ctx.fillRect(gate.x + 6, gate.y + 6, gate.w - 12, gate.h - 6);
    label(ctx, gate.x + gate.w / 2, gate.y + 40, game.route && !game.route.revealed ? '潮印待揭晓' : '待取潮印', '#ffe7b5');
  }
}

function drawSigns(ctx, game) {
  if (game.noticeTime > 0) label(ctx, WORLD.w / 2, 106, game.notice, '#ffe7b5');
  else if (game.stats.stamps === 0) {
    const start = game.platforms[0];
    label(ctx, start.x + start.w / 2, start.y + 36, game.player.facing < 0 ? '← 起跳造桥，落地揭晓潮印' : '起跳造桥，落地揭晓潮印 →', '#d9fff6');
  }
}

function drawObjective(ctx, game) {
  const item = game.level.objective;
  if (!item) return;
  const x = item.x + item.w / 2;
  const y = item.y + item.h / 2;
  ctx.fillStyle = game.objectiveCollected ? '#7dd3b0' : '#ffd78a';
  ctx.beginPath();
  ctx.moveTo(x, y - 13); ctx.lineTo(x + 11, y); ctx.lineTo(x, y + 13); ctx.lineTo(x - 11, y); ctx.closePath(); ctx.fill();
  label(ctx, x, item.y - 8, game.objectiveCollected ? '已取得' : item.name, '#ffe7b5');
}

function drawPlayer(ctx, game) {
  const player = game.player;
  const stretch = player.grounded ? 1 - squash * 1.4 : 1 + Math.min(0.12, Math.abs(player.vy) / 6000);
  const height = 36 * stretch;
  const y = player.y + (36 - height);
  const bob = player.grounded ? Math.sin(game.time * 7) * 0.7 : 0;

  if (game.surfEnabled && game.dashTime > 0) {
    // Short local echo trail; never animate the destination platforms.
    ctx.fillStyle = 'rgba(174, 251, 220, 0.16)';
    const behind = game.dashDirection > 0 ? player.x - 27 : player.x + 28;
    ctx.fillRect(behind, player.y + 9, 27, 22);
  }
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
  ctx.fillText(`${Number.isInteger(game.levelIndex) ? `${game.levelIndex + 1} / 3` : '练习'}  ${game.level.title} · ${game.level.subtitle}`, 24, 18);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = '#b7e4dc';
  ctx.fillText(game.surfEnabled
    ? `踏浪冲刺：Shift/J 空中加速 · 踩新桥中央亮心补能 · 潮能${game.surgeCharge ? '●' : '○'} · 连击${game.precisionChain}`
    : game.echoMode === 'flow'
    ? (game.challengeEnabled && game.route?.revealed
      ? ((game.airborneCue?.phase === 'blocked' || (game.player.grounded && airborneForecast(game).blocked))
        ? '挑战：当前站位无法造桥 · 调整位置或转身'
        : '挑战：目标已确定 · 瞄准落点再跳 · 新桥须本跳接住')
      : game.route?.revealed
        ? `潮印在${game.route.side === 'left' ? '左岸 ←' : '右岸 →'} · 起跳即成桥 · E 锚定 / R 重试`
        : game.challengeEnabled
          ? '首跳：固定宽桥教学 · 此后每跳提前显示确定落点'
          : '起跳即成桥 · 首次落上回声才会揭示本局潮印位置')
    : `←→ 移动 · 空格 跳跃 · R 重开${game.level.anchor ? ' · E 锚定脚下回声' : ''}    回声：${ECHO.rise} 秒成形 / ${ECHO.solid} 秒消失 / 最多 ${ECHO.maxAlive} 块`, 24, 40);

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
  const final = game.levelIndex === 2;
  const title = won ? (final ? '借潮归航 · 三关完成' : `${game.level.title} · 完成`) : game.reason === 'timeout' ? '潮汐退尽' : '坠入潮底';
  const sub = won
    ? (game.surfEnabled
      ? `回声落脚 ${game.stats.echoLandings} · 潮跃 ${game.stats.dashes} · 精准 ${game.stats.preciseLandings} · 最佳连击 ${game.stats.bestChain}`
      : `回声落脚 ${game.stats.echoLandings} 次 · 锚定 ${game.stats.anchors} 次`)
    : '你的路线可以重来';
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
  ctx.fillText(won ? (final ? 'R 重试本关 · 关卡菜单可重新挑战' : 'Enter 下一关 · R 重试本关') : 'R / Enter / 点击画面 · 重试本关', WORLD.w / 2, 292);
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
