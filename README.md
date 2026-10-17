# Echo Tide / 叠影潮

One-screen browser platformer. Every jump landing stamps a delayed **echo** platform: it telegraphs, rises into something solid, then sinks away. The exit sits beyond a static jump, so the route is built from these temporary steps. An echo that expires under you drops you into the tide.

单屏平台跳跃。每次落地会盖下一块延迟的**回声**平台：先显形，再升起为实体，随后下沉消失。出口超出静态跳跃距离，必须用这些会消失的台阶走过去。站在正在下沉的回声上会坠入潮底。

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

Land facing the direction in which you want to build. An echo forms after 0.24 seconds, remains solid for 5 seconds and then sinks. At most four rising/solid echoes coexist. Rooms 2–3 let you retain one solid echo with E: its remaining lifetime pauses. Transferring the anchor resumes the old bridge's remaining time. The anchor is protected from capacity eviction, but the room's 90-second timer still runs. Re-stamping an anchored bridge never moves or phases it out.

**面向你想造路的方向落地**。落地前不显示下一块平台的位置；落地后用短暂显形提示反馈实际生成位置，0.24 秒后回声可踩，5 秒后下沉，最多保留四块。第二、三关站在实心回声上按 E，可暂停一块平台的消失计时；换锚时旧平台恢复原有剩余寿命，重复按 E 松锚。房间仍有 90 秒时限。R 随时重开本关；切换浏览器标签页暂停计时。

## Three-room campaign / 三关体验

1. **折返接力**：出生在右下。朝左落地造桥，点亮左上方潮灯，再转向右侧高处出口。潮灯未取得前出口关闭。
2. **留一条退路**：从左下搭桥到右上。首次开放单锚点，站在回声上按 E 可以停下来规划，或把锚转移到更有价值的位置。锚定是策略选择，不是强制开门条件。
3. **借路归航**：先向左上取得潮汐核心，再返回右侧出口。核心位于固定石台，不会随回声消失。可在去程锚定中段桥，取物后借同一块桥返航。

Each room can be retried independently or selected from the menu. Progress is session-only; there is no save-file migration. Existing jump/movement constants are unchanged. Echoes meeting a fixed ledge align to its top, avoiding an extra hidden jump-height penalty.

### Playtest focus

Observe whether new players intentionally change landing direction, plan the next bridge, and revise their route after failure. Ask them to explain what happens to the previous bridge when the anchor moves. In the return room, observe whether they reuse an outbound bridge. Automated completion establishes reachability, not human understanding or fun; those remain the game-exp human Review.

## Experiment hypothesis

相对静态平台关卡，玩家用落地后延迟升起的自造回声平台规划路径，会比仅靠固定平台更有趣且更可证伪；若延迟机制无法被理解或频繁导致自困而无重置，则假设失败。

Hypothesis: compared with a static-platform level, planning a route with self-made platforms that rise only after a landing delay is more interesting and more falsifiable. The hypothesis fails if a short explanation still leaves players unable to understand the delay and finish, or if echoes cause unrecoverable traps and there is no restart.

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

This repository is prepared for [game-exp](https://github.com/siskosun) experiment control. Gameplay for this experiment lives on `exp/1` inside the manifest's allowed paths.

## License

Prototype / research — all rights reserved unless otherwise noted.

## EXP-2 mobile touch experiment (AI-only technical branch)

This source branch belongs to [game-exp EXP-2](https://github.com/siskosun/echo-tide/issues/2). The exact parent is `aecd07cd0b84d29958aad0196840f20eb98fc1ad` from the existing EXP-1 playable prototype. **This is an engineering comparison arm, not a player-preference result.** The matching [human-guided EXP-3](https://github.com/siskosun/echo-tide/issues/3) is deliberately unchanged until actual human design input exists.

On touch devices, buttons below the canvas hold left/right movement, jump, and (in rooms 2–3) anchor/release. Two fingers can hold movement and jump concurrently. Pointer release/cancel, lost pointer capture, tab hiding and window focus loss clear held controls. The original keyboard commands, room selection and game rules are unchanged. The mobile input adapter is `src/touch_controls.js`; its deterministic regression tests live in `test/touch_controls.test.js` and are imported by the existing smoke-test entrypoint so `npm test` exercises them.

Known results: the six new isolated touch-state tests were run in Node with identical Git blob content and passed. The full project-level test, build and mobile visual acceptance require separate verification before the trusted Candidate Review; do not infer those from the isolated tests.

Production effort and AI call counts were not instrumented at source time; do not infer matching development costs from shared caps. No human-guided output, real participant, retention, or willingness-to-pay observation is available.
