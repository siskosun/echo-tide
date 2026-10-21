/** ET-VISUAL-02: external, readable state mirror for tiny portrait viewports.
 * All semantics come from the real game state and authoritative forecast.
 * UI-only module. No mutation of game state, no approval semantics.
 */
import { airborneForecast, echoMotionPlan } from './game.js';

export function describeVisualHud(game) {
  const level = Number.isInteger(game.levelIndex) ? `${game.levelIndex + 1}/3` : '练习';
  const seconds = `${Math.max(0, Math.ceil(game.timeLeft))}s`;
  if (game.status === 'lost') return { level, seconds, status: '失败', cue: '坠落或超时 · 重试本关', state: 'lost' };
  if (game.status === 'won') return { level, seconds, status: '通关', cue: '本关完成 · 继续或重试', state: 'won' };

  const reveal = game.route?.revealed === true;
  const status = game.objectiveCollected ? '潮印已获得' : reveal
    ? `潮印：${game.route.side === 'left' ? '左岸' : '右岸'}` : '潮印待揭晓';
  if (game.noticeTime > 0 && game.notice && /阻|不|失败|空间不足/.test(game.notice)) {
    return { level, seconds, status, cue: game.notice, state: 'notice' };
  }
  if (!reveal) return { level, seconds, status, cue: '首跳教学 · 安全落脚后揭晓潮印', state: 'tutorial' };
  if (game.objectiveCollected) return { level, seconds, status, cue: '目标已取得 · 前往出口', state: 'objective' };
  if (game.challengeEnabled) {
    const forecast = game.player.grounded ? airborneForecast(game) : game.airborneCue;
    const active = game.flightBridgeId && game.echoes.find(e => e.id === game.flightBridgeId);
    if (forecast?.blocked || forecast?.phase === 'blocked' || forecast?.selected === null) {
      return { level, seconds, status, cue: '跳跃空间不足 · 移动或转身', state: 'blocked' };
    }
    const motion = active?.motion?.active || (game.player.grounded && forecast?.target?.role === 'echo'
      && echoMotionPlan(game, forecast.target)?.active);
    if (motion) return { level, seconds, status, cue: '目标沿亮轨移动 · 看准时机接桥', state: 'rail' };
    if (forecast?.target) return { level, seconds, status, cue: '落点已提前确定 · 朝目标横跳', state: 'forecast' };
    return { level, seconds, status, cue: '观察落脚区域 · 保持移动', state: 'airborne' };
  }
  return { level, seconds, status, cue: '看准回声平台 · 稳住落脚', state: 'standard' };
}

let lastVisualKey = '';
export function renderVisualHud(game) {
  const root = document.getElementById('et-readable-hud');
  if (!root) return;
  const data = describeVisualHud(game);
  const key = [data.level, data.seconds, data.status, data.cue, data.state].join('\u001f');
  if (key === lastVisualKey) return;
  lastVisualKey = key;
  root.dataset.state = data.state;
  document.getElementById('et-hud-level').textContent = `关卡 ${data.level}`;
  document.getElementById('et-hud-time').textContent = `潮汐 ${data.seconds}`;
  document.getElementById('et-hud-goal').textContent = data.status;
  document.getElementById('et-hud-cue').textContent = data.cue;
}
