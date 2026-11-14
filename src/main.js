import * as THREE from 'three';
import { createSatellite } from './satellite.js';
import { createEarthEnvironment } from './earth.js';
import { createStarfield } from './stars.js';
import { SpacewalkController } from './controller.js';
import { VisorHUD } from './hud.js';
import { WorkbenchUI } from './workbench.js';
import { gameState } from './gameState.js';
import { spaceAudio } from './audio.js';

// Setup Three.js Core
const canvas = document.getElementById('webgl-canvas');
const interactPrompt = document.getElementById('interact-prompt');
const scene = new THREE.Scene();
scene.fog = null;

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Controller & HUD
const controller = new SpacewalkController(camera, canvas);
const hud = new VisorHUD();

// Build Scene Elements
const starfield = createStarfield();
scene.add(starfield);

const earthEnv = createEarthEnvironment((status, isNominal) => {
  hud.updateEarthStatus(status, isNominal);
});
scene.add(earthEnv.group);

const satellite = createSatellite();
scene.add(satellite.mesh);

// Initialize Satellite with current GameState Loadout & Tuning
satellite.updateLoadout(gameState.loadout, gameState.tuning);

// Orbital Customization Workbench
let isWorkbenchMode = false;
const flightCameraPos = new THREE.Vector3(0, 0.5, 5.2);
const workbenchCameraPos = new THREE.Vector3(2.6, 1.8, 6.4);
const workbenchLookTarget = new THREE.Vector3(-0.6, 0, 0);

function toggleWorkbench() {
  isWorkbenchMode = !isWorkbenchMode;
  controller.isWorkbenchOpen = isWorkbenchMode;

  if (isWorkbenchMode) {
    flightCameraPos.copy(camera.position);
    controller.disengage();
    workbenchUI.show();
  } else {
    workbenchUI.hide();
  }
}

const workbenchUI = new WorkbenchUI(
  (loadout, tuning) => {
    satellite.updateLoadout(loadout, tuning);
  },
  () => {
    toggleWorkbench();
  }
);

// Bind Controller Callbacks
controller.onLockChange = (isLocked) => {
  hud.setLockedState(isLocked);
};

controller.onToggleHUD = () => {
  hud.toggleVisibility();
};

controller.onToggleWorkbench = () => {
  toggleWorkbench();
};

if (interactPrompt) {
  interactPrompt.addEventListener('click', () => {
    if (!isWorkbenchMode) toggleWorkbench();
  });
}

// Window Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Render Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsedTime = clock.getElapsedTime();

  // Mode-based Camera Transitions
  if (isWorkbenchMode) {
    // Smoothly glide camera to the orbital workbench framing position
    camera.position.lerp(workbenchCameraPos, delta * 3.5);
    // Smoothly look at the satellite offset to the left of the screen
    const currentLook = new THREE.Vector3();
    camera.getWorldDirection(currentLook);
    const targetDir = workbenchLookTarget.clone().sub(camera.position).normalize();
    const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), targetDir);
    camera.quaternion.slerp(targetQuat, delta * 3.5);
  } else {
    // Free first-person spacewalk flight
    controller.update(delta);
  }

  // Update Scene Elements
  satellite.update(delta, elapsedTime);
  earthEnv.update(delta);
  hud.update(controller, satellite.getCenterPosition());

  // Proximity prompt to customize satellite
  if (interactPrompt) {
    const dist = controller.getPosition().distanceTo(satellite.getCenterPosition());
    if (dist < 14 && !isWorkbenchMode) {
      interactPrompt.style.display = 'flex';
    } else {
      interactPrompt.style.display = 'none';
    }
  }

  renderer.render(scene, camera);
}

// Start
animate();
