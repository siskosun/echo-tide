# Echo Tide / 叠影潮

One-screen browser platformer. In EXP-5, the first **takeoff** creates a wide, safe echo. The browser defaults to **Airborne Challenge**: subsequent jumps across gaps show two narrow possible landings; approximately 160ms after takeoff, one becomes a solid bridge with no rising animation. If an existing fixed ledge is reachable, its real stone outline becomes one of the TWO persistent choices; no duplicate echo is drawn over rock. Both choices stay visible until landing, even after the midair decision. The player must steer midair. After the first real echo landing, one of two distant **tide seals** appears on a safe ledge; the player must adapt the subsequent route and collect that seal before the exit unlocks. The original three-room geometry, echo expiry and optional anchor are preserved.

单屏平台跳跃。**第一次跳跃是宽平台教学，后续默认空中二选一窄桥**：起跳前显示两个候选范围，离地约 0.16 秒后，其中一块直接变为实体。玩家必须根据实际位置空中调整方向，不播放升起动画。每关第一次踩上回声后才揭示本局潮印位置（左岸或右岸），需根据新目标调整路线、取得潮印才能打开出口。平台依然会过期，第二、三关保留锚定能力。

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

Face the intended direction **before takeoff**. The first teaching platform is fully solid immediately. In Challenge mode, after a single clearly labeled wide-bridge tutorial, **every subsequent jump has two persistent candidates**: yellow dashed = a narrow temporary echo, teal continuous = an already-existing stone if one is reachable. About 0.16 seconds into the flight the chosen target highlights; the unused outline dims but does not disappear. If stone is selected, no duplicate echo is stamped. A newly generated Challenge-mode bridge must be landed on **during the same jump that created it**; a missed bridge becomes non-solid on landing and cannot be banked for a second hop. **The already-earned takeoff bridge is protected during flight** and cannot be evicted by the four-bridge cap. On an actual miss that lands safely back on an old echo near expiry, that old echo receives **one non-repeatable minimum 1.8-second retry window**, rather than disappearing beneath the player. Once caught, a new bridge retains the ordinary 5-second life and anchor behavior; repeatedly standing/jumping in place cannot keep refreshing an old bridge forever. This closes the standstill-jump / wait / second-jump workaround without hiding the two preview options. The bridge no longer shifts based on a predictable tide sine wave. At most four active echoes coexist. Rooms 2–3 let you retain one solid echo with E: its remaining lifetime pauses. Transferring the anchor resumes the old bridge's remaining time. The anchor is protected from capacity eviction, but the room's 90-second timer still runs. Re-stamping an anchored bridge never moves or phases it out.

**面向想造路的方向起跳**。入门模式继续使用可预测的 210 宽平台；挑战模式默认开启，首跳仍是宽平台，首跳教学完成后，每次起跳都保留两个候选落点。如果能跳到原有石台，则其中一个候选用绿色实框描绘石台，另一个用黄色虚框描绘窄桥（80 单位）；不会在石台上叠放新回声。起跳后即使确认了落点，两框也一直保留到本次真正落脚。挑战模式新增的桥必须在**本次起跳中踩到**：若原地起跳后落回旧平台，**没踩中的新桥**会失去碰撞并淡出，不能留给第二跳；而**此前踩中的旧桥**在本次跳跃中不会因寿命或平台数量上限突然消失。失误落回临近寿命终点的旧桥时，该旧桥还有一次最低 1.8 秒的重试机会，无法无限刷新；成功踩中的新平台仍保留正常 5 秒寿命与锚定规则。最多保留四块。第一块回声落脚后才揭示左岸或右岸潮印，实际试玩每次开局由浏览器生成新种子。第二、三关站在实心回声上按 E，可暂停一块平台的消失计时；换锚时旧平台恢复原有剩余寿命，重复按 E 松锚。房间仍有 90 秒时限。R 随时重开本关；切换浏览器标签页暂停计时。

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

- **Landing skill:** Challenge is the browser default but Standard remains selectable. The first hop is a clearly labeled, safe 210-wide bridge lesson. Thereafter both cue outlines remain on screen throughout the jump; where appropriate, a real stone is one candidate instead of a duplicate echo. After 0.16s the chosen option is highlighted and the other gently dimmed, never abruptly hidden. A fixed left/right hold is not guaranteed to catch the narrower echo, while reacting to its confirmed position should be viable. The classic practice mode retains original landing-triggered animation.
- **Route objective:** at the start of each room, the tide seal is concealed. Once the player actually lands on their first echo, one of two **different, prevalidated safe ledge locations** is revealed. The corresponding tide seal must be collected for the exit to unlock. The objective branch itself does not create invisible death, but the separately selectable airborne landing challenge deliberately requires timely correction.
- **Uncertainty and reproducibility:** the browser draws a new 32-bit route seed from Web Crypto when possible, including each restart or room change. Headless test games use a fixed seed unless explicitly overridden. Both seeded outcomes can be reproduced in a diagnostic simulation. Seeded outcomes are not player preference measurements, and the two branches are known by the code even though their selection is not exposed before the first echo landing.
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
