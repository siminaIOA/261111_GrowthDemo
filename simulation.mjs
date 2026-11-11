// Multiple closed contours grow through and beyond a rectangular viewport.
export const MAX_POINTS = 8000;
const COLONY_COUNT = 7;
const SIZE_FACTORS = [0.42, 0.62, 0.88, 1.1, 1.3, 1.55, 1.9];
const GROWTH_BUDGETS = [300, 450, 650, 900, 1150, 1450, 1850];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uncrossPath(points, cellSize) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let repair = 0; repair < 4; repair++) {
    const cells = new Map();
    let crossing = null;
    for (let index = 0; index < points.length && !crossing; index++) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      const minX = Math.floor(Math.min(a.x, b.x) / cellSize);
      const maxX = Math.floor(Math.max(a.x, b.x) / cellSize);
      const minY = Math.floor(Math.min(a.y, b.y) / cellSize);
      const maxY = Math.floor(Math.max(a.y, b.y) / cellSize);
      const visited = new Set();
      for (let x = minX; x <= maxX && !crossing; x++) {
        for (let y = minY; y <= maxY && !crossing; y++) {
          const key = `${x},${y}`;
          if (!cells.has(key)) cells.set(key, []);
          for (const otherIndex of cells.get(key)) {
            if (visited.has(otherIndex)) continue;
            visited.add(otherIndex);
            if (index - otherIndex <= 1 || (otherIndex === 0 && index === points.length - 1)) continue;
            const c = points[otherIndex];
            const d = points[otherIndex + 1];
            if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) {
              crossing = [otherIndex + 1, index];
              break;
            }
          }
          cells.get(key).push(index);
        }
      }
    }
    if (!crossing) break;
    for (let [left, right] = crossing; left < right; left++, right--) {
      [points[left], points[right]] = [points[right], points[left]];
    }
  }
}

export class GrowthSimulation {
  constructor(seed = 2048, spacing = 16, variation = 55) {
    this.width = 960;
    this.height = 560;
    this.reset(seed, spacing, variation);
  }

  get points() {
    return this.paths.flatMap((path) => path.points);
  }

  get filled() {
    return this.paths.every(path => path.points.length >= path.targetPoints);
  }

  setBounds(width, height) {
    const nextWidth = Math.max(320, Number(width) || 960);
    const nextHeight = Math.max(320, Number(height) || 560);
    if (this.paths && this.steps > 0) {
      const scaleX = nextWidth / this.width;
      const scaleY = nextHeight / this.height;
      for (const path of this.paths) {
        path.origin.x *= scaleX;
        path.origin.y *= scaleY;
        for (const point of path.points) {
          point.x *= scaleX;
          point.y *= scaleY;
        }
      }
      this.pointer = null;
    }
    this.width = nextWidth;
    this.height = nextHeight;
  }

  reset(seed = this.seed, spacing = this.spacing, variation = this.variation) {
    this.seed = seed >>> 0;
    this.spacing = clamp(Number(spacing) || 16, 10, 24);
    this.variation = clamp(Number(variation) || 0, 0, 100);
    this.random = randomGenerator(this.seed);
    this.steps = 0;
    this.pointer = null;
    const columns = this.width < 520 ? 2 : 4;
    const rows = Math.ceil(COLONY_COUNT / columns);
    const cellWidth = this.width / columns;
    const cellHeight = this.height / rows;
    const baseRadius = clamp(Math.min(cellWidth, cellHeight) * 0.19, 20, 48);
    // Shuffle a guaranteed range of sizes instead of hoping random draws differ.
    const sizeOrder = Array.from({ length: COLONY_COUNT }, (_, index) => index);
    for (let index = sizeOrder.length - 1; index > 0; index--) {
      const swap = Math.floor(this.random() * (index + 1));
      [sizeOrder[index], sizeOrder[swap]] = [sizeOrder[swap], sizeOrder[index]];
    }
    // Let the right edge and lower left develop into the open areas of the hero.
    for (const [location, rank] of [[3, 6], [6, 5], [4, 4]]) {
      const current = sizeOrder.indexOf(rank);
      [sizeOrder[location], sizeOrder[current]] = [sizeOrder[current], sizeOrder[location]];
    }
    this.paths = Array.from({ length: COLONY_COUNT }, (_, index) => {
      const column = columns === 4 && index >= 4
        ? (index - 4) * 1.5
        : columns === 2 && index === 6 ? 0.5 : index % columns;
      const row = Math.floor(index / columns);
      const rawX = (column + 0.5 - columns / 2) * cellWidth + (this.random() - 0.5) * cellWidth * 0.22;
      const rawY = (row + 0.5 - rows / 2) * cellHeight + (this.random() - 0.5) * cellHeight * 0.22;
      const phase = this.random() * Math.PI * 2;
      const frequency = 2 + Math.floor(this.random() * 4);
      const sizeRank = sizeOrder[index];
      const radius = baseRadius * SIZE_FACTORS[sizeRank] * (0.94 + this.random() * 0.12);
      const cx = clamp(rawX, -this.width / 2 + radius * 1.07 + 18, this.width / 2 - radius * 1.07 - 18);
      const cy = clamp(rawY, -this.height / 2 + radius * 1.07 + 18, this.height / 2 - radius * 1.07 - 18);
      const pointCount = Math.round(clamp(2 * Math.PI * radius / (this.spacing * 0.66), 20, 72));
      const rule = {
        phase: this.random() * Math.PI * 2,
        frequency: 0.007 + this.random() * 0.009,
        fold: 0.7 + this.random() * 0.8,
        curl: (this.random() - 0.5) * 2,
        drift: (this.random() - 0.5) * 2,
        axis: this.random() * Math.PI * 2,
        anisotropy: 0.12 + this.random() * 0.32,
        pulseRate: 0.002 + this.random() * 0.007,
        pulsePhase: this.random() * Math.PI * 2,
        pulseStrength: 0.12 + this.random() * 0.24,
        swirl: (this.random() - 0.5) * 0.36,
        expansion: 0.025 + this.random() * 0.07,
        divisionBias: (this.random() - 0.5) * 0.08,
        strokeWidth: 0.76 + sizeRank * 0.29,
        strokeVariation: 0.13 + this.random() * 0.22,
        strokeFrequency: 0.008 + this.random() * 0.012,
        strokePulse: 0.002 + this.random() * 0.005,
        strokePhase: this.random() * Math.PI * 2,
      };
      const points = Array.from({ length: pointCount }, (_, i) => {
        const angle = (i / pointCount) * Math.PI * 2;
        const r = radius * (1 + 0.06 * Math.sin(angle * frequency + phase));
        return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
      });
      return { points, rule, origin: { x: cx, y: cy }, initialPoints: pointCount, initialRadius: radius, targetPoints: GROWTH_BUDGETS[sizeRank] };
    });
  }

  setPointer(x, y) {
    this.pointer = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  clearPointer() {
    this.pointer = null;
  }

  step() {
    const spacing = this.spacing;
    const radius = spacing * 1.15;
    const grid = new Map();
    const segmentGrid = new Map();
    const segmentClearance = spacing * 0.72;
    let totalPoints = 0;
    let closestPath = -1;
    let closestIndex = -1;
    let closestDistance = Infinity;
    for (let pathIndex = 0; pathIndex < this.paths.length; pathIndex++) {
      const path = this.paths[pathIndex];
      totalPoints += path.points.length;
      for (let index = 0; index < path.points.length; index++) {
        const point = path.points[index];
        const key = `${Math.floor(point.x / radius)},${Math.floor(point.y / radius)}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push({ point, pathIndex, index });
        if (this.pointer) {
          const dx = this.pointer.x - point.x;
          const dy = this.pointer.y - point.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < closestDistance) {
            closestDistance = d2;
            closestPath = pathIndex;
            closestIndex = index;
          }
        }
      }
      for (let index = 0; index < path.points.length; index++) {
        const a = path.points[index];
        const b = path.points[(index + 1) % path.points.length];
        const segment = { a, b, pathIndex, index };
        const minX = Math.floor((Math.min(a.x, b.x) - segmentClearance) / radius);
        const maxX = Math.floor((Math.max(a.x, b.x) + segmentClearance) / radius);
        const minY = Math.floor((Math.min(a.y, b.y) - segmentClearance) / radius);
        const maxY = Math.floor((Math.max(a.y, b.y) + segmentClearance) / radius);
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            const key = `${x},${y}`;
            if (!segmentGrid.has(key)) segmentGrid.set(key, []);
            segmentGrid.get(key).push(segment);
          }
        }
      }
    }

    const variation = this.variation / 100;
    const outerHalfWidth = this.width * 0.64;
    const outerHalfHeight = this.height * 0.64;
    const speedLimit = 1.25 + variation * 0.2;
    const updated = this.paths.map((path, pathIndex) => {
      const points = path.points;
      const count = points.length;
      const rule = path.rule;
      return points.map((point, index) => {
        const previous = points[(index + count - 1) % count];
        const following = points[(index + 1) % count];
        const tangentX = following.x - previous.x;
        const tangentY = following.y - previous.y;
        const tangentLength = Math.hypot(tangentX, tangentY) || 1;
        const wave = Math.sin(point.x * rule.frequency + point.y * rule.frequency * 0.8 + rule.phase + this.steps * 0.009);
        const pulse = Math.sin(this.steps * rule.pulseRate + rule.pulsePhase);
        const alignment = (tangentX * Math.cos(rule.axis) + tangentY * Math.sin(rule.axis)) / tangentLength;
        const localSpacing = spacing * clamp(
          1 + variation * (rule.fold * wave * 0.43 + rule.pulseStrength * pulse * 0.22 + rule.anisotropy * (alignment * alignment - 0.5)),
          0.62, 1.8
        );
        const localRadius = radius * localSpacing / spacing;
        const localRadiusSquared = localRadius * localRadius;
        const cohesion = 0.055 * (1 + variation * (rule.fold * wave * 0.62 + rule.pulseStrength * pulse * 0.35));
        let fx = ((previous.x + following.x) * 0.5 - point.x) * cohesion;
        let fy = ((previous.y + following.y) * 0.5 - point.y) * cohesion;
        const gx = Math.floor(point.x / radius);
        const gy = Math.floor(point.y / radius);
        for (let x = gx - 2; x <= gx + 2; x++) {
          for (let y = gy - 2; y <= gy + 2; y++) {
            for (const other of grid.get(`${x},${y}`) || []) {
              if (other.pathIndex === pathIndex && other.index === index) continue;
              const dx = point.x - other.point.x;
              const dy = point.y - other.point.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < localRadiusSquared && d2 > 0.000001) {
                const d = Math.sqrt(d2);
                const force = (1 - d / localRadius) * (1.1 + variation * rule.fold * 0.28);
                fx += dx / d * force;
                fy += dy / d * force;
              }
            }
          }
        }
        for (const segment of segmentGrid.get(`${gx},${gy}`) || []) {
          if (segment.pathIndex === pathIndex) {
            const along = Math.abs(segment.index - index);
            if (Math.min(along, count - along) <= 2) continue;
          }
          const sx = segment.b.x - segment.a.x;
          const sy = segment.b.y - segment.a.y;
          const lengthSquared = sx * sx + sy * sy;
          const projection = lengthSquared > 0
            ? clamp(((point.x - segment.a.x) * sx + (point.y - segment.a.y) * sy) / lengthSquared, 0, 1)
            : 0;
          const dx = point.x - segment.a.x - projection * sx;
          const dy = point.y - segment.a.y - projection * sy;
          const distance = Math.hypot(dx, dy);
          if (distance < segmentClearance) {
            const force = (1 - distance / segmentClearance) * 3.2;
            const normal = Math.hypot(sx, sy) || 1;
            const direction = distance > 0.001 ? 1 / distance : 0;
            fx += (direction ? dx * direction : -sy / normal) * force;
            fy += (direction ? dy * direction : sx / normal) * force;
          }
        }
        const curl = rule.curl * variation * (0.12 + 0.06 * wave);
        fx += -tangentY / tangentLength * curl;
        fy += tangentX / tangentLength * curl;
        const swirl = rule.swirl * variation * (0.6 + 0.4 * wave);
        fx += tangentX / tangentLength * swirl;
        fy += tangentY / tangentLength * swirl;
        const outwardX = point.x - path.origin.x;
        const outwardY = point.y - path.origin.y;
        const outwardLength = Math.hypot(outwardX, outwardY) || 1;
        const expansion = rule.expansion * (0.75 + variation * 0.25) * (0.85 + pulse * 0.15);
        fx += outwardX / outwardLength * expansion;
        fy += outwardY / outwardLength * expansion;
        fx += rule.drift * variation * 0.045 + (this.random() - 0.5) * (0.08 + variation * 0.1);
        fy += Math.sin(rule.phase + this.steps * 0.01) * variation * 0.04 + (this.random() - 0.5) * (0.08 + variation * 0.1);

        if (pathIndex === closestPath) {
          const around = Math.abs(index - closestIndex);
          const alongCurve = Math.min(around, count - around);
          const influenceWidth = clamp(count * 0.07, 8, 42);
          if (alongCurve < influenceWidth * 3) {
            const dx = this.pointer.x - point.x;
            const dy = this.pointer.y - point.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 0.001) {
              const pull = Math.min(distance / 24, 1) * Math.exp(-0.5 * (alongCurve / influenceWidth) ** 2) * 2.3;
              fx += dx / distance * pull;
              fy += dy / distance * pull;
            }
          }
        }
        const strength = Math.hypot(fx, fy);
        const factor = strength > speedLimit ? speedLimit / strength : 1;
        return {
          x: clamp(point.x + fx * factor, -outerHalfWidth, outerHalfWidth),
          y: clamp(point.y + fy * factor, -outerHalfHeight, outerHalfHeight),
        };
      });
    });

    // Spread divisions around every contour so the field fills gradually.
    const canDivide = this.steps % 2 === 0;
    this.paths.forEach((path, pathIndex) => {
      const next = updated[pathIndex];
      const count = next.length;
      const divisions = new Set();
      if (canDivide && totalPoints < MAX_POINTS && count < path.targetPoints) {
        const start = (this.steps * 13 + pathIndex * 29) % count;
        for (let offset = 0; offset < count && divisions.size < 2; offset++) {
          const index = (start + offset) % count;
          const a = next[index];
          const b = next[(index + 1) % count];
          const pulse = Math.sin(this.steps * path.rule.pulseRate + path.rule.pulsePhase);
          const threshold = spacing * (0.45 + pathIndex * 0.012 + path.rule.divisionBias + variation * path.rule.pulseStrength * pulse * 0.08);
          if (count + divisions.size < path.targetPoints && Math.hypot(a.x - b.x, a.y - b.y) > threshold) divisions.add(index);
        }
      }
      const grown = [];
      for (let index = 0; index < count; index++) {
        const a = next[index];
        const b = next[(index + 1) % count];
        grown.push(a);
        if (totalPoints < MAX_POINTS && divisions.has(index)) {
          grown.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          totalPoints++;
        }
      }
      path.points = grown;
      if (this.steps % 3 === 0) uncrossPath(path.points, spacing);
    });
    this.steps++;
  }
}
