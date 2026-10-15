const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.querySelector("#field");
const context = canvas.getContext("2d", { alpha: true });
const pointer = { x: innerWidth * 0.58, y: innerHeight * 0.42 };
let points = [];
let scale = 1;

function resize() {
  scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * scale);
  canvas.height = Math.round(innerHeight * scale);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  points = [];
  const gap = innerWidth < 700 ? 35 : 43;
  for (let y = gap / 2; y < innerHeight; y += gap) {
    for (let x = gap / 2; x < innerWidth; x += gap) points.push({ x, y, seed: Math.random() * Math.PI * 2 });
  }
}

function draw(time) {
  context.clearRect(0, 0, innerWidth, innerHeight);
  const t = reducedMotion ? 0 : time * 0.00033;
  for (const point of points) {
    const dx = point.x - pointer.x;
    const dy = point.y - pointer.y;
    const distance = Math.hypot(dx, dy);
    const influence = Math.max(0, 1 - distance / 205);
    const push = influence * 11;
    const x = point.x + Math.sin(t + point.seed) * 1.8 + (distance ? dx / distance * push : 0);
    const y = point.y + Math.cos(t * 0.8 + point.seed) * 1.8 + (distance ? dy / distance * push : 0);
    context.beginPath();
    context.arc(x, y, 0.75 + influence * 1.35, 0, Math.PI * 2);
    const warm = ((point.x + point.y) / 125) % 9 < 1;
    context.fillStyle = warm
      ? `rgba(255,113,72,${0.08 + influence * 0.44})`
      : `rgba(120,199,255,${0.065 + influence * 0.44})`;
    context.fill();
  }
  if (!reducedMotion) requestAnimationFrame(draw);
}

addEventListener("resize", resize);
if (!reducedMotion) {
  addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    document.documentElement.style.setProperty("--x", `${event.clientX}px`);
    document.documentElement.style.setProperty("--y", `${event.clientY}px`);
  });
}
resize();
draw(0);
