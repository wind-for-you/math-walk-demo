import * as THREE from 'three';
import type { WalkResult, Vec3 } from './walk';
import type { TimelineState } from './timeline';

export type DemoScene = {
  renderer: THREE.WebGLRenderer;
  dispose: () => void;
  setWalk: (walk: WalkResult) => void;
  update: (state: TimelineState) => void;
};

function toVector3(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
}

export function createDemoScene(canvas: HTMLCanvasElement): DemoScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x05070f, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070f, 0.045);

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.05,
    200,
  );

  const root = new THREE.Group();
  scene.add(root);

  // 起点锚点
  const anchorMat = new THREE.MeshBasicMaterial({
    color: 0xffc857,
    transparent: true,
    opacity: 0.85,
  });
  const anchor = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), anchorMat);
  root.add(anchor);

  // 游走粒子
  const particleMat = new THREE.MeshBasicMaterial({
    color: 0x66e0ff,
    transparent: true,
    opacity: 1,
  });
  const particle = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 16),
    particleMat,
  );
  root.add(particle);

  // 轨迹丝带（Line + vertex colors）
  const maxVertices = 401; // N<=400 → points <= 401
  const trailPositions = new Float32Array(maxVertices * 3);
  const trailColors = new Float32Array(maxVertices * 4);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(trailPositions, 3),
  );
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 4));
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const trail = new THREE.Line(trailGeo, trailMat);
  root.add(trail);

  // 对比弦线（起点→终点）
  const chordPositions = new Float32Array(6);
  const chordGeo = new THREE.BufferGeometry();
  chordGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(chordPositions, 3),
  );
  const chordMat = new THREE.LineBasicMaterial({
    color: 0xff9a5a,
    transparent: true,
    opacity: 0,
  });
  const chord = new THREE.Line(chordGeo, chordMat);
  root.add(chord);

  let walk: WalkResult | null = null;
  let cameraPhase = 0;

  function setWalk(next: WalkResult): void {
    walk = next;
    cameraPhase = (next.seed % 1000) / 1000 * Math.PI * 2;
    particle.position.set(0, 0, 0);
    anchor.position.set(0, 0, 0);
    trailGeo.setDrawRange(0, 0);
    chordMat.opacity = 0;
    particleMat.opacity = 1;
    trailMat.opacity = 1;
    anchorMat.opacity = 0.85;
    renderer.setClearColor(0x05070f, 1);

    const start = next.points[0]!;
    const end = next.points[next.points.length - 1]!;
    chordPositions[0] = start.x;
    chordPositions[1] = start.y;
    chordPositions[2] = start.z;
    chordPositions[3] = end.x;
    chordPositions[4] = end.y;
    chordPositions[5] = end.z;
    chordGeo.attributes.position!.needsUpdate = true;
  }

  function updateTrail(visibleCount: number): void {
    if (!walk) return;
    const n = Math.max(1, Math.min(visibleCount, walk.points.length));
    for (let i = 0; i < n; i++) {
      const p = walk.points[i]!;
      trailPositions[i * 3] = p.x;
      trailPositions[i * 3 + 1] = p.y;
      trailPositions[i * 3 + 2] = p.z;
      // 越旧越淡：i=0 最淡，i=n-1 最亮
      const age = n <= 1 ? 1 : i / (n - 1);
      const a = 0.15 + 0.85 * age;
      trailColors[i * 4] = 0.4;
      trailColors[i * 4 + 1] = 0.88;
      trailColors[i * 4 + 2] = 1.0;
      trailColors[i * 4 + 3] = a;
    }
    trailGeo.attributes.position!.needsUpdate = true;
    trailGeo.attributes.color!.needsUpdate = true;
    trailGeo.setDrawRange(0, n);
  }

  function updateCamera(state: TimelineState): void {
    const orbit = cameraPhase + state.loopTime * 0.12;
    const baseR = 3.2;
    const pull = state.walkProgress * 0.9 + state.compareProgress * 0.3;
    const r = baseR + pull;
    const y = 0.55 + state.walkProgress * 0.35;
    camera.position.set(
      Math.cos(orbit) * r,
      y,
      Math.sin(orbit) * r,
    );
    camera.lookAt(0, 0, 0);
  }

  function update(state: TimelineState): void {
    if (!walk) return;

    const idxFloat = state.walkProgress * (walk.points.length - 1);
    const i0 = Math.floor(idxFloat);
    const i1 = Math.min(walk.points.length - 1, i0 + 1);
    const frac = idxFloat - i0;
    const a = walk.points[i0]!;
    const b = walk.points[i1]!;
    particle.position.set(
      a.x + (b.x - a.x) * frac,
      a.y + (b.y - a.y) * frac,
      a.z + (b.z - a.z) * frac,
    );

    updateTrail(i1 + 1);
    updateCamera(state);

    // compare：暖色弦淡入
    if (state.phase === 'compare' || state.phase === 'reset') {
      chordMat.opacity = Math.min(1, state.compareProgress * 1.2) * 0.95;
    } else {
      chordMat.opacity = 0;
    }

    // reset：淡出到黑
    if (state.phase === 'reset') {
      const fade = 1 - state.resetProgress;
      particleMat.opacity = fade;
      trailMat.opacity = fade;
      anchorMat.opacity = 0.85 * fade;
      chordMat.opacity *= fade;
      const c = 0x05070f;
      renderer.setClearColor(c, 1);
      // 通过雾密度略增强化淡出
      (scene.fog as THREE.FogExp2).density = 0.045 + state.resetProgress * 0.25;
    } else {
      particleMat.opacity = 1;
      trailMat.opacity = 1;
      anchorMat.opacity = 0.85;
      (scene.fog as THREE.FogExp2).density = 0.045;
    }

    // intro：粒子在原点高亮，轨迹为空
    if (state.phase === 'intro') {
      particle.position.set(0, 0, 0);
      updateTrail(1);
    }

    renderer.render(scene, camera);
  }

  function onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  onResize();

  function dispose(): void {
    window.removeEventListener('resize', onResize);
    trailGeo.dispose();
    trailMat.dispose();
    chordGeo.dispose();
    chordMat.dispose();
    particle.geometry.dispose();
    particleMat.dispose();
    anchor.geometry.dispose();
    anchorMat.dispose();
    renderer.dispose();
  }

  return { renderer, dispose, setWalk, update };
}

// 保留 Vec3 转向量工具供调试（避免 unused 可删）
void toVector3;
