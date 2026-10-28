import './style.css';
import * as THREE from 'three';

const canvas = document.querySelector<HTMLCanvasElement>('#c');
if (!canvas) {
  throw new Error('#c canvas missing');
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05070f, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0, 4);

const geo = new THREE.SphereGeometry(0.05, 16, 16);
const mat = new THREE.MeshBasicMaterial({ color: 0x66e0ff });
scene.add(new THREE.Mesh(geo, mat));

function onResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

function tick(): void {
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
