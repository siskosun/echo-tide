# Echo Tide / 叠影潮

One-screen browser platformer. In EXP-5, a **takeoff** instantly creates an already-solid echo at the dashed preview location: no redundant rising animation. After the first real echo landing, one of two distant **tide seals** appears on a safe ledge; the player must adapt the subsequent route and collect that seal before the exit unlocks. The original three-room geometry, echo expiry and optional anchor are preserved.

单屏平台跳跃。**虚线提前提示，起跳时平台立即变为可踩实体**，不再重复播放成形动画。每关第一次踩上回声后才揭示本局潮印位置（左岸或右岸），需根据新目标调整路线、取得潮印才能打开出口。平台依然会过期，第二、三关保留锚定能力。

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

Face the intended direction **before takeoff**. The forecasted echo is fully solid immediately when the jump fires; it remains for 5 seconds before sinking. The bridge no longer shifts based on a predictable tide sine wave. At most four active echoes coexist. Rooms 2–3 let you retain one solid echo with E: its remaining lifetime pauses. Transferring the anchor resumes the old bridge's remaining time. The anchor is protected from capacity eviction, but the room's 90-second timer still runs. Re-stamping an anchored bridge never moves or phases it out.

**面向想造路的方向起跳**。起跳前看到静态虚线预测桥位，起跳当刻即可踩上，5 秒后下沉，最多保留四块。第一块回声落脚后才揭示左岸或右岸潮印，实际试玩每次开局由浏览器生成新种子。第二、三关站在实心回声上按 E，可暂停一块平台的消失计时；换锚时旧平台恢复原有剩余寿命，重复按 E 松锚。房间仍有 90 秒时限。R 随时重开本关；切换浏览器标签页暂停计时。

## Three-room campaign / 三关体验

1. **折返接力**：先向左起跳造出第一块回声。潮印随后出现在左上接力台或右上目标台，两种位置需要不同的后续路线。
2. **留一条退路**：先向右架桥；潮印随后出现在左侧起点台或右侧目标台。可锚定桥梁，考虑何时回头或继续前进。
3. **借路归航**：先向左造出回声；潮印可能在左侧遗迹或右侧目标台出现。保留一块回声作为回程桥仍有价值。

Each room can be retried independently or selected from the menu. Progress is session-only; there is no save-file migration. Existing jump/movement constants are unchanged. Echoes meeting a fixed ledge align to its top, avoiding an extra hidden jump-height penalty.

### Playtest focus

Observe whether players change their intended destination **after the tide seal is revealed**, and whether the unanimated preview-to-solid transition reduces visual distraction. Ask them to explain which seal appeared and whether the route choice felt meaningful, then separately check anchor understanding and reused bridges. Automated completion establishes reachability, not human understanding or fun; those remain the game-exp human Review.

## EXP-5: mid-run route-reveal pilot

[Issue #5](https://github.com/siskosun/echo-tide/issues/5) documents two consecutive rounds of authentic human critique: platform creation feels too late, an animated forming phase duplicates the preview, and the entire route looks knowable at the beginning.

The latest revision separates two responsibilities:

- **Geometry preview:** a quiet, stationary dashed outline shows the next bridge while grounded. A real takeoff places the solid bridge immediately. The previous rise animation is retained **only** in the classic practice baseline.
- **Route objective:** at the start of each room, the tide seal is concealed. Once the player actually lands on their first echo, one of two **different, prevalidated safe ledge locations** is revealed. The corresponding tide seal must be collected for the exit to unlock. There is no invisible deadly branch and no need to react midair.
- **Uncertainty and reproducibility:** the browser draws a new 32-bit route seed from Web Crypto when possible, including each restart or room change. Headless test games use a fixed seed unless explicitly overridden. Both seeded outcomes can be reproduced in a diagnostic simulation. Seeded outcomes are not player preference measurements, and the two branches are known by the code even though their selection is not exposed before the first echo landing.
- **Constraints:** maximum four concurrent echoes, five-second lifespan, anchor/transfer, three-room goals and fixed jump physics are preserved. The old sinusoidal tide shift was removed because it failed to change 108 tested first-jump decisions.

**Proof boundary:** deterministic tests can show the branch marker appears only after a real echo landing, left/right objectives differ substantially, and the opposite objective does not satisfy the same gate. An input-only winning path under one seed does **not** prove both alternatives are independently completable; confirm both by playtest before a human PASS. More variation does not automatically imply greater enjoyment.


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
