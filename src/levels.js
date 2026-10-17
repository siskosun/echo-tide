// Each room introduces one idea. All heights use the original jump physics.
export const LEVELS = [
  {
    title: '折返接力', subtitle: '先向左，才能向右', anchor: false,
    hint: '首跳教学：起跳立即造宽桥。此后每跳双候选，约 0.16 秒后确定落点；首次落稳回声才揭示本局潮印方向。',
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
    hint: '首跳造宽桥、落脚揭示潮印；此后每跳两个候选，空中确定一个。站在实心回声上可按 E 锚定。',
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
    hint: '首跳造宽桥、落脚揭示核心方向；此后每跳双候选，空中确认落点并修正方向。可保留回程锚。',
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
