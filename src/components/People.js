// Small stylised people: construction workers (hard hat + hi-vis vest) and townspeople.
// Built from a handful of faceted shapes so they match the low-poly world.

import { COLORS, DEPTH } from '../config/theme.js';
import { shade } from '../systems/ProceduralArt.js';
import { tween, wait } from '../utils/async.js';

const SKIN = [0xe2b48c, 0xc68e64, 0x9a6a46, 0xf0c9a5];
const SHIRTS = [0x4f6d8f, 0x7a5a8a, 0x5d8a5d, 0xb5654a, 0x3f7f86, 0xc9a14a];

export function makePerson(scene, { x, y, worker = false, seed = 0, scale = 1, depth = DEPTH.workers }) {
  const c = scene.add.container(x, y).setDepth(depth).setScale(scale);
  const skin = SKIN[seed % SKIN.length];
  const shirt = worker ? 0x3b5a7a : SHIRTS[seed % SHIRTS.length];
  const g = scene.add.graphics();
  // legs
  g.fillStyle(0x2c3440, 1);
  g.fillRect(-5, -18, 4, 18);
  g.fillRect(1, -18, 4, 18);
  // torso
  g.fillStyle(shirt, 1);
  g.fillRoundedRect(-7, -34, 14, 18, 3);
  g.fillStyle(shade(shirt, -0.18), 1);
  g.fillRect(1, -34, 6, 18);
  if (worker) {
    g.fillStyle(0xf07a2a, 1);
    g.fillRect(-7, -33, 14, 13);
    g.fillStyle(0xf4f0e8, 1);
    g.fillRect(-7, -26, 14, 2);
  }
  // head
  g.fillStyle(skin, 1);
  g.fillCircle(0, -40, 5.5);
  if (worker) {
    g.fillStyle(COLORS.craneYellow, 1);
    g.slice(0, -41, 6.5, Math.PI, 0, false);
    g.fillPath();
    g.fillRect(-8, -42, 16, 2);
  } else {
    g.fillStyle(0x3a2a1e, 1);
    g.slice(0, -41, 5.8, Math.PI, 0, false);
    g.fillPath();
  }
  const arm = scene.add.graphics({ x: 5, y: -32 });
  arm.fillStyle(shirt, 1);
  arm.fillRoundedRect(-2, 0, 4, 13, 2);
  arm.fillStyle(skin, 1);
  arm.fillCircle(0, 13, 2.2);
  const arm2 = scene.add.graphics({ x: -5, y: -32 });
  arm2.fillStyle(shade(shirt, -0.1), 1);
  arm2.fillRoundedRect(-2, 0, 4, 13, 2);
  c.add([arm2, g, arm]);
  c.arm = arm;
  c.arm2 = arm2;
  return c;
}

export function wave(scene, person, { delay = 0, repeat = 5 } = {}) {
  person.arm.setRotation(Math.PI);
  return tween(scene, {
    targets: person.arm,
    rotation: { from: Math.PI * 0.8, to: Math.PI * 1.15 },
    duration: 220,
    yoyo: true,
    repeat,
    delay,
    ease: 'Sine.easeInOut',
  });
}

export function hop(scene, person, { delay = 0, repeat = 2 } = {}) {
  return tween(scene, { targets: person, y: person.y - 8, duration: 200, yoyo: true, repeat, delay, ease: 'Sine.easeOut' });
}

/**
 * A short worker visit: crew appears on the deck at the given points, welds briefly
 * (sparks), then leaves. Used after each installation and in the final sequence.
 */
export async function workerVisit(scene, points, { fx, audio, parent, duration = 900 } = {}) {
  const crew = points.map((p, i) => {
    const w = makePerson(scene, { x: p.x - 14, y: p.y, worker: true, seed: i + 2 });
    if (parent) parent.add(w);
    w.setAlpha(0);
    return w;
  });
  await Promise.all(crew.map((w, i) => tween(scene, { targets: w, alpha: 1, x: w.x + 14, duration: 260, delay: i * 90, ease: 'Sine.easeOut' })));
  crew.forEach((w) => w.arm.setRotation(-1.2));
  const sparkTimer = scene.time.addEvent({
    delay: 170,
    repeat: Math.floor(duration / 170),
    callback: () => {
      const w = crew[Math.floor(Math.random() * crew.length)];
      const m = w.getWorldTransformMatrix();
      const p = m.transformPoint(14, -20);
      fx?.sparks(p.x, p.y, 4);
    },
  });
  audio?.play('sfx.weld', { duration });
  await wait(scene, duration);
  sparkTimer.remove();
  await Promise.all(crew.map((w) => tween(scene, { targets: w, alpha: 0, x: w.x + 18, duration: 260, ease: 'Sine.easeIn' })));
  crew.forEach((w) => w.destroy());
}
