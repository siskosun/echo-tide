const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function drawStub() {
  ctx.fillStyle = '#132033';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // placeholder platforms
  ctx.fillStyle = '#3d6ea8';
  ctx.fillRect(40, 280, 120, 16);
  ctx.fillRect(240, 220, 120, 16);
  ctx.fillRect(440, 160, 120, 16);

  // placeholder player
  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(70, 248, 24, 32);

  // exit marker
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(500, 120, 28, 40);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Echo Tide stub — jump to stamp delayed echo platforms', 16, 28);
  ctx.fillText('叠影潮原型占位：落地后延迟升起回声平台', 16, 48);
}

drawStub();
