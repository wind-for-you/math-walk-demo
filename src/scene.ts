import * as THREE from 'three';
import {
  COLORS,
  PENDULUM_LENGTHS,
  PIVOTS,
  THETA0,
  VASE,
  bobPosition,
  type SmashSimulation,
} from './pendulum';
import {
  PHASE_BOUNDS,
  RACE_DURATION_SECONDS,
  type TimelineState,
} from './timeline';

export type DemoScene = {
  renderer: THREE.WebGLRenderer;
  dispose: () => void;
  setSimulation: (sim: SmashSimulation, seed: number) => void;
  update: (state: TimelineState) => void;
};

type PendulumVisual = {
  color: THREE.Color;
  rope: THREE.Line;
  ropePositions: Float32Array;
  ropeMat: THREE.LineBasicMaterial;
  bob: THREE.Mesh;
  bobMat: THREE.MeshStandardMaterial;
  glow: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
};

const BOB_RADIUS = 0.11;
const FLASH_DURATION = 0.55;
const SHARD_LIFE = 1.5;
const SHARD_COUNT = 18;
const BASE_FOG = 0.026;

const CAMERA_FOV = 50;
const FIT_HEIGHT = 7.0;
const WIDE_WIDTH = 7.2;
const CLOSE_WIDTH = 4.8;
const WIDE_CENTER = 0.5;
const CLOSE_CENTER = -0.5;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 在预计算样本中线性插值出 t 时刻的三摆状态 */
function sampleStates(sim: SmashSimulation, t: number) {
  const clamped = Math.min(sim.durationSeconds, Math.max(0, t));
  const raw = clamped / sim.dt;
  const i0 = Math.min(sim.samples.length - 1, Math.floor(raw));
  const i1 = Math.min(sim.samples.length - 1, i0 + 1);
  const f = raw - i0;
  return sim.samples[i0]!.states.map((a, index) => {
    const b = sim.samples[i1]!.states[index]!;
    return {
      theta: a.theta + (b.theta - a.theta) * f,
      omega: a.omega + (b.omega - a.omega) * f,
      L: a.L,
    };
  });
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
  const fog = new THREE.FogExp2(0x05070f, BASE_FOG);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    0.05,
    200,
  );

  scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x090b12, 0.55));
  const keyLight = new THREE.PointLight(0x9fd6ff, 26, 40);
  keyLight.position.set(4, 6.5, 9);
  scene.add(keyLight);

  const vaseLight = new THREE.PointLight(0xffb35c, 5, 7);
  vaseLight.position.set(VASE.x, VASE.y + 0.4, 1.4);
  scene.add(vaseLight);

  const impactLight = new THREE.PointLight(0xffd08a, 0, 8);
  scene.add(impactLight);

  const root = new THREE.Group();
  scene.add(root);

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  // ---- 地面与支架 ----
  const floorGeo = new THREE.CircleGeometry(7, 64);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x070b13,
    roughness: 0.95,
    metalness: 0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.04;
  root.add(floor);
  geos.push(floorGeo);
  mats.push(floorMat);

  const grid = new THREE.GridHelper(10, 20, 0x142435, 0x0a111a);
  grid.position.y = -0.03;
  root.add(grid);
  geos.push(grid.geometry);
  if (Array.isArray(grid.material)) mats.push(...grid.material);
  else mats.push(grid.material);

  const beamGeo = new THREE.BoxGeometry(3.0, 0.08, 0.16);
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x1e2938,
    metalness: 0.75,
    roughness: 0.35,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, 3.48, -0.02);
  root.add(beam);
  geos.push(beamGeo);
  mats.push(beamMat);

  // ---- 三个摆 ----
  const bobGeo = new THREE.SphereGeometry(BOB_RADIUS, 24, 16);
  const glowGeo = new THREE.SphereGeometry(BOB_RADIUS * 1.7, 16, 12);
  const anchorGeo = new THREE.SphereGeometry(0.05, 12, 12);
  geos.push(bobGeo, glowGeo, anchorGeo);

  const visuals: PendulumVisual[] = [];
  for (let i = 0; i < PENDULUM_LENGTHS.length; i++) {
    const color = new THREE.Color(COLORS[i]!);
    const pivot = PIVOTS[i]!;

    const ropePositions = new Float32Array([
      pivot.x,
      pivot.y,
      0,
      pivot.x,
      pivot.y - PENDULUM_LENGTHS[i]!,
      0,
    ]);
    const ropeGeo = new THREE.BufferGeometry();
    ropeGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(ropePositions, 3),
    );
    const ropeMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.75,
    });
    const rope = new THREE.Line(ropeGeo, ropeMat);
    rope.frustumCulled = false;
    root.add(rope);

    const bobMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.1,
      roughness: 0.3,
      metalness: 0.15,
      transparent: true,
      opacity: 1,
    });
    const bob = new THREE.Mesh(bobGeo, bobMat);
    root.add(bob);

    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    root.add(glow);

    const anchorMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
    });
    const anchor = new THREE.Mesh(anchorGeo, anchorMat);
    anchor.position.set(pivot.x, pivot.y, 0);
    root.add(anchor);

    geos.push(ropeGeo);
    mats.push(ropeMat, bobMat, glowMat, anchorMat);
    visuals.push({
      color,
      rope,
      ropePositions,
      ropeMat,
      bob,
      bobMat,
      glow,
      glowMat,
    });
  }

  // ---- 花瓶 ----
  const vaseGroup = new THREE.Group();
  vaseGroup.position.set(VASE.x, VASE.y, 0);
  vaseGroup.scale.setScalar(1.12);
  root.add(vaseGroup);

  const profile = [
    [0.001, -0.52],
    [0.1, -0.5],
    [0.135, -0.38],
    [0.155, -0.2],
    [0.16, 0.0],
    [0.13, 0.18],
    [0.075, 0.3],
    [0.07, 0.38],
    [0.095, 0.45],
    [0.12, 0.52],
  ].map(([x, y]) => new THREE.Vector2(x!, y!));
  const vaseGeo = new THREE.LatheGeometry(profile, 40);
  const vaseMat = new THREE.MeshStandardMaterial({
    color: 0xffd89a,
    emissive: 0xff9c3d,
    emissiveIntensity: 0.8,
    roughness: 0.28,
    metalness: 0.3,
    transparent: true,
    opacity: 1,
  });
  const vase = new THREE.Mesh(vaseGeo, vaseMat);
  vaseGroup.add(vase);
  geos.push(vaseGeo);
  mats.push(vaseMat);

  const rimGeo = new THREE.TorusGeometry(0.12, 0.012, 8, 32);
  const rim = new THREE.Mesh(rimGeo, vaseMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.52;
  vaseGroup.add(rim);
  geos.push(rimGeo);

  const pedestalGeo = new THREE.CylinderGeometry(0.24, 0.34, 0.28, 24);
  const pedestalMat = new THREE.MeshStandardMaterial({
    color: 0x1b2330,
    roughness: 0.8,
    metalness: 0.2,
    transparent: true,
    opacity: 1,
  });
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.set(VASE.x, 0.14, 0);
  root.add(pedestal);
  geos.push(pedestalGeo);
  mats.push(pedestalMat);

  const baseRingGeo = new THREE.TorusGeometry(0.37, 0.011, 8, 48);
  const baseRingMat = new THREE.MeshBasicMaterial({
    color: 0xffb35c,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.set(VASE.x, 0.02, 0);
  root.add(baseRing);
  geos.push(baseRingGeo);
  mats.push(baseRingMat);

  // ---- 砸中闪光与碎片 ----
  const flashGeo = new THREE.SphereGeometry(0.24, 20, 14);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.visible = false;
  flash.frustumCulled = false;
  root.add(flash);

  const flashRingGeo = new THREE.TorusGeometry(0.4, 0.02, 8, 48);
  const flashRingMat = new THREE.MeshBasicMaterial({
    color: 0xffc06a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flashRing = new THREE.Mesh(flashRingGeo, flashRingMat);
  flashRing.visible = false;
  flashRing.frustumCulled = false;
  root.add(flashRing);
  geos.push(flashGeo, flashRingGeo);
  mats.push(flashMat, flashRingMat);

  const shardGeo = new THREE.TetrahedronGeometry(0.075);
  const shardMat = new THREE.MeshBasicMaterial({
    color: 0xffcf8a,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shards: THREE.Mesh[] = [];
  const shardVels: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < SHARD_COUNT; i++) {
    const mesh = new THREE.Mesh(shardGeo, shardMat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    root.add(mesh);
    shards.push(mesh);
    const angle = i * 2.399963229728653;
    const speed = 1.5 + (i % 7) * 0.18;
    shardVels.push({
      x: Math.cos(angle) * speed,
      y: (0.35 + (i % 5) * 0.13) * speed,
      z: Math.sin(angle) * speed * 0.7,
    });
  }
  geos.push(shardGeo);
  mats.push(shardMat);

  // ---- 状态 ----
  let sim: SmashSimulation | null = null;
  let cameraPhase = 0;
  let smashWallTime = Infinity;
  const smashOrigin = new THREE.Vector3(VASE.x, VASE.y, 0);

  function setSimulation(next: SmashSimulation, seed: number): void {
    sim = next;
    cameraPhase = ((seed % 1000) / 1000) * Math.PI * 2;

    const winner =
      next.winnerIndex === null ? null : next.results[next.winnerIndex]!;
    smashWallTime =
      winner && winner.hitTime !== null
        ? (winner.hitTime / Math.max(next.durationSeconds, 1e-6)) *
          RACE_DURATION_SECONDS
        : Infinity;

    if (winner && winner.hitTime !== null) {
      const state = sampleStates(next, winner.hitTime)[winner.index]!;
      const p = bobPosition(PIVOTS[winner.index]!, state.L, state.theta);
      smashOrigin.set(p.x, p.y, 0);
    } else {
      smashOrigin.set(VASE.x, VASE.y, 0);
    }

    vaseGroup.visible = true;
    vaseMat.opacity = 1;
    pedestalMat.opacity = 1;
    baseRingMat.opacity = 0.45;
    flash.visible = false;
    flashRing.visible = false;
    flashMat.opacity = 0;
    flashRingMat.opacity = 0;
    impactLight.intensity = 0;
    shardMat.opacity = 1;
    for (const shard of shards) shard.visible = false;
    for (const v of visuals) {
      v.bobMat.emissiveIntensity = 1.1;
      v.bobMat.opacity = 1;
      v.bob.scale.setScalar(1);
      v.glowMat.opacity = 0.14;
      v.ropeMat.opacity = 0.75;
    }
    fog.density = BASE_FOG;
    renderer.setClearColor(0x05070f, 1);
  }

  function updateCamera(state: TimelineState, simTime: number): void {
    const zoom = smoothstep(0.35, 1.35, simTime);
    let width = WIDE_WIDTH + (CLOSE_WIDTH - WIDE_WIDTH) * zoom;
    const centerX = WIDE_CENTER + (CLOSE_CENTER - WIDE_CENTER) * zoom;
    if (state.phase === 'result') {
      width *= 1 - 0.08 * state.resultProgress;
    } else if (state.phase === 'reset') {
      width *= 1 + 0.12 * state.resetProgress;
    }

    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const aspect = Math.max(0.2, camera.aspect);
    const distance = Math.max(
      FIT_HEIGHT / 2 / tanHalf,
      width / 2 / (tanHalf * aspect),
    );

    const orbit = cameraPhase + state.loopTime * 0.045;
    const sway = Math.sin(orbit) * 0.28;
    camera.position.set(centerX + sway, 3.35 + 0.2 * zoom, distance);
    camera.lookAt(centerX + sway * 0.2, 1.55, 0);
  }

  function update(state: TimelineState): void {
    const fade = state.phase === 'reset' ? 1 - state.resetProgress : 1;
    const simTime = sim
      ? state.phase === 'intro'
        ? 0
        : state.raceProgress * sim.durationSeconds
      : 0;

    updateCamera(state, simTime);

    if (sim) {
      const winner =
        sim.winnerIndex === null ? null : sim.results[sim.winnerIndex]!;
      const hitTime = winner?.hitTime ?? null;
      const smashed = hitTime !== null && simTime >= hitTime;

      const lift =
        state.phase === 'intro'
          ? easeInOutCubic(
              clamp01(state.localTime / PHASE_BOUNDS.introEnd),
            )
          : 1;

      for (let i = 0; i < visuals.length; i++) {
        const v = visuals[i]!;
        let theta: number;
        let length: number;

        if (state.phase === 'intro') {
          length = PENDULUM_LENGTHS[i]!;
          theta = THETA0 * lift;
        } else {
          const frozen = hitTime !== null && winner?.index === i && smashed;
          const t = frozen ? hitTime! : simTime;
          const sample = sampleStates(sim, t)[i]!;
          theta = sample.theta;
          length = sample.L;
        }

        const pivot = PIVOTS[i]!;
        const p = bobPosition(pivot, length, theta);

        v.ropePositions[0] = pivot.x;
        v.ropePositions[1] = pivot.y;
        v.ropePositions[2] = 0;
        v.ropePositions[3] = p.x;
        v.ropePositions[4] = p.y;
        v.ropePositions[5] = 0;
        v.rope.geometry.attributes.position!.needsUpdate = true;

        v.bob.position.set(p.x, p.y, 0);
        v.glow.position.copy(v.bob.position);

        const isWinner = winner !== null && winner.index === i;
        if (state.phase === 'result' && isWinner) {
          const pulse = 0.5 + 0.5 * Math.sin(state.localTime * 6.5);
          v.bobMat.emissiveIntensity = 1.2 + 1.8 * pulse;
          v.bob.scale.setScalar(1 + 0.12 * pulse);
          v.glowMat.opacity = (0.2 + 0.2 * pulse) * fade;
        } else {
          v.bobMat.emissiveIntensity = 1.1;
          v.bob.scale.setScalar(1);
          v.glowMat.opacity = 0.14 * fade;
        }
        v.bobMat.opacity = fade;
        v.ropeMat.opacity = 0.75 * fade;
      }

      // 花瓶与命中特效
      if (!smashed) {
        vaseGroup.visible = true;
        vaseMat.emissiveIntensity =
          0.7 + 0.3 * Math.sin(state.loopTime * 3.1);
        vaseMat.opacity = fade;
        baseRingMat.opacity = (0.35 + 0.15 * Math.sin(state.loopTime * 3.1)) * fade;
        vaseLight.intensity = 5;
      } else {
        vaseGroup.visible = false;
        baseRingMat.opacity = 0;
        vaseLight.intensity = 0;
      }
      pedestalMat.opacity = fade;

      const sinceSmash =
        smashed && state.phase === 'race'
          ? state.localTime - smashWallTime
          : Infinity;

      if (sinceSmash >= 0 && sinceSmash < FLASH_DURATION) {
        const ft = clamp01(1 - sinceSmash / FLASH_DURATION);
        flash.visible = true;
        flashMat.opacity = 0.9 * ft * fade;
        flash.position.copy(smashOrigin);
        flash.scale.setScalar(0.5 + (1 - ft) * 4.2);
        flashRing.visible = true;
        flashRingMat.opacity = 0.75 * ft * fade;
        flashRing.position.copy(smashOrigin);
        flashRing.scale.setScalar(0.6 + (1 - ft) * 5.5);
        impactLight.position.copy(smashOrigin);
        impactLight.intensity = 30 * ft;
      } else {
        flash.visible = false;
        flashMat.opacity = 0;
        flashRing.visible = false;
        flashRingMat.opacity = 0;
        impactLight.intensity = 0;
      }

      if (sinceSmash >= 0 && sinceSmash < SHARD_LIFE) {
        const t = sinceSmash;
        const life = clamp01(1 - t / SHARD_LIFE);
        shardMat.opacity = life * fade;
        for (let i = 0; i < shards.length; i++) {
          const shard = shards[i]!;
          const vel = shardVels[i]!;
          shard.visible = true;
          shard.position.set(
            smashOrigin.x + vel.x * t,
            Math.max(
              0.02,
              smashOrigin.y + vel.y * t - 1.2 * t * t,
            ),
            vel.z * t,
          );
          shard.rotation.set(t * (1.7 + i * 0.13), t * (2.1 + i * 0.09), t * 1.3);
          shard.scale.setScalar(0.7 + 0.6 * life);
        }
      } else {
        for (const shard of shards) shard.visible = false;
      }
    }

    fog.density = BASE_FOG + state.resetProgress * 0.14;

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
    for (const geo of geos) geo.dispose();
    for (const mat of mats) mat.dispose();
    renderer.dispose();
  }

  return { renderer, dispose, setSimulation, update };
}
