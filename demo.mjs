import { GrowthSimulation } from './simulation.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('growth');
const context = canvas.getContext('2d');
const simulation = new GrowthSimulation();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let running = false;
let visible = true;
let frame = 0;
let previousTime = 0;
let accumulator = 0;
let surfaceWidth = 0;
let surfaceHeight = 0;
let worldScale = 1;
let speed = 1;
let lastStatsUpdate = 0;
let announcedFilled = false;

function traceContour(points, start, end) {
  const first = points[start % points.length];
  const previous = points[(start + points.length - 1) % points.length];
  context.moveTo((previous.x + first.x) / 2, (previous.y + first.y) / 2);
  for (let i = start; i < end; i++) {
    const current = points[i % points.length];
    const next = points[(i + 1) % points.length];
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
}

function render() {
  if (!context || !surfaceWidth || !surfaceHeight) return;
  const ratio = canvas.width / surfaceWidth;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, surfaceWidth, surfaceHeight);
  context.save();
  context.translate(surfaceWidth / 2, surfaceHeight / 2);
  context.scale(worldScale, worldScale);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  simulation.paths.forEach((path, pathIndex) => {
    const points = path.points;
    const rule = path.rule;
    const progress = Math.min(1, (points.length - path.initialPoints) / (path.targetPoints - path.initialPoints));
    const growthWidth = 0.78 + progress * 0.38;
    context.beginPath();
    traceContour(points, 0, points.length);
    context.closePath();
    context.fillStyle = 'rgba(255, 255, 255, 0.007)';
    context.fill();
    context.lineWidth = Math.max(4, rule.strokeWidth * 3.1) * growthWidth / worldScale;
    context.strokeStyle = 'rgba(255, 255, 255, 0.075)';
    context.stroke();
    const brightness = 225 - pathIndex * 8;
    context.strokeStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.82)`;
    for (let start = 0; start < points.length; start += 20) {
      const end = Math.min(start + 20, points.length);
      const wave = Math.sin((start + end) * 0.5 * rule.strokeFrequency + rule.strokePhase + simulation.steps * rule.strokePulse);
      context.lineWidth = rule.strokeWidth * growthWidth * (1 + rule.strokeVariation * wave) / worldScale;
      context.beginPath();
      traceContour(points, start, end);
      context.stroke();
    }
  });
  if (simulation.pointer) {
    const { x, y } = simulation.pointer;
    context.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    context.lineWidth = 1 / worldScale;
    context.beginPath();
    context.arc(x, y, 10, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(x - 16, y);
    context.lineTo(x - 12, y);
    context.moveTo(x + 12, y);
    context.lineTo(x + 16, y);
    context.moveTo(x, y - 16);
    context.lineTo(x, y - 12);
    context.moveTo(x, y + 12);
    context.lineTo(x, y + 16);
    context.stroke();
  }
  context.restore();
}

function updateStats() {
  $('point-count').textContent = simulation.points.length;
  $('step-count').textContent = String(simulation.steps).padStart(4, '0');
  $('seed-value').textContent = simulation.seed;
}

function updateState(message) {
  $('toggle-label').textContent = running ? 'Pause' : simulation.steps ? 'Resume' : 'Grow';
  $('play-icon').textContent = running ? 'Ⅱ' : '▶';
  $('state-label').textContent = running ? simulation.filled ? '● EVOLVING' : '● GROWING' : simulation.steps ? '● PAUSED' : '● READY';
  $('status').textContent = message;
  updateStats();
}

function cancelFrame() {
  cancelAnimationFrame(frame);
  frame = 0;
  previousTime = 0;
  accumulator = 0;
}

function schedule() {
  if (running && visible && !document.hidden && !frame) frame = requestAnimationFrame(animate);
}

function animate(time) {
  frame = 0;
  if (!running || !visible || document.hidden) return;
  const elapsed = previousTime ? Math.min(time - previousTime, 80) : 16;
  previousTime = time;
  accumulator += (elapsed / 1000) * 26 * speed;
  let steps = Math.min(Math.floor(accumulator), 5);
  accumulator -= steps;
  while (steps-- > 0) simulation.step();
  render();
  if (time - lastStatsUpdate > 150) { updateStats(); lastStatsUpdate = time; }
  if (simulation.filled && !announcedFilled) {
    announcedFilled = true;
    updateState('The contours keep evolving beyond the frame. Move your cursor to reshape them.');
  }
  schedule();
}

function reset(seed = simulation.seed) {
  running = false;
  cancelFrame();
  simulation.reset(seed, Number($('spacing').value), Number($('variation').value));
  announcedFilled = false;
  updateState('A fresh beginning. Press Grow to explore.');
  render();
}

function guidePointer(event) {
  if (event.pointerType === 'touch' && event.buttons === 0) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  simulation.setPointer(
    (event.clientX - rect.left - rect.width / 2) / worldScale,
    (event.clientY - rect.top - rect.height / 2) / worldScale
  );
  if (!running) render();
}

function releasePointer() {
  simulation.clearPointer();
  if (!running) render();
}

if (context) {
  for (const id of ['toggle', 'new-seed', 'reset']) $(id).disabled = false;
  $('toggle').addEventListener('click', () => {
    running = !running;
    if (running) {
      updateState(simulation.filled ? 'Evolving. Move your cursor to keep reshaping the field.' : 'Growing. Move your cursor to guide the contours.');
      schedule();
    } else {
      cancelFrame();
      updateState('Paused. Take a closer look, or resume when you’re ready.');
    }
  });
  $('reset').addEventListener('click', () => reset());
  $('new-seed').addEventListener('click', () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    let seed = 1000 + (values[0] % 9000);
    if (seed === simulation.seed) seed = seed === 9999 ? 1000 : seed + 1;
    reset(seed);
  });
  $('speed').addEventListener('input', (event) => {
    speed = Number(event.target.value);
    $('speed-value').textContent = `${speed}×`;
  });
  $('spacing').addEventListener('input', (event) => {
    simulation.spacing = Number(event.target.value);
    $('spacing-value').textContent = simulation.spacing;
    if (!running) $('status').textContent = 'Spacing updated. Press Grow or Resume to see its effect.';
  });
  $('variation').addEventListener('input', (event) => {
    simulation.variation = Number(event.target.value);
    $('variation-value').textContent = `${simulation.variation}%`;
    if (!running) $('status').textContent = 'Variation updated. Press Grow or Resume to see the changing rules.';
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') canvas.setPointerCapture(event.pointerId);
    guidePointer(event);
  });
  document.querySelector('.hero').addEventListener('pointermove', (event) => {
    if (event.target.closest('.control-dock, .scroll-cue, .masthead')) releasePointer();
    else guidePointer(event);
  });
  document.querySelector('.hero').addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') releasePointer();
  });
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  new ResizeObserver(() => {
    const bounds = $('canvas-wrap').getBoundingClientRect();
    surfaceWidth = bounds.width;
    surfaceHeight = bounds.height;
    worldScale = surfaceWidth <= 720 ? surfaceWidth / 420 : Math.min(surfaceWidth / 960, surfaceHeight / 560);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(surfaceWidth * ratio);
    canvas.height = Math.round(surfaceHeight * ratio);
    simulation.setBounds(surfaceWidth / worldScale, surfaceHeight / worldScale);
    if (simulation.steps === 0) simulation.reset(simulation.seed, simulation.spacing, simulation.variation);
    updateStats();
    render();
  }).observe($('canvas-wrap'));
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule(); else cancelFrame();
  }, { threshold: 0 }).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelFrame(); else schedule();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && running) {
      running = false;
      cancelFrame();
      updateState('Paused for your reduced-motion preference. Press Resume to continue.');
    }
  });
  if (reducedMotion.matches) $('status').textContent = 'Motion is off until you choose Grow. Pause at any time.';
} else {
  $('status').textContent = 'Canvas is unavailable in this browser. You can still read how the experiment works below.';
  $('state-label').textContent = 'STATIC VIEW';
  $('speed').disabled = true;
  $('spacing').disabled = true;
  $('variation').disabled = true;
}
