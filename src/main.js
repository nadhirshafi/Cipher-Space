import * as THREE from 'three';
import { createSatellite } from './satellite.js';
import { createEarthEnvironment } from './earth.js';
import { createStarfield } from './stars.js';
import { SpacewalkController } from './controller.js';
import { VisorHUD } from './hud.js';
import { gameState } from './gameState.js';
import { spaceAudio } from './audio.js';
import { AstronautAvatar, ROLE_CONFIGS } from './astronaut.js';
import { networkManager } from './network.js';
import { CrewLobby } from './lobby.js';
import { MultiplayerHUD } from './multiplayerHud.js';

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
renderer.shadowMap.type = THREE.PCFShadowMap;

// Controller & Visor HUD
const controller = new SpacewalkController(camera, canvas);
const hud = new VisorHUD();
const multiplayerHud = new MultiplayerHUD(scene);

// Remote Astronaut Avatars Map: playerId -> AstronautAvatar
const remoteAvatars = new Map();
let isMultiplayerSession = false;
let myAssignedRole = 'power';

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

// Role-to-Category Permission Check
function hasRolePermission(category) {
  if (!isMultiplayerSession) return true; // Solo allows all
  if (myAssignedRole === 'commander') {
    return category === 'science' || category === 'avionics';
  }
  if (myAssignedRole === 'power') {
    return category === 'power';
  }
  if (myAssignedRole === 'comms') {
    return category === 'comms';
  }
  if (myAssignedRole === 'thermal') {
    return category === 'chassis';
  }
  return false;
}

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
  if (!hasRolePermission(category)) {
    spaceAudio.playClick();
    multiplayerHud.addRadioLogEntry('SYSTEM', 'commander', `Access denied. Subsystem restricted to specialist.`);
    return;
  }

  const newPart = gameState.cycleComponent(category);
  if (newPart) {
    satellite.updateLoadout(gameState.loadout, gameState.tuning);
    syncState();
    hud.updateEvaPrompt(controller.hoveredObject, gameState, false);

    if (isMultiplayerSession) {
      networkManager.sendSatelliteModify(category, 'swap', newPart.id, {
        loadout: gameState.loadout,
        tuning: gameState.tuning
      });
    }
  }
};

controller.onTuneDelta = (tuneParam, delta) => {
  let cat = 'power';
  if (tuneParam === 'commsPower') cat = 'comms';
  else if (tuneParam === 'radiatorLouvers') cat = 'chassis';
  else if (tuneParam === 'sensorRate') cat = 'science';

  if (!hasRolePermission(cat)) {
    return;
  }

  const newVal = gameState.adjustTuningDelta(tuneParam, delta);
  satellite.applyTuning(gameState.tuning);
  syncState();
  hud.updateEvaPrompt(controller.hoveredObject, gameState, true);

  if (isMultiplayerSession) {
    networkManager.sendSatelliteModify(cat, 'tune', { param: tuneParam, val: newVal }, {
      loadout: gameState.loadout,
      tuning: gameState.tuning
    });
  }
};

controller.onPingWaypoint = (pos, label) => {
  multiplayerHud.spawnWaypointPing(pos, label, myAssignedRole, networkManager.localCallsign || 'Astronaut');
  if (isMultiplayerSession) {
    networkManager.sendTeamPing(pos, label);
  }
};

controller.onActivateAvionics = () => {
  if (!hasRolePermission('avionics')) {
    spaceAudio.playClick();
    multiplayerHud.addRadioLogEntry('SYSTEM', 'commander', `Orbital Launch authorization reserved for Commander.`);
    return;
  }

  const metrics = gameState.computeMetrics();
  if (!metrics.isVictory) {
    spaceAudio.playClick();
    multiplayerHud.addRadioLogEntry('SYSTEM', 'commander', `Launch aborted. Subsystems not in equilibrium.`);
    return;
  }

  // Trigger dramatic orbital launch sequence
  satellite.triggerLaunchSequence(() => {
    hud.showLaunchModal(gameState.getCurrentScenario(), metrics, () => {
      const hasNext = gameState.nextScenario();
      if (!hasNext) {
        gameState.setScenario(0);
      }
      satellite.updateLoadout(gameState.loadout, gameState.tuning);
      syncState();

      if (isMultiplayerSession) {
        networkManager.sendAdvanceMission(gameState.currentScenarioIndex);
      }
    });
  });
};

// ==========================================
// NETWORK EVENT INTEGRATION
// ==========================================
function setupNetworkEvents() {
  networkManager.onPlayerJoined = (player) => {
    if (player.id === networkManager.selfId) return;
    if (!remoteAvatars.has(player.id)) {
      const avatar = new AstronautAvatar(player.id, player.callsign, player.role);
      if (player.transform && player.transform.pos) {
        avatar.group.position.set(...player.transform.pos);
      }
      scene.add(avatar.group);
      remoteAvatars.set(player.id, avatar);
      multiplayerHud.addRadioLogEntry(player.callsign, player.role, 'Joined orbital spacewalk.');
    }
  };

  networkManager.onPlayerLeft = (playerId) => {
    if (remoteAvatars.has(playerId)) {
      const avatar = remoteAvatars.get(playerId);
      avatar.dispose();
      remoteAvatars.delete(playerId);
      multiplayerHud.addRadioLogEntry('CREW', 'commander', `Astronaut departed orbital zone.`);
    }
  };

  networkManager.onPlayerTransform = (playerId, transform) => {
    if (remoteAvatars.has(playerId)) {
      const avatar = remoteAvatars.get(playerId);
      avatar.setTargetTransform(transform.pos, transform.rot, transform.thrusters);
    }
  };

  networkManager.onRoleUpdated = (playerId, role) => {
    if (remoteAvatars.has(playerId)) {
      remoteAvatars.get(playerId).setRole(role);
    }
  };

  networkManager.onSatelliteUpdated = (satelliteState, modifiedBy, category) => {
    if (modifiedBy === networkManager.selfId) return;

    if (satelliteState.loadout) {
      Object.assign(gameState.loadout, satelliteState.loadout);
    }
    if (satelliteState.tuning) {
      Object.assign(gameState.tuning, satelliteState.tuning);
    }
    satellite.updateLoadout(gameState.loadout, gameState.tuning);
    syncState();
  };

  networkManager.onTeamPing = (msg) => {
    if (msg.playerId === networkManager.selfId) return;
    multiplayerHud.spawnWaypointPing(new THREE.Vector3(...msg.worldPos), msg.label, msg.role, msg.callsign);
  };

  networkManager.onRadioMessage = (msg) => {
    if (msg.playerId === networkManager.selfId) return;
    multiplayerHud.addRadioLogEntry(msg.callsign, msg.role, msg.text);
    spaceAudio.playHoverPing();
  };

  networkManager.onMissionAdvanced = (scenarioIndex) => {
    gameState.setScenario(scenarioIndex);
    satellite.updateLoadout(gameState.loadout, gameState.tuning);
    syncState();
    multiplayerHud.addRadioLogEntry('MISSION', 'commander', `Mission scenario advanced to Scenario ${scenarioIndex + 1}!`);
  };
}

// 4-Player Crew Lobby Initialization
const lobby = new CrewLobby((sessionData) => {
  isMultiplayerSession = sessionData.isMultiplayer;
  myAssignedRole = sessionData.role || 'power';

  if (isMultiplayerSession && sessionData.room) {
    // Populate any existing players in room
    sessionData.room.players.forEach(p => {
      if (p.id !== networkManager.selfId) {
        networkManager.onPlayerJoined(p);
      }
    });

    if (sessionData.room.satelliteState) {
      Object.assign(gameState.loadout, sessionData.room.satelliteState.loadout);
      Object.assign(gameState.tuning, sessionData.room.satelliteState.tuning);
      satellite.updateLoadout(gameState.loadout, gameState.tuning);
      syncState();
    }
  }

  // Engage Zero-G Spacewalk Flight Controls
  controller.engage();
});

setupNetworkEvents();

// Window Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Render Loop Timing
let lastTime = performance.now();
let totalElapsedTime = 0;

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  totalElapsedTime += delta;

  // Free first-person spacewalk flight & raycasting
  controller.update(delta);

  // Send local transform to server (throttled 20Hz)
  if (isMultiplayerSession && networkManager.isConnected) {
    const isThrusting = controller.getSpeed() > 0.05;
    networkManager.sendTransform(camera.position, camera.quaternion, isThrusting, null);
  }

  // Update remote astronauts in 3D
  remoteAvatars.forEach(avatar => {
    avatar.update(delta, totalElapsedTime);
  });

  // Update Scene Elements & HUDs
  satellite.update(delta, totalElapsedTime);
  earthEnv.update(delta);
  hud.update(controller, satellite.getCenterPosition());
  multiplayerHud.update(delta, camera.position);

  if (isMultiplayerSession && networkManager.currentRoom) {
    multiplayerHud.updateCrewRoster(networkManager.currentRoom, camera.position, remoteAvatars);
  }

  renderer.render(scene, camera);
}

// Start Game Loop
animate();
