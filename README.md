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
| Restart | R, or Enter / click after a win or fall |

Jump right from the dock onto the middle stone and **land facing the exit**. A ghost shows where the next echo will rise. Wait until it becomes solid, jump onto it, then jump to the amber gate. Press R if you fall, get stranded, or the tide timer runs out.

从左侧码头向右跳上中间石台，**面朝出口落地**。虚影标出下一块回声升起的位置。等它变成实心后再跳上去，接着跳向琥珀色出口。坠落、被困或潮汐计时结束时按 R 重开。

## Experiment hypothesis

相对静态平台关卡，玩家用落地后延迟升起的自造回声平台规划路径，会比仅靠固定平台更有趣且更可证伪；若延迟机制无法被理解或频繁导致自困而无重置，则假设失败。

Hypothesis: compared with a static-platform level, planning a route with self-made platforms that rise only after a landing delay is more interesting and more falsifiable. The hypothesis fails if a short explanation still leaves players unable to understand the delay and finish, or if echoes cause unrecoverable traps and there is no restart.

## Stack

- Vite + vanilla JS
- `npm test` — smoke checks plus headless route, echo timing, and fail/restart checks
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
