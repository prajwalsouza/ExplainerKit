// A garden that grows into the recorded room: a tree from the floor by the wall, a flowering vine that climbs the
// wall and frames the chart, grass and flowers at the tree's foot, and butterflies that visit the flowers.
//
// Everything is placed in the room's own metres (the solve in scripts/landing/fit-room.py), so it stays put as the camera
// moves. It grows with the story and lives on the clock: leaves stir in a light draught, flowers open, butterflies
// wander. The reader's pointer is a ray into the room. Leaves near it rustle away from it, a quick pass through the
// crown shakes leaves loose and they fall through the air to the floor round the tree, flowers near it open wide
// and turn toward it, and butterflies scatter from it.
import { randomAt } from 'explainerkit/noise';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const v = clamp((x - a) / (b - a));return v * v * (3 - 2 * v); };

/** A leaf: a pointed blade with a raised midrib, base at the origin, tip along +z. */
function leafGeometry(T) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, -.22, 0, .39, -.16, -.018, .69, 0, 0, 1, .16, -.018, .69, .22, 0, .39, 0, .085, .45], 3));
  g.setIndex([0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0, 6]);
  g.computeVertexNormals();
  return g;
}

/**
 * `T` is Three.js and `scene` the room's scene. `wallZ` and `floorY` are the room's wall and floor in metres.
 * `tint(h, s, l)` makes a Three colour.
 */
export function createGarden(T, scene, { wallZ, floorY, tint }) {
  const rand = (a, b = 0) => randomAt('room-garden', a, b);
  const group = new T.Group();scene.add(group);
  const temp = new T.Object3D(), up = new T.Vector3(0, 1, 0), v = new T.Vector3(), w = new T.Vector3();

  // ---- The tree ----------------------------------------------------------------------------------------------
  const BASE = new T.Vector3(-.58, floorY, wallZ + .42);
  const branches = [], tips = [];
  /** Branch from `start` along `dir`; each child turns away by a seeded angle, leaning up and out from the wall. */
  function grow(start, dir, length, radius, depth, born, id) {
    const end = start.clone().addScaledVector(dir, length);
    branches.push({ start, dir: dir.clone(), length, radius, born, end: born + .22 + length * .25, depth });
    if (depth === 0) { tips.push({ at: end, born: born + .3, id, offset: new T.Vector3(), velocity: new T.Vector3() });return; }
    const children = depth > 3 ? 2 : 2 + (rand(id, 1) > .45 ? 1 : 0);
    for (let k = 0; k < children; k++) {
      const turn = .45 + .5 * rand(id, 10 + k), around = (k / children) * 6.283 + rand(id, 20 + k) * 2.2;
      const side = new T.Vector3(Math.cos(around), 0, Math.sin(around)).cross(dir).normalize();
      const child = dir.clone().applyAxisAngle(side, turn).add(new T.Vector3(.08, .28, .2)).normalize();
      // keep the crown off the chart and out of the wall
      if (end.x + child.x * length > .02) child.x -= .5;
      if (end.z + child.z * length < wallZ + .15) child.z += .6;
      grow(end, child.normalize(), length * (.7 + .12 * rand(id, 30 + k)), radius * .66, depth - 1, born + .12 + .05 * rand(id, 40 + k), id * 4 + k + 1);
    }
  }
  grow(BASE, new T.Vector3(.05, 1, .08).normalize(), .78, .055, 5, 0, 1);
  const bark = new T.MeshStandardMaterial({ roughness: .9, flatShading: true });
  const limb = new T.CylinderGeometry(.68, 1, 1, 6).translate(0, .5, 0);
  const wood = new T.InstancedMesh(limb, bark, branches.length);
  branches.forEach((b, i) => wood.setColorAt(i, tint(26 + 8 * rand(i, 3), 30 + 10 * rand(i, 4), 24 + 8 * rand(i, 5))));
  wood.castShadow = true;wood.receiveShadow = true;group.add(wood);

  const LEAVES = 24, leafShape = leafGeometry(T);
  const leafMaterial = new T.MeshStandardMaterial({ roughness: .78, side: T.DoubleSide, flatShading: true });
  const leaves = new T.InstancedMesh(leafShape, leafMaterial, tips.length * LEAVES);
  const leafData = [];
  tips.forEach((tip, t) => {
    for (let k = 0; k < LEAVES; k++) {
      const n = t * LEAVES + k, r = .04 + .17 * Math.cbrt(rand(n, 1)), a = rand(n, 2) * 6.283, b = Math.acos(2 * rand(n, 3) - 1);
      const offset = new T.Vector3(r * Math.sin(b) * Math.cos(a), r * Math.cos(b) * .7 + .02, r * Math.sin(b) * Math.sin(a));
      // greens of many kinds, a few turning yellow
      const autumn = rand(n, 9) > .9;
      leaves.setColorAt(n, autumn ? tint(44 + 10 * rand(n, 4), 62, 52) : tint(92 + 38 * rand(n, 4), 32 + 22 * rand(n, 5), 26 + 18 * rand(n, 6)));
      leafData.push({ tip, offset, yaw: rand(n, 7) * 6.283, pitch: -.6 + 1.4 * rand(n, 8), size: .085 + .05 * rand(n, 10), phase: rand(n, 11) * 6.283 });
    }
  });
  leaves.castShadow = true;leaves.receiveShadow = true;group.add(leaves);
  // blossoms on a third of the tips
  const flowerShape = new T.IcosahedronGeometry(1, 0), blossomTips = tips.filter((tip, t) => rand(t, 50) > .62);
  const blossoms = new T.InstancedMesh(flowerShape, new T.MeshStandardMaterial({ roughness: .7, flatShading: true }), blossomTips.length * 4);
  const blossomData = [];
  blossomTips.forEach((tip, t) => { for (let k = 0; k < 4; k++) { const n = t * 4 + k;blossoms.setColorAt(n, rand(n, 61) > .5 ? tint(338 + 14 * rand(n, 62), 62, 80) : tint(30, 40, 95));blossomData.push({ tip, offset: new T.Vector3(rand(n, 63) - .5, rand(n, 64) * .6, rand(n, 65) - .5).multiplyScalar(.2), size: .014 + .01 * rand(n, 66) }); } });
  blossoms.castShadow = true;group.add(blossoms);

  // ---- The vine on the wall, framing the chart ----------------------------------------------------------------
  const face = wallZ + .014;
  const path = new T.CatmullRomCurve3([[-.4, -.72], [-.3, -.1], [-.18, .55], [-.12, 1.25], [-.02, 1.95], [.38, 2.3], [.92, 2.38], [1.46, 2.3], [1.82, 1.95], [1.9, 1.3], [1.86, .8], [1.78, .5]].map(([x, y]) => new T.Vector3(x, y, face)), false, 'centripetal');
  const SEGMENTS = 360, stem = new T.TubeGeometry(path, SEGMENTS, .0075, 5, false);
  const vine = new T.Mesh(stem, new T.MeshStandardMaterial({ color: tint(96, 32, 30), roughness: .85 }));
  vine.castShadow = true;group.add(vine);
  const STEPS = 120, vineLeaves = new T.InstancedMesh(leafShape, leafMaterial, STEPS), vineLeaf = [];
  for (let k = 0; k < STEPS; k++) {
    const s = (k + .5) / STEPS;vineLeaves.setColorAt(k, tint(100 + 34 * rand(k, 71), 34 + 18 * rand(k, 72), 28 + 16 * rand(k, 73)));
    vineLeaf.push({ s, side: k % 2 ? 1 : -1, size: .05 + .03 * rand(k, 74), phase: rand(k, 75) * 6.283 });
  }
  vineLeaves.castShadow = true;group.add(vineLeaves);
  // flowers: five petals round a centre, in a spread of colours that do not repeat in order
  const PALETTE = [[338, 66, 74], [12, 74, 66], [46, 86, 64], [282, 42, 74], [40, 30, 96], [200, 50, 72]];
  const petal = new T.CircleGeometry(1, 10).scale(.55, 1, 1).translate(0, .9, 0);
  const FLOWERS = 16, petals = new T.InstancedMesh(petal, new T.MeshStandardMaterial({ roughness: .65, side: T.DoubleSide }), FLOWERS * 5);
  const hearts = new T.InstancedMesh(flowerShape, new T.MeshStandardMaterial({ color: tint(44, 80, 52), roughness: .6, flatShading: true }), FLOWERS);
  const flowers = [];
  for (let f = 0; f < FLOWERS; f++) {
    const s = .1 + .86 * (f + .3 * rand(f, 81)) / FLOWERS, colour = PALETTE[Math.floor(rand(f, 82) * PALETTE.length)];
    for (let k = 0; k < 5; k++) petals.setColorAt(f * 5 + k, tint(colour[0] + 10 * (rand(f, 90 + k) - .5), colour[1], colour[2] + 6 * (rand(f, 95 + k) - .5)));
    flowers.push({ s, at: path.getPointAt(s).add(new T.Vector3(0, 0, .02)), size: .045 + .025 * rand(f, 83), spin: rand(f, 84) * 6.283, open: 0, lean: new T.Vector3() });
  }
  petals.castShadow = true;group.add(petals, hearts);

  // ---- Grass and flowers at the tree's foot ------------------------------------------------------------------
  const blade = new T.ConeGeometry(.012, 1, 3).translate(0, .5, 0), BLADES = 140;
  const grass = new T.InstancedMesh(blade, new T.MeshStandardMaterial({ roughness: .9, flatShading: true }), BLADES), grassData = [];
  for (let k = 0; k < BLADES; k++) {
    const a = rand(k, 101) * 6.283, r = .06 + .38 * Math.sqrt(rand(k, 102));
    const x = BASE.x + Math.cos(a) * r * 1.3, z = clamp(BASE.z + Math.sin(a) * r, wallZ + .05, BASE.z + .45);
    grass.setColorAt(k, tint(84 + 40 * rand(k, 103), 36 + 20 * rand(k, 104), 30 + 18 * rand(k, 105)));
    grassData.push({ x, z, height: .12 + .2 * rand(k, 106), lean: (rand(k, 107) - .5) * .5, turn: rand(k, 108) * 6.283, phase: rand(k, 109) * 6.283, bend: new T.Vector2() });
  }
  grass.castShadow = true;group.add(grass);
  const GROUND = 9, groundFlowers = new T.InstancedMesh(flowerShape, new T.MeshStandardMaterial({ roughness: .7, flatShading: true }), GROUND), groundData = [];
  for (let k = 0; k < GROUND; k++) { const c = PALETTE[Math.floor(rand(k, 111) * PALETTE.length)];groundFlowers.setColorAt(k, tint(c[0], c[1], c[2]));groundData.push(grassData[Math.floor(rand(k, 112) * BLADES)]); }
  group.add(groundFlowers);

  // ---- Falling leaves ----------------------------------------------------------------------------------------
  const FALL = 48, fallen = new T.InstancedMesh(leafShape, leafMaterial, FALL), drops = [];
  fallen.castShadow = true;group.add(fallen);
  for (let k = 0; k < FALL; k++) fallen.setColorAt(k, tint(52 + 50 * rand(k, 121), 50, 40 + 10 * rand(k, 122)));

  // ---- Butterflies -------------------------------------------------------------------------------------------
  const wingShape = new T.Shape();wingShape.moveTo(0, 0);wingShape.bezierCurveTo(.012, .043, .066, .059, .068, .015);wingShape.bezierCurveTo(.072, -.011, .041, -.036, 0, 0);
  const wingGeometry = new T.ShapeGeometry(wingShape, 6);
  const butterflies = [[32, 86, 58], [196, 70, 56], [306, 46, 66], [52, 90, 62]].map((c, i) => {
    const root = new T.Group(), material = new T.MeshStandardMaterial({ color: tint(...c), side: T.DoubleSide, roughness: .6 });
    const wings = [-1, 1].map((side) => { const wing = new T.Mesh(wingGeometry, material);wing.scale.set(side * 1.6, 1.6, 1.6);wing.castShadow = true;root.add(wing);return wing; });
    root.add(new T.Mesh(new T.CapsuleGeometry(.006, .03, 3, 5), new T.MeshStandardMaterial({ color: tint(27, 30, 13) })));
    group.add(root);
    return { root, wings, position: new T.Vector3(-.3 + .4 * i, 1 + .3 * i, wallZ + .5), velocity: new T.Vector3(), target: null, rest: 0, phase: i * 2.1, flower: (i * 5) % FLOWERS };
  });

  // ---- The pointer -------------------------------------------------------------------------------------------
  let ray = null, rayVelocity = 0, lastHit = null;
  /** Distance from a point to the pointer's ray, and the direction away from it. */
  function fromRay(p, out) {
    v.set(p.x - ray.origin.x, p.y - ray.origin.y, p.z - ray.origin.z);
    const along = v.x * ray.direction.x + v.y * ray.direction.y + v.z * ray.direction.z;
    out.set(v.x - ray.direction.x * along, v.y - ray.direction.y * along, v.z - ray.direction.z * along);
    const d = out.length();if (d > 1e-6) out.divideScalar(d);
    return d;
  }

  let shed = 0;
  return {
    group,
    /** The pointer as a ray in room metres, or null when it is away. Quick passes shake the tree. */
    point(next, dt) {
      if (!next) { ray = null;lastHit = null;return; }
      ray = next;
      // how fast the pointer sweeps through the room, measured where its ray passes the tree
      const along = (BASE.z - ray.origin.z) / (ray.direction.z || 1e-6), hit = { x: ray.origin.x + ray.direction.x * along, y: ray.origin.y + ray.direction.y * along };
      if (lastHit && dt > 0) rayVelocity = Math.min(6, Math.hypot(hit.x - lastHit.x, hit.y - lastHit.y) / dt);
      lastHit = hit;
    },
    /** `growth` has the tree's and the vine's progress, 0 to 1, from the story. `time` and `dt` in seconds. */
    update(time, dt, growth) {
      const g = growth.tree, gv = growth.vine;
      group.visible = g > 0 || gv > 0;
      if (!group.visible) return;
      const draught = (x, k) => .5 * Math.sin(time * 1.3 + x * 3 + k) + .3 * Math.sin(time * 2.9 + k * 1.7);
      // branches extend in order from the trunk out
      branches.forEach((b, i) => {
        const s = smooth(b.born, b.end, g * 1.6);
        temp.position.copy(b.start);temp.quaternion.setFromUnitVectors(up, b.dir);temp.scale.set(b.radius * Math.max(.2, s), b.length * s + 1e-4, b.radius * Math.max(.2, s));
        temp.updateMatrix();wood.setMatrixAt(i, temp.matrix);
      });
      wood.instanceMatrix.needsUpdate = true;
      // each tip is on a spring: the draught and the pointer push it, and it swings back
      const near = new T.Vector3();
      for (const tip of tips) {
        const force = w.set(draught(tip.at.x, tip.id) * .25, 0, draught(tip.at.z, tip.id + 3) * .15);
        if (ray) {
          const d = fromRay(tip.at, near);
          if (d < .4) { const push = (1 - d / .4) ** 2 * (2.5 + rayVelocity * 5);force.addScaledVector(near, push); }
          if (d < .3 && rayVelocity > 1.2 && g > .9 && Math.random() < dt * rayVelocity * 2.2 && drops.length < FALL) {
            drops.push({ from: tip.at.clone().add(tip.offset).add(new T.Vector3(rand(shed, 131) - .5, 0, rand(shed, 132) - .5).multiplyScalar(.2)), born: time, slot: shed % FALL, phase: rand(shed, 133) * 6.283, drift: new T.Vector3(near.x, 0, near.z).multiplyScalar(.25) });
            shed++;
          }
        }
        tip.velocity.addScaledVector(force, dt).addScaledVector(tip.offset, -42 * dt).multiplyScalar(Math.exp(-5 * dt));
        tip.offset.addScaledVector(tip.velocity, dt).clampLength(0, .09);
      }
      // leaves open once their twig has grown, ride their tip's spring, and flutter faster the harder it moves
      leafData.forEach((l, n) => {
        const s = smooth(l.tip.born, l.tip.born + .3, g * 1.6), stir = l.tip.velocity.length();
        temp.position.copy(l.tip.at).add(l.tip.offset).addScaledVector(l.offset, .4 + .6 * s);
        temp.rotation.set(l.pitch + Math.sin(time * (3 + stir * 18) + l.phase) * (.08 + stir * 1.6), l.yaw, Math.sin(time * 2.1 + l.phase) * .12);
        temp.scale.setScalar(l.size * s + 1e-5);temp.updateMatrix();leaves.setMatrixAt(n, temp.matrix);
      });
      leaves.instanceMatrix.needsUpdate = true;
      blossomData.forEach((b, n) => {
        const s = smooth(.75, 1, g);temp.position.copy(b.tip.at).add(b.tip.offset).add(b.offset);temp.rotation.set(n, n * 2, 0);temp.scale.setScalar(b.size * s + 1e-5);temp.updateMatrix();blossoms.setMatrixAt(n, temp.matrix);
      });
      blossoms.instanceMatrix.needsUpdate = true;

      // the vine grows along its path; leaves unfold behind its tip, flowers open after
      stem.setDrawRange(0, Math.floor(stem.index.count * gv / 30) * 30);
      let wallHit = null;
      if (ray && Math.abs(ray.direction.z) > 1e-6) { const k = (face - ray.origin.z) / ray.direction.z;if (k > 0) wallHit = new T.Vector3(ray.origin.x + ray.direction.x * k, ray.origin.y + ray.direction.y * k, face); }
      vineLeaf.forEach((l, k) => {
        const s = smooth(l.s, l.s + .04, gv), p = path.getPointAt(l.s), t = path.getTangentAt(l.s), normal = w.set(-t.y, t.x, 0).multiplyScalar(l.side);
        const shiver = wallHit ? Math.max(0, 1 - p.distanceTo(wallHit) / .3) : 0;
        temp.position.copy(p).addScaledVector(normal, .008);
        temp.lookAt(v.copy(temp.position).addScaledVector(normal, 1).add(new T.Vector3(0, 0, .55)));
        temp.rotateZ(Math.sin(time * (2 + shiver * 14) + l.phase) * (.1 + shiver * .5));
        temp.scale.setScalar(l.size * s + 1e-5);temp.updateMatrix();vineLeaves.setMatrixAt(k, temp.matrix);
      });
      vineLeaves.instanceMatrix.needsUpdate = true;
      flowers.forEach((f, k) => {
        const reach = wallHit ? Math.max(0, 1 - f.at.distanceTo(wallHit) / .35) : 0;
        const goal = smooth(f.s + .05, f.s + .14, gv) * (.72 + .5 * reach);
        f.open += (goal - f.open) * Math.min(1, dt * 5);
        // a flower leans toward the pointer's place on the wall
        if (wallHit) f.lean.lerp(v.copy(wallHit).sub(f.at).multiplyScalar(reach * .9), Math.min(1, dt * 4)); else f.lean.multiplyScalar(Math.exp(-dt * 3));
        const size = f.size * Math.min(1, f.open * 1.6);
        for (let p = 0; p < 5; p++) {
          temp.position.copy(f.at);temp.rotation.set(-.35 + f.lean.y * .8 - (1 - Math.min(1, f.open)) * 1.1, f.lean.x * .8, f.spin + p * 1.2566, 'XYZ');
          temp.scale.set(size, size * (.7 + .3 * Math.min(1, f.open)), size);temp.updateMatrix();petals.setMatrixAt(k * 5 + p, temp.matrix);
        }
        temp.position.copy(f.at).add(v.set(0, 0, .008));temp.rotation.set(0, 0, 0);temp.scale.setScalar(size * .28 + 1e-5);temp.updateMatrix();hearts.setMatrixAt(k, temp.matrix);
      });
      petals.instanceMatrix.needsUpdate = true;hearts.instanceMatrix.needsUpdate = true;

      // grass at the foot sways, and bends away from the pointer when it passes low
      const gg = smooth(.1, .6, g);
      grassData.forEach((b, k) => {
        let bx = 0, bz = 0;
        if (ray) { const d = fromRay(v.set(b.x, floorY + b.height * .6, b.z), near);if (d < .3) { bx = near.x * (1 - d / .3) * .9;bz = near.z * (1 - d / .3) * .9; } }
        b.bend.x += (bx - b.bend.x) * Math.min(1, dt * 6);b.bend.y += (bz - b.bend.y) * Math.min(1, dt * 6);
        temp.position.set(b.x, floorY, b.z);temp.rotation.set(b.lean + b.bend.y + Math.sin(time * 1.8 + b.phase) * .06, b.turn, -b.bend.x + Math.sin(time * 1.4 + b.phase) * .05, 'YXZ');
        temp.scale.set(1, b.height * gg + 1e-4, 1);temp.updateMatrix();grass.setMatrixAt(k, temp.matrix);
      });
      grass.instanceMatrix.needsUpdate = true;
      groundData.forEach((b, k) => {
        const s = smooth(.55, .85, g);temp.position.set(b.x - Math.sin(b.bend.x) * b.height * .1, floorY + b.height * gg * 1.05, b.z);temp.rotation.set(k, k, 0);temp.scale.setScalar(.022 * s + 1e-5);temp.updateMatrix();groundFlowers.setMatrixAt(k, temp.matrix);
      });
      groundFlowers.instanceMatrix.needsUpdate = true;

      // leaves shaken loose fall slowly, swinging, and lie where they land
      for (let k = 0; k < FALL; k++) { temp.position.set(0, -50, 0);temp.scale.setScalar(1e-5);temp.updateMatrix();fallen.setMatrixAt(k, temp.matrix); }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i], age = time - d.born;
        if (age > 14) { drops.splice(i, 1);continue; }
        // Leaves drift only over the clear floor round the tree. The real chairs stand in front of the rest of the
        // floor, and nothing here knows their shape, so a leaf there would be drawn over them.
        const x0 = clamp(d.from.x + d.drift.x * Math.min(age, 2), BASE.x - .5, BASE.x + .28), z0 = clamp(d.from.z + d.drift.z * Math.min(age, 2), wallZ + .06, BASE.z + .4);
        const ground = floorY, fallen0 = d.from.y - ground, speed = .55;
        const down = Math.min(fallen0, speed * age), landed = down >= fallen0, swing = landed ? 0 : Math.sin(age * 4 + d.phase);
        temp.position.set(x0 + .07 * swing, d.from.y - down + .003, z0 + .05 * Math.cos(age * 3.3 + d.phase));
        temp.rotation.set(landed ? -1.5 : swing * .9, d.phase, landed ? 0 : Math.cos(age * 4 + d.phase) * .7);
        temp.scale.setScalar(.075 * (age > 12 ? 1 - (age - 12) / 2 : 1));temp.updateMatrix();fallen.setMatrixAt(d.slot, temp.matrix);
      }
      fallen.instanceMatrix.needsUpdate = true;

      // butterflies: each heads for a flower, rests there with slow wingbeats, then picks another; the pointer scatters them
      const out = smooth(.6, .85, Math.min(g, gv));
      for (const b of butterflies) {
        b.root.visible = out > 0;
        if (!b.root.visible) continue;
        const flower = flowers[b.flower];
        if (!b.target || (b.rest > 0 && (b.rest -= dt) <= 0)) { b.flower = Math.floor(rand(b.phase * 100 + Math.floor(time), 141) * FLOWERS);b.target = flowers[b.flower].at.clone().add(v.set(0, .02, .03));b.rest = 0; }
        const toward = w.copy(b.target).sub(b.position), dist = toward.length();
        if (dist < .03 && b.rest <= 0) b.rest = 2 + rand(b.phase, Math.floor(time)) * 3;
        const steer = toward.normalize().multiplyScalar(b.rest > 0 ? 0 : 1.6);
        steer.x += Math.sin(time * 3.1 + b.phase) * .9;steer.y += Math.sin(time * 4.3 + b.phase * 2) * .9;
        if (ray) { const d = fromRay(b.position, near);if (d < .35) { steer.addScaledVector(near, (1 - d / .35) * 14);b.rest = 0; } }
        b.velocity.addScaledVector(steer, dt).multiplyScalar(Math.exp(-dt * 1.8)).clampLength(0, 1.1);
        if (b.rest > 0) b.velocity.multiplyScalar(Math.exp(-dt * 12));
        b.position.addScaledVector(b.velocity, dt);
        b.position.z = Math.max(b.position.z, wallZ + .05);b.position.y = clamp(b.position.y, floorY + .1, 2.4);
        b.root.position.copy(b.position);
        const heading = Math.atan2(b.velocity.x, b.velocity.z);
        b.root.rotation.set(.35, b.rest > 0 ? b.root.rotation.y : heading, 0);
        const beat = b.rest > 0 ? .5 + .45 * Math.sin(time * 4 + b.phase) : .26 + .9 * Math.sin(time * 34 + b.phase);
        b.wings[0].rotation.y = -beat;b.wings[1].rotation.y = beat;
        b.root.scale.setScalar(out);
        if (flower && b.rest > 0) flower.open = Math.max(flower.open, 1);
      }
    },
  };
}
