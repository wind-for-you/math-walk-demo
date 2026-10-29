import * as THREE from 'three';
import {
  BALL_COLORS,
  SHELL_RADIUS,
  type RaceResult,
  type RaceBallResult,
} from './race';
import { PHASE_BOUNDS, type TimelineState } from './timeline';

export type DemoScene = {
  renderer: THREE.WebGLRenderer;
  dispose: () => void;
  setRace: (race: RaceResult) => void;
  update: (state: TimelineState) => void;
};

type BallVisual = {
  result: RaceBallResult | null;
  color: THREE.Color;
  trailGeo: THREE.BufferGeometry;
  trailMat: THREE.LineBasicMaterial;
  trailPositions: Float32Array;
  trailColors: Float32Array;
  ball: THREE.Mesh;
  ballMat: THREE.MeshStandardMaterial;
  flash: THREE.Mesh;
  flashMat: THREE.MeshBasicMaterial;
};

const FLASH_DURATION = 0.55;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
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
  const baseFogDensity = 0.045;
  scene.fog = new THREE.FogExp2(0x05070f, baseFogDensity);

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.05,
    200,
  );

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.PointLight(0x9fd6ff, 25, 30);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const root = new THREE.Group();
  scene.add(root);

  // 包裹壳：半透明球面 + 淡线框
  const shellGeo = new THREE.SphereGeometry(SHELL_RADIUS, 32, 20);
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0x4d7ea8,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  root.add(shell);

  const shellWireGeo = new THREE.WireframeGeometry(shellGeo);
  const shellWireMat = new THREE.LineBasicMaterial({
    color: 0x5f8fb4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const shellWire = new THREE.LineSegments(shellWireGeo, shellWireMat);
  root.add(shellWire);

  // 原点
  const anchorGeo = new THREE.SphereGeometry(0.035, 12, 12);
  const anchorMat = new THREE.MeshBasicMaterial({
    color: 0xffc857,
    transparent: true,
    opacity: 0.9,
  });
  const anchor = new THREE.Mesh(anchorGeo, anchorMat);
  root.add(anchor);

  const ballGeo = new THREE.SphereGeometry(0.06, 16, 16);
  const flashGeo = new THREE.SphereGeometry(0.11, 12, 12);
  const maxVertices = 401; // DEFAULT_STEPS <= 400 → points <= 401

  const visuals: BallVisual[] = [];
  for (let i = 0; i < BALL_COLORS.length; i++) {
    const color = new THREE.Color(BALL_COLORS[i]!);

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
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    root.add(trail);

    const ballMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.8,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 1,
    });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    root.add(ball);

    const flashMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.visible = false;
    root.add(flash);

    visuals.push({
      result: null,
      color,
      trailGeo,
      trailMat,
      trailPositions,
      trailColors,
      ball,
      ballMat,
      flash,
      flashMat,
    });
  }

  let race: RaceResult | null = null;
  let cameraPhase = 0;

  function setRace(next: RaceResult): void {
    race = next;
    cameraPhase = ((next.seed % 1000) / 1000) * Math.PI * 2;
    renderer.setClearColor(0x05070f, 1);

    for (let i = 0; i < visuals.length; i++) {
      const v = visuals[i]!;
      const ball = next.balls[i] ?? null;
      v.result = ball;
      v.trailGeo.setDrawRange(0, ball ? 1 : 0);
      v.trailPositions.fill(0);
      v.trailColors.fill(0);
      v.trailGeo.attributes.position!.needsUpdate = true;
      v.trailGeo.attributes.color!.needsUpdate = true;
      v.trailMat.opacity = 0.95;

      v.ball.position.set(0, 0, 0);
      v.ball.scale.setScalar(1);
      v.ball.visible = ball !== null;
      v.ballMat.opacity = 1;
      v.ballMat.emissiveIntensity = 0.8;

      v.flash.visible = false;
      v.flashMat.opacity = 0;
      if (ball && ball.hitStep !== null) {
        const p = ball.walk.points[ball.hitStep]!;
        v.flash.position.set(p.x, p.y, p.z);
      }
    }
  }

  function writeTrail(
    v: BallVisual,
    points: RaceBallResult['walk']['points'],
    count: number,
    fade: number,
  ): void {
    const n = Math.max(1, Math.min(count, points.length));
    for (let i = 0; i < n; i++) {
      const p = points[i]!;
      v.trailPositions[i * 3] = p.x;
      v.trailPositions[i * 3 + 1] = p.y;
      v.trailPositions[i * 3 + 2] = p.z;
      // 越新越亮
      const head = n <= 1 ? 1 : i / (n - 1);
      const alpha = (0.12 + 0.88 * head) * fade;
      v.trailColors[i * 4] = v.color.r;
      v.trailColors[i * 4 + 1] = v.color.g;
      v.trailColors[i * 4 + 2] = v.color.b;
      v.trailColors[i * 4 + 3] = alpha;
    }
    v.trailGeo.attributes.position!.needsUpdate = true;
    v.trailGeo.attributes.color!.needsUpdate = true;
    v.trailGeo.setDrawRange(0, n);
  }

  function framingDistance(): number {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = Math.max(0.2, camera.aspect);
    const fitR = SHELL_RADIUS + 0.55;
    const halfH = Math.max(fitR, fitR / aspect);
    return halfH / Math.tan(vFov / 2);
  }

  function updateCamera(state: TimelineState): void {
    const orbit = cameraPhase + state.loopTime * 0.09;
    const r = framingDistance() + state.raceProgress * 0.4;
    const y = 0.45 + state.raceProgress * 0.3;
    camera.position.set(Math.cos(orbit) * r, y, Math.sin(orbit) * r);
    camera.lookAt(0, 0, 0);
  }

  function update(state: TimelineState): void {
    updateCamera(state);

    if (!race) {
      renderer.render(scene, camera);
      return;
    }

    const fade = state.phase === 'reset' ? 1 - state.resetProgress : 1;
    const introGlow =
      state.phase === 'intro'
        ? clamp01(state.localTime / PHASE_BOUNDS.introEnd)
        : 1;
    const shellMul = state.phase === 'reset' ? fade : introGlow;
    shellMat.opacity = 0.09 * shellMul;
    shellWireMat.opacity = 0.16 * shellMul;

    const steps = Math.max(1, race.balls[0]!.walk.points.length - 1);
    const elapsedSteps = state.raceProgress * steps;

    for (const v of visuals) {
      const ball = v.result;
      if (!ball) {
        v.ball.visible = false;
        continue;
      }
      v.ball.visible = true;
      const hitStep = ball.hitStep;
      const capped = hitStep === null ? elapsedSteps : Math.min(elapsedSteps, hitStep);
      const visibleCount = Math.max(1, Math.floor(capped) + 1);

      const points = ball.walk.points;
      writeTrail(v, points, visibleCount, fade);

      const i0 = Math.min(Math.floor(capped), points.length - 1);
      const i1 = Math.min(points.length - 1, i0 + 1);
      const frac = capped - i0;
      const a = points[i0]!;
      const b = points[i1]!;
      v.ball.position.set(
        a.x + (b.x - a.x) * frac,
        a.y + (b.y - a.y) * frac,
        a.z + (b.z - a.z) * frac,
      );

      v.trailMat.opacity = 0.95 * fade;
      v.ballMat.opacity = fade;
      v.ball.scale.setScalar(1);

      // 撞墙闪光：越过 hitStep 后的一瞬
      if (hitStep !== null && elapsedSteps >= hitStep) {
        const sinceHit =
          ((elapsedSteps - hitStep) / steps) *
          (PHASE_BOUNDS.raceEnd - PHASE_BOUNDS.introEnd);
        const flashT = clamp01(1 - sinceHit / FLASH_DURATION);
        v.flash.visible = flashT > 0;
        v.flashMat.opacity = 0.9 * flashT * fade;
        v.flash.scale.setScalar(0.7 + sinceHit * 5);
      } else {
        v.flash.visible = false;
        v.flashMat.opacity = 0;
      }

      // 结果阶段：冠军球呼吸发光
      if (state.phase === 'result' && race.winnerIndex === ball.index) {
        const pulse = 0.5 + 0.5 * Math.sin(state.localTime * 7);
        v.ballMat.emissiveIntensity = 1.1 + 1.6 * pulse;
        v.ball.scale.setScalar(1 + 0.22 * pulse);
      } else {
        v.ballMat.emissiveIntensity = 0.8;
      }
    }

    anchorMat.opacity = 0.9 * fade;
    (scene.fog as THREE.FogExp2).density = baseFogDensity + state.resetProgress * 0.25;

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
    shellGeo.dispose();
    shellMat.dispose();
    shellWireGeo.dispose();
    shellWireMat.dispose();
    anchorGeo.dispose();
    anchorMat.dispose();
    ballGeo.dispose();
    flashGeo.dispose();
    for (const v of visuals) {
      v.trailGeo.dispose();
      v.trailMat.dispose();
      v.ballMat.dispose();
      v.flashMat.dispose();
    }
    renderer.dispose();
  }

  return { renderer, dispose, setRace, update };
}
