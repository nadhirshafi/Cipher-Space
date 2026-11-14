import * as THREE from 'three';
import {
  createGoldFoilTexture,
  createSolarPanelTexture,
  createBumpMap
} from './textures.js';
import { spaceAudio } from './audio.js';

export function createSatellite() {
  const satelliteRoot = new THREE.Group();
  satelliteRoot.name = 'SatelliteRoot';

  // Shared Textures
  const goldFoilTex = createGoldFoilTexture();
  const solarPanelTex = createSolarPanelTexture();
  const bumpTex = createBumpMap();

  // Shared Materials
  const goldFoilMat = new THREE.MeshStandardMaterial({
    map: goldFoilTex,
    bumpMap: bumpTex,
    bumpScale: 0.05,
    metalness: 0.88,
    roughness: 0.28,
    color: 0xffd700
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0xd8d8d8,
    metalness: 0.92,
    roughness: 0.22
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x22262d,
    metalness: 0.82,
    roughness: 0.38
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x181c22,
    metalness: 0.6,
    roughness: 0.3,
    bumpMap: bumpTex,
    bumpScale: 0.02
  });

  const solarPanelMat = new THREE.MeshStandardMaterial({
    map: solarPanelTex,
    metalness: 0.92,
    roughness: 0.15,
    color: 0x99ccff
  });

  const whiteCeramicMat = new THREE.MeshStandardMaterial({
    color: 0xf2f4f8,
    metalness: 0.1,
    roughness: 0.3
  });

  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: 0xe6a117,
    metalness: 0.95,
    roughness: 0.2
  });

  const cyanGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff
  });

  // Wireframe highlight material for blueprint snap
  const wireframeSnapMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });

  // Subsystem Slots
  const chassisSlot = new THREE.Group();
  chassisSlot.name = 'Slot_Chassis';
  satelliteRoot.add(chassisSlot);

  const powerSlot = new THREE.Group();
  powerSlot.name = 'Slot_Power';
  satelliteRoot.add(powerSlot);

  const commsSlot = new THREE.Group();
  commsSlot.name = 'Slot_Comms';
  satelliteRoot.add(commsSlot);

  const scienceSlot = new THREE.Group();
  scienceSlot.name = 'Slot_Science';
  satelliteRoot.add(scienceSlot);

  // Louver reference for real-time rotation
  let activeLouvers = [];
  let activeSolarWings = [];
  let activeLaserEmitters = [];
  let activeSensorPulseMesh = null;

  // Track currently mounted parts
  let currentParts = {
    chassis: null,
    power: null,
    comms: null,
    science: null
  };

  // Wireframe snap effect timer
  let snapHighlightTime = 0;
  let snapGhostMesh = null;

  function triggerSnapEffect(targetGroup) {
    if (snapGhostMesh) {
      satelliteRoot.remove(snapGhostMesh);
      snapGhostMesh = null;
    }
    spaceAudio.playHydraulicLock();

    // Duplicate clone with wireframe for 0.4s snap flash
    try {
      const clone = targetGroup.clone(true);
      clone.traverse((child) => {
        if (child.isMesh) {
          child.material = wireframeSnapMat;
        }
      });
      snapGhostMesh = clone;
      satelliteRoot.add(snapGhostMesh);
      snapHighlightTime = 0.45;
    } catch (e) {
      console.warn('Wireframe clone snap effect skipped', e);
    }
  }

  // ==========================================
  // BUILDERS: CHASSIS MODULES
  // ==========================================
  function buildChassis(type) {
    activeLouvers = [];
    const group = new THREE.Group();

    if (type === 'gold_mylar') {
      // Classic Gold Mylar bus
      const coreGeo = new THREE.BoxGeometry(2.4, 3.6, 2.2);
      const core = new THREE.Mesh(coreGeo, goldFoilMat);
      core.castShadow = true;
      group.add(core);

      // Titanium corner struts
      const edgeGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.6, 8);
      [-1.2, 1.2].forEach(x => {
        [-1.1, 1.1].forEach(z => {
          const edge = new THREE.Mesh(edgeGeo, titaniumMat);
          edge.position.set(x, 0, z);
          group.add(edge);
        });
      });

      // Top & bottom decks
      const deckGeo = new THREE.BoxGeometry(2.55, 0.15, 2.35);
      const topDeck = new THREE.Mesh(deckGeo, whiteCeramicMat);
      topDeck.position.y = 1.875;
      group.add(topDeck);

      const btmDeck = new THREE.Mesh(deckGeo, darkMetalMat);
      btmDeck.position.y = -1.875;
      group.add(btmDeck);

    } else if (type === 'titanium_exo') {
      // Heavy Titanium Armored Core with Active Louver Slats
      const coreGeo = new THREE.BoxGeometry(2.6, 3.8, 2.4);
      const core = new THREE.Mesh(coreGeo, darkMetalMat);
      group.add(core);

      // Heavy exo-cage armor plates
      const plateGeo = new THREE.BoxGeometry(2.7, 3.6, 0.1);
      const frontPlate = new THREE.Mesh(plateGeo, titaniumMat);
      frontPlate.position.z = 1.22;
      group.add(frontPlate);

      const backPlate = new THREE.Mesh(plateGeo, titaniumMat);
      backPlate.position.z = -1.22;
      group.add(backPlate);

      // Active Thermal Radiator Louvers on the sides
      const sideOffsets = [-1.35, 1.35];
      sideOffsets.forEach(xPos => {
        const frameGeo = new THREE.BoxGeometry(0.1, 2.4, 1.6);
        const frame = new THREE.Mesh(frameGeo, darkMetalMat);
        frame.position.set(xPos, 0, 0);
        group.add(frame);

        // 6 adjustable louver slats per side
        for (let l = 0; l < 6; l++) {
          const louverGroup = new THREE.Group();
          const posY = -0.9 + l * 0.36;
          louverGroup.position.set(xPos, posY, 0);

          const slatGeo = new THREE.BoxGeometry(0.06, 0.04, 1.45);
          const slat = new THREE.Mesh(slatGeo, titaniumMat);
          louverGroup.add(slat);

          group.add(louverGroup);
          activeLouvers.push(louverGroup);
        }
      });

    } else {
      // Carbon-Composite Hex Bus
      const hexGeo = new THREE.CylinderGeometry(1.6, 1.6, 3.6, 6);
      const hexBus = new THREE.Mesh(hexGeo, carbonMat);
      hexBus.castShadow = true;
      group.add(hexBus);

      // Gold reinforcement bands
      [-1.4, 0, 1.4].forEach(y => {
        const ringGeo = new THREE.CylinderGeometry(1.64, 1.64, 0.12, 6);
        const ring = new THREE.Mesh(ringGeo, goldTrimMat);
        ring.position.y = y;
        group.add(ring);
      });
    }

    // Add navigation beacons to chassis
    addBeacons(group);

    return group;
  }

  function addBeacons(group) {
    // Red port nav light
    const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
    const navGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const redMesh = new THREE.Mesh(navGeo, redLightMat);
    redMesh.position.set(-1.3, 1.9, 0);
    group.add(redMesh);

    // Green starboard nav light
    const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
    const greenMesh = new THREE.Mesh(navGeo, greenLightMat);
    greenMesh.position.set(1.3, 1.9, 0);
    group.add(greenMesh);

    // White strobe
    const strobeLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const strobeMesh = new THREE.Mesh(navGeo, strobeLightMat);
    strobeMesh.position.set(0, 2.1, 0);
    group.add(strobeMesh);
  }

  // ==========================================
  // BUILDERS: POWER MODULES
  // ==========================================
  function buildPower(type) {
    activeSolarWings = [];
    const group = new THREE.Group();

    if (type === 'dual_wing') {
      // Compact Dual-Panel Wings (2 panels per side)
      [-1, 1].forEach(dir => {
        const wingMount = new THREE.Group();

        const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 12), titaniumMat);
        boom.rotation.z = Math.PI / 2;
        boom.position.x = dir * 0.5;
        wingMount.add(boom);

        // Articulated panels
        const panelPivot = new THREE.Group();
        panelPivot.position.x = dir * 1.0;

        for (let p = 0; p < 2; p++) {
          const panelGeo = new THREE.BoxGeometry(1.4, 1.5, 0.05);
          const panel = new THREE.Mesh(panelGeo, solarPanelMat);
          panel.position.x = dir * (0.8 + p * 1.5);
          panel.castShadow = true;
          panelPivot.add(panel);
        }

        wingMount.add(panelPivot);
        activeSolarWings.push(panelPivot);
        group.add(wingMount);
      });

    } else if (type === 'hex_array') {
      // Extended Hex-Panel Wings (3 panels per side, wider)
      [-1, 1].forEach(dir => {
        const wingMount = new THREE.Group();

        const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 12), titaniumMat);
        boom.rotation.z = Math.PI / 2;
        boom.position.x = dir * 0.6;
        wingMount.add(boom);

        const panelPivot = new THREE.Group();
        panelPivot.position.x = dir * 1.2;

        for (let p = 0; p < 3; p++) {
          const panelGeo = new THREE.BoxGeometry(1.6, 1.8, 0.06);
          const panel = new THREE.Mesh(panelGeo, solarPanelMat);
          panel.position.x = dir * (0.9 + p * 1.7);
          panel.castShadow = true;
          panelPivot.add(panel);
        }

        wingMount.add(panelPivot);
        activeSolarWings.push(panelPivot);
        group.add(wingMount);
      });

    } else {
      // Nuclear RTG Cylindrical Generator
      const rtgGroup = new THREE.Group();
      rtgGroup.position.set(0, 0, -1.6);

      // Main cylindrical thermoelectric casing
      const rtgBody = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 2.2, 24), darkMetalMat);
      rtgBody.rotation.x = Math.PI / 2;
      rtgGroup.add(rtgBody);

      // 8 radial cooling heat fins
      for (let f = 0; f < 8; f++) {
        const angle = (f * Math.PI * 2) / 8;
        const finGeo = new THREE.BoxGeometry(0.04, 0.5, 2.0);
        const fin = new THREE.Mesh(finGeo, titaniumMat);
        fin.position.set(Math.cos(angle) * 0.75, Math.sin(angle) * 0.75, 0);
        fin.rotation.z = angle;
        fin.rotation.x = Math.PI / 2;
        rtgGroup.add(fin);
      }

      // Hot core indicator glow
      const rtgCoreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff6600 }));
      rtgCoreGlow.position.z = -1.1;
      rtgGroup.add(rtgCoreGlow);

      group.add(rtgGroup);
    }

    return group;
  }

  // ==========================================
  // BUILDERS: COMMS MODULES
  // ==========================================
  function buildComms(type) {
    activeLaserEmitters = [];
    const group = new THREE.Group();
    group.position.set(0, 0, 1.3);

    if (type === 'dish') {
      // High-Gain Parabolic Dish
      const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 12), titaniumMat);
      mount.rotation.x = Math.PI / 2;
      mount.position.z = 0.2;
      group.add(mount);

      const dishPoints = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const r = t * 1.5;
        const z = (r * r) * 0.22;
        dishPoints.push(new THREE.Vector2(r, z));
      }
      const dishGeo = new THREE.LatheGeometry(dishPoints, 32);
      const dish = new THREE.Mesh(dishGeo, whiteCeramicMat);
      dish.rotation.x = -Math.PI / 2;
      dish.position.z = 0.6;
      group.add(dish);

      // Feed horn
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 16), goldTrimMat);
      horn.rotation.x = Math.PI / 2;
      horn.position.z = 1.3;
      group.add(horn);

    } else if (type === 'phased_array') {
      // Hexagonal Planar Phased Array Panel
      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.6), darkMetalMat);
      mount.position.z = 0.3;
      group.add(mount);

      const arrayPanel = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.15, 6), darkMetalMat);
      arrayPanel.rotation.x = Math.PI / 2;
      arrayPanel.position.z = 0.7;
      group.add(arrayPanel);

      // Glowing antenna elements grid
      const gridMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const elem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), gridMat);
          elem.position.set(-0.48 + c * 0.24, -0.48 + r * 0.24, 0.79);
          group.add(elem);
          activeLaserEmitters.push(elem);
        }
      }

    } else {
      // Optical Laser Comm Transceiver Turrets
      [-0.6, 0.6].forEach(x => {
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.7, 16), darkMetalMat);
        turret.rotation.x = Math.PI / 2;
        turret.position.set(x, 0.2, 0.5);
        group.add(turret);

        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), cyanGlowMat);
        lens.position.set(x, 0.2, 0.86);
        group.add(lens);
        activeLaserEmitters.push(lens);
      });
    }

    return group;
  }

  // ==========================================
  // BUILDERS: SCIENCE PAYLOAD MODULES
  // ==========================================
  function buildScience(type) {
    const group = new THREE.Group();
    group.position.set(0, -1.9, 0); // mounted underneath

    if (type === 'earth_cam') {
      // Multispectral Earth Optical Camera
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.1, 24), darkMetalMat);
      barrel.position.y = -0.55;
      group.add(barrel);

      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), new THREE.MeshPhysicalMaterial({
        color: 0x004488,
        roughness: 0.05,
        metalness: 0.9,
        reflectivity: 1.0,
        clearcoat: 1.0
      }));
      lens.rotation.x = Math.PI / 2;
      lens.position.y = -1.11;
      group.add(lens);
      activeSensorPulseMesh = lens;

    } else if (type === 'sar_radar') {
      // Synthetic Aperture Radar (SAR) Truss Boom
      const boom = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 0.5), titaniumMat);
      boom.position.y = -0.4;
      group.add(boom);

      const radarFace = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.1, 0.6), goldTrimMat);
      radarFace.position.y = -0.52;
      group.add(radarFace);
      activeSensorPulseMesh = radarFace;

    } else {
      // Deep-Space Spectrometer & Magnetometer Mast
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8), titaniumMat);
      mast.position.y = -1.6;
      group.add(mast);

      [-1.0, -2.0, -3.1].forEach(y => {
        const pod = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), goldTrimMat);
        pod.position.y = y;
        group.add(pod);
      });
      activeSensorPulseMesh = mast;
    }

    return group;
  }

  // ==========================================
  // LOADOUT UPDATE HANDLER
  // ==========================================
  function updateLoadout(loadout, tuning) {
    // 1. Chassis
    if (currentParts.chassis !== loadout.chassis) {
      currentParts.chassis = loadout.chassis;
      chassisSlot.clear();
      const newChassis = buildChassis(loadout.chassis);
      chassisSlot.add(newChassis);
      triggerSnapEffect(newChassis);
    }

    // 2. Power
    if (currentParts.power !== loadout.power) {
      currentParts.power = loadout.power;
      powerSlot.clear();
      const newPower = buildPower(loadout.power);
      powerSlot.add(newPower);
      triggerSnapEffect(newPower);
    }

    // 3. Comms
    if (currentParts.comms !== loadout.comms) {
      currentParts.comms = loadout.comms;
      commsSlot.clear();
      const newComms = buildComms(loadout.comms);
      commsSlot.add(newComms);
      triggerSnapEffect(newComms);
    }

    // 4. Science
    if (currentParts.science !== loadout.science) {
      currentParts.science = loadout.science;
      scienceSlot.clear();
      const newScience = buildScience(loadout.science);
      scienceSlot.add(newScience);
      triggerSnapEffect(newScience);
    }

    // Apply Live Tuning Sliders
    applyTuning(tuning);
  }

  function applyTuning(tuning) {
    if (!tuning) return;

    // A. Solar tilt: physically rotate solar wings in 3D
    const tiltRad = (tuning.solarTilt * Math.PI) / 180;
    activeSolarWings.forEach(wing => {
      wing.rotation.y = tiltRad;
    });

    // B. Radiator louvers: physically angle louvers in 3D
    const louverRad = (tuning.radiatorLouvers / 100) * (Math.PI / 2.5);
    activeLouvers.forEach(louver => {
      louver.rotation.z = louverRad;
    });

    // C. Comms Power boost: adjust intensity / emissive color
    const powerRatio = tuning.commsPower / 200;
    activeLaserEmitters.forEach(emitter => {
      if (emitter.material) {
        if (emitter.material.color) {
          emitter.material.color.setRGB(0, 0.7 + powerRatio * 0.3, 0.9 + powerRatio * 0.1);
        }
      }
    });
  }

  // Animation Loop Update
  function update(delta, elapsedTime) {
    // Orbital wobble
    satelliteRoot.rotation.y = Math.sin(elapsedTime * 0.08) * 0.03;

    // Handle wireframe snap flash fade
    if (snapHighlightTime > 0) {
      snapHighlightTime -= delta;
      if (snapHighlightTime <= 0 && snapGhostMesh) {
        satelliteRoot.remove(snapGhostMesh);
        snapGhostMesh = null;
      }
    }
  }

  return {
    mesh: satelliteRoot,
    updateLoadout,
    applyTuning,
    update,
    getCenterPosition: () => satelliteRoot.position.clone()
  };
}
