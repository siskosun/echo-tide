// Each room introduces one idea. All heights use the original jump physics.
export const LEVELS = [
  {
    title: '折返接力', subtitle: '先向左，才能向右', anchor: false,
    hint: '朝左起跳前先看虚线桥位，落上回声后继续向左取潮灯，再折返朝右造桥去出口。',
    spawn: { x: 610, facing: -1 },
    platforms: [
      { id: 'start', x: 570, y: 478, w: 360, h: 16, role: 'start' },
      { id: 'relay', x: 180, y: 326, w: 210, h: 16, role: 'stone' },
      { id: 'goal', x: 620, y: 174, w: 280, h: 16, role: 'goal' },
    ],
    objective: { x: 300, y: 288, w: 28, h: 38, name: '潮灯' },
    exit: { x: 810, y: 110, w: 66, h: 64 },
  },
  {
    title: '留一条退路', subtitle: '一枚锚，留住一段时间', anchor: true,
    hint: '看虚线预测位再朝右起跳造桥。站在实心回声上按 E 锚定；换锚后旧平台继续倒计时。',
    spawn: { x: 210, facing: 1 },
    platforms: [
      { id: 'start', x: 30, y: 478, w: 330, h: 16, role: 'start' },
      { id: 'goal', x: 740, y: 250, w: 190, h: 16, role: 'goal' },
    ],
    objective: null,
    exit: { x: 842, y: 186, w: 66, h: 64 },
  },
  {
    title: '借路归航', subtitle: '去时铺路，归时借路', anchor: true,
    hint: '观察虚线落点、朝左起跳造桥取核心，再返回右侧出口；可把锚留在回程要用的桥上。',
    spawn: { x: 690, facing: -1 },
    platforms: [
      { id: 'start', x: 640, y: 478, w: 290, h: 16, role: 'start' },
      { id: 'relic', x: 40, y: 250, w: 200, h: 16, role: 'stone' },
      { id: 'goal', x: 760, y: 326, w: 170, h: 16, role: 'goal' },
    ],
    objective: { x: 100, y: 212, w: 28, h: 38, name: '潮汐核心' },
    exit: { x: 842, y: 262, w: 66, h: 64 },
  },
];
