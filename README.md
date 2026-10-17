# Echo Tide / 叠影潮

One-screen browser platformer. The first jump creates a safe wide echo; subsequent jump targets are visibly determined BEFORE takeoff and appear immediately on takeoff. The challenge is steering and timing, not midair luck. The hidden left/right tide seal still reveals only after the first echo landing.

单屏平台跳跃。首跳是宽桥教学，之后每跳在起跳前就显示唯一真实落点，玩家瞄准后起跳；取消空中随机二选一。首块回声落脚后再揭示潮印路线。

## How to play

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

| Action | Keys |
| --- | --- |
| Move | Arrow keys or A / D |
| Jump | Space, W, or Up Arrow |
| Anchor / release the solid echo underfoot (rooms 2–3) | E |
| Restart current room | R; Enter / click canvas after a fall |
| Next room after winning | Enter or the Next button |
| Replay any room | Room selector above the canvas |
| Difficulty | Challenge (browser default) or Standard (for learning/comparison) |

Face the intended direction **before takeoff**. The first jump creates a wide, fixed tutorial bridge. On later Challenge jumps, the actual narrow target (or reachable real stone) is marked **before takeoff** and remains fixed throughout the jump; no target is randomly revealed in midair. The bridge appears solid on takeoff. Only a bridge landed on during its creating jump can be kept, so an idle jump cannot bank a platform. At world edges or above a nearly coincident narrow echo, no new bridge is created: a warning tells you to reposition or turn around. Small edge overlaps between adjacent narrow platforms are still allowed for normal jump tolerance. The departing earned bridge stays solid during the jump. A safe return to an expiring old bridge grants one bounded minimum 1.8-second retry, not infinite renewals. Rooms 2 and 3 retain one movable anchor (E); every room retains the 90-second limit.

**先看清目标再起跳**。挑战模式首跳是固定宽桥教学，之后会在地面提前显示唯一真实落点，起跳后平台立即成形，不再空中随机二选一。新桥必须在生成它的这一跳踩到，原地起跳无法储存新桥。贴着地图边缘，或试图在同一横向位置把窄桥叠成竖直台阶时，系统会明确提示调整站位或转身，且不会生成无效新桥；相邻落点仍可少量交叠，便于正常连跳。已获得的出发平台在腾空时受保护，落回临近到期旧桥可获得一次最少 1.8 秒的补救窗口，不能无限续时。第二、三关可按 E 锚定一块桥；三关仍各有 90 秒时限。首次落上回声后才揭示本局潮印。

## Three-room campaign / 三关体验

1. **折返接力**：先向左起跳造出第一块回声。潮印随后出现在左上接力台或右上目标台，两种位置需要不同的后续路线。
2. **留一条退路**：先向右架桥；潮印随后出现在左侧起点台或右侧目标台。可锚定桥梁，考虑何时回头或继续前进。
3. **借路归航**：先向左造出回声；潮印可能在左侧遗迹或右侧目标台出现。保留一块回声作为回程桥仍有价值。

Each room can be retried independently or selected from the menu. Progress is session-only; there is no save-file migration. Existing jump/movement constants are unchanged. Echoes meeting a fixed ledge align to its top, avoiding an extra hidden jump-height penalty.

### Playtest focus

Observe whether real players **correct their direction during flight** in hard mode without mistaking the cue for random punishment, whether they change destinations after the tide seal is revealed, and whether the minimal preview remains visually readable. Ask them to explain which seal appeared and whether the route choice felt meaningful, then separately check anchor understanding and reused bridges. Automated completion establishes reachability, not human understanding or fun; those remain the game-exp human Review.

## EXP-5: mid-run route-reveal pilot

[Issue #5](https://github.com/siskosun/echo-tide/issues/5) documents two consecutive rounds of authentic human critique: platform creation feels too late, an animated forming phase duplicates the preview, and the entire route looks knowable at the beginning.

The current branch provides a selectable skill challenge and route-planning uncertainty:

- **Landing skill:** A real landing position is visible before each jump. The player steers and times each jump; no hidden midair lottery. A new bridge cannot appear under the launch footprint or form a vertical wall staircase. A genuinely reachable neighboring landing remains permitted. Blocked positions display explicit feedback rather than a false preview.
- **Route objective:** at the start of each room, the tide seal is concealed. Once the player actually lands on their first echo, one of two **different, prevalidated safe ledge locations** is revealed. The corresponding tide seal must be collected for the exit to unlock. The objective branch itself does not create invisible death, but the separately selectable airborne landing challenge deliberately requires timely correction.
- **Uncertainty and reproducibility:** the browser draws a new 32-bit route seed from Web Crypto when possible, including each restart or room change. Headless test games use a fixed seed unless explicitly overridden. Both seeded outcomes can be reproduced in a diagnostic simulation. Seeded outcomes are not player preference measurements; the selected platform target is fully displayed before takeoff, while the post-tutorial tide-seal route remains hidden until its first earned landing.
- **Constraints:** maximum four concurrent echoes, five-second lifespan, anchor/transfer, three-room goals and fixed jump physics are preserved. The old sinusoidal tide shift was removed because it failed to change 108 tested first-jump decisions.

**Proof boundary:** deterministic tests can show that left/right objectives differ, a frozen action may miss an airborne option, and an adaptive input sequence can recover the landing. A separate all-input regression repeats the exact standstill-jump then wait and second-jump exploit: no candidate echo can be caught vertically and a missed echo becomes intangible on the first landing, while a same-jump catch stays solid. These are physics/regression checks, not evidence of enjoyment or perceived fairness. An input-only winning path under one seed does **not** prove both alternatives are independently completable; confirm both by playtest before a human PASS. More variation does not automatically imply greater enjoyment.


## Original experiment hypothesis (preserved for context)

The original EXP-1 mechanics were landing-triggered and delayed. The pre-existing game and campaign tests remain applicable to `classic` or are migrated when their assumptions concern the modified campaign mode.

## Stack

- Vite + vanilla JS
- `npm test` — original movement checks plus input-only winning routes for all three rooms, anchor lifetime/transfer/capacity checks, objective locks and progression/restart checks
- `npm run build` — production bundle to `dist/` (`dist/index.html`)

## Scripts

```bash
npm install
npm test
npm run build
npm run dev
```

## game-exp

This repository is prepared for [game-exp](https://github.com/siskosun) experiment control. EXP-5 gameplay resides on `exp/5` from immutable parent `aecd07cd0b84d29958aad0196840f20eb98fc1ad`. EXP-1, EXP-2 and EXP-3 are unchanged. An automated PASS must not be recorded as a human Review PASS.

## License

Prototype / research — all rights reserved unless otherwise noted.
