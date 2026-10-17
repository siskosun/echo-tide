# Echo Tide / 叠影潮

One-screen browser platformer. In EXP-5, a successful **takeoff** creates the next echo early. A dashed forecast shows where it will appear, with bounded, predictable tide drift. The exit sits beyond a static jump, so the route is built from these temporary steps. An echo that expires under you drops you into the tide.

单屏平台跳跃。本试验改为**起跳时生成下一块回声**：起跳前会显示虚线预测落点，潮流按可预告的周期影响位置。出口超出静态跳跃距离，必须用这些会消失的台阶走过去。站在正在下沉的回声上会坠入潮底。

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

Face the intended route **before takeoff**. The forming echo becomes solid after 0.24 seconds, lasts 5 seconds and then sinks; the next landing forecast shifts smoothly with tide phase, which is visible before commitment. At most four rising/solid echoes coexist. Rooms 2–3 let you retain one solid echo with E: its remaining lifetime pauses. Transferring the anchor resumes the old bridge's remaining time. The anchor is protected from capacity eviction, but the room's 90-second timer still runs. Re-stamping an anchored bridge never moves or phases it out.

**面向想造路的方向起跳**。起跳前即可看到虚线预测桥位，随潮汐缓慢偏移；起跳当刻生成平台，0.24 秒后可踩，5 秒后下沉，最多保留四块。第二、三关站在实心回声上按 E，可暂停一块平台的消失计时；换锚时旧平台恢复原有剩余寿命，重复按 E 松锚。房间仍有 90 秒时限。R 随时重开本关；切换浏览器标签页暂停计时。

## Three-room campaign / 三关体验

1. **折返接力**：出生在右下。朝左起跳造桥，点亮左上方潮灯，再转向右侧高处出口。潮灯未取得前出口关闭。
2. **留一条退路**：从左下搭桥到右上。首次开放单锚点，站在回声上按 E 可以停下来规划，或把锚转移到更有价值的位置。锚定是策略选择，不是强制开门条件。
3. **借路归航**：先向左上取得潮汐核心，再返回右侧出口。核心位于固定石台，不会随回声消失。可在去程锚定中段桥，取物后借同一块桥返航。

Each room can be retried independently or selected from the menu. Progress is session-only; there is no save-file migration. Existing jump/movement constants are unchanged. Echoes meeting a fixed ledge align to its top, avoiding an extra hidden jump-height penalty.

### Playtest focus

Observe whether new players intentionally change landing direction, plan the next bridge, and revise their route after failure. Ask them to explain what happens to the previous bridge when the anchor moves. In the return room, observe whether they reuse an outbound bridge. Automated completion establishes reachability, not human understanding or fun; those remain the game-exp human Review.

## EXP-5: human-feedback-driven flow pilot

[Issue #5](https://github.com/siskosun/echo-tide/issues/5) freezes two observations from an actual user: the bridge appears too late to anticipate successive jumps, and the initial layout permits a largely predetermined route. This experiment changes **only the forward three-room campaign**: a successful launch stamps one bridge, while a deterministic tide phase offsets the announced bridge position by a bounded amount. The original `createGame({ level: 'classic' })` practice mode retains its landing-based mechanic for regression comparison. This branch does not modify protected game-exp state or either existing touch-control experiment.

The tide is not RNG and does not create random platform traps. A forecast outline shows the currently projected next bridge before the player jumps; its position changes with takeoff time. Platform positions remain a function of player actions and time, so the entire route might still be mathematically solvable. Only actual player observation can show whether this creates a better feeling of flow or replay interest.

**Hypothesis:** earlier, visible bridge creation and time-dependent-but-readable drift can increase the opportunities for sequential leaps without breaking the three-room objective, anchor, time or collision rules. Automatic tests demonstrate mechanics and reachability, not preference or fun.

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
