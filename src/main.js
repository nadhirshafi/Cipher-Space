import * as THREE from 'three';
import { createSatellite } from './satellite.js';
import { createEarthEnvironment } from './earth.js';
import { createStarfield } from './stars.js';
import { SpacewalkController } from './controller.js';
import { VisorHUD } from './hud.js';
import { gameState } from './gameState.js';
import { spaceAudio } from './audio.js';

// Setup Three.js Core
const canvas = document.getElementById('webgl-canvas');
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

// Controller & Visor HUD
const controller = new SpacewalkController(camera, canvas);
const hud = new VisorHUD();

// Build Scene Elements
const starfield = createStarfield();
scene.add(starfield);

const earthEnv = createEarthEnvironment();
scene.add(earthEnv.group);

const satellite = createSatellite();
scene.add(satellite.mesh);

// Pass satellite interactive colliders to Controller raycaster
controller.setInteractiveObjects(satellite.getInteractiveObjects());

// Sync Game State & Satellite
function syncState() {
  const metrics = gameState.computeMetrics();
  satellite.setAvionicsReady(metrics.isVictory);
  hud.updateMissionTracker(gameState);
}

gameState.onStateChange = () => {
  syncState();
};

// Initialize Satellite with current GameState Loadout & Tuning
satellite.updateLoadout(gameState.loadout, gameState.tuning);
syncState();

// Bind Controller Callbacks for 3D In-World Spacewalk Interaction
controller.onLockChange = (isLocked) => {
  hud.setLockedState(isLocked);
};

controller.onToggleHUD = () => {
  hud.toggleVisibility();
};

controller.onHoverChange = (hoveredObject) => {
  if (hoveredObject) {
    satellite.highlightTarget(hoveredObject);
  } else {
    satellite.clearHighlight();
  }
  hud.updateEvaPrompt(hoveredObject, gameState, controller.isDraggingTune);
};

controller.onDragStateChange = (isDragging, data) => {
  hud.updateEvaPrompt(controller.hoveredObject, gameState, isDragging);
};

controller.onCycleComponent = (category) => {
  const newPart = gameState.cycleComponent(category);
  if (newPart) {
    satellite.updateLoadout(gameState.loadout, gameState.tuning);
    syncState();
    hud.updateEvaPrompt(controller.hoveredObject, gameState, false);
  }
};

controller.onTuneDelta = (tuneParam, delta) => {
  gameState.adjustTuningDelta(tuneParam, delta);
  satellite.applyTuning(gameState.tuning);
  syncState();
  hud.updateEvaPrompt(controller.hoveredObject, gameState, true);
};

controller.onActivateAvionics = () => {
  const metrics = gameState.computeMetrics();
  if (!metrics.isVictory) {
    spaceAudio.playClick();
    return;
  }

  // Trigger dramatic orbital launch sequence
  satellite.triggerLaunchSequence(() => {
    hud.showLaunchModal(gameState.getCurrentScenario(), metrics, () => {
      const hasNext = gameState.nextScenario();
      if (!hasNext) {
        // Loop back or reset
        gameState.setScenario(0);
      }
      satellite.updateLoadout(gameState.loadout, gameState.tuning);
      syncState();
    });
  });
};

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

  // Free first-person spacewalk flight & raycasting
  controller.update(delta);

  // Update Scene Elements
  satellite.update(delta, elapsedTime);
  earthEnv.update(delta);
  hud.update(controller, satellite.getCenterPosition());

  renderer.render(scene, camera);
}

// Start Game Loop
animate();
