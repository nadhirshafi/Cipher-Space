import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
  createGoldFoilTexture,
  createSolarPanelTexture,
  createBumpMap
} from './textures.js';
import { spaceAudio } from './audio.js';

export function createSatellite() {
  const satelliteRoot = new THREE.Group();
  satelliteRoot.name = 'SatelliteRoot_AIM';

  // Shared Procedural Textures & Materials for Modularity
  const goldFoilTex = createGoldFoilTexture();
  const solarPanelTex = createSolarPanelTexture();
  const bumpTex = createBumpMap();

  const goldFoilMat = new THREE.MeshStandardMaterial({
    map: goldFoilTex,
    bumpMap: bumpTex,
    bumpScale: 0.05,
    metalness: 0.95,
    roughness: 0.22,
    color: 0xffb833
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

  const wireframeSnapMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });

  // Dedicated container for the 3D GLB Model
  const aimModelGroup = new THREE.Group();
  aimModelGroup.name = 'AIM_GLB_ModelGroup';
  satelliteRoot.add(aimModelGroup);

  // Subsystem Modular Attachment Slots
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

  const avionicsSlot = new THREE.Group();
  avionicsSlot.name = 'Slot_Avionics';
  satelliteRoot.add(avionicsSlot);

  // Holographic FX & HUD Markers
  const hologramGroup = new THREE.Group();
  hologramGroup.name = 'Holograms';
  satelliteRoot.add(hologramGroup);

  // Interactive Target Colliders list for Raycaster
  const interactiveColliders = [];

  // Live References
  let aimGLBMesh = null;
  let activeLouvers = [];
  let activeSolarWings = [];
  let activeLaserEmitters = [];
  let activeSensorPulseMesh = null;
  let avionicsBeaconMesh = null;
  let avionicsRingMesh = null;
  let avionicsStatusLight = null;
  let telemetryBeamMesh = null;
  let rcsThrusterMeshes = [];
  let isLaunchingSequence = false;
  let launchTimer = 0;
  let launchCallback = null;
  let lastAppliedTuning = null;

  // Active target highlight frame
  let highlightBracket = null;
  let activeHoveredCategory = null;

  // Track currently mounted parts
  let isInitialLoad = true;
  let currentParts = {
    chassis: null,
    power: null,
    comms: null,
    science: null
  };

  // Wireframe snap effect timer
  let snapHighlightTime = 0;
  let snapGhostMesh = null;

  // ==========================================
  // LOAD REAL NASA AIM SATELLITE GLB MODEL
  // ==========================================
  function loadAIMModel() {
    const dracoLoader = new DRACOLoader();
    // Prefer local decompressed wasm decoder in public/draco/, fallback to Google CDN
    dracoLoader.setDecoderPath('/draco/');

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    const onModelLoaded = (gltf) => {
      console.log('[SATELLITE] NASA AIM Satellite (Aeronomy of Ice in the Mesosphere) loaded.');
      const model = gltf.scene;

      // Realistic orbital dimensions (~7.5m wingspan, 3.1m height, 3.3m depth)
      const scale = 0.18;
      model.scale.set(scale, scale, scale);

      // Center model origin ([3.52, 0.0, 3.2] in Blender coordinates)
      model.position.set(-3.52 * scale, 0.0, -3.2 * scale);

      // Enhance PBR materials and enable realistic space shadows
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          const enhance = (mat) => {
            if (!mat) return;
            const name = (mat.name || '').toLowerCase();
            if (name.includes('gold')) {
              mat.color.setHex(0xffb833);
              mat.metalness = 0.96;
              mat.roughness = 0.22;
            } else if (name.includes('solar')) {
              mat.metalness = 0.88;
              mat.roughness = 0.14;
            } else if (name.includes('silver') || name.includes('grey') || name.includes('bronze')) {
              mat.metalness = 0.85;
              mat.roughness = 0.25;
            } else if (name.includes('lens') || name.includes('glass')) {
              mat.roughness = 0.08;
              mat.metalness = 0.1;
              mat.transparent = true;
              mat.opacity = 0.88;
            } else if (name.includes('black')) {
              mat.roughness = 0.85;
              mat.metalness = 0.2;
            }
          };

          if (Array.isArray(child.material)) {
            child.material.forEach(enhance);
          } else {
            enhance(child.material);
          }
        }
      });

      aimGLBMesh = model;
      aimModelGroup.add(model);

      if (lastAppliedTuning) {
        applyTuning(lastAppliedTuning);
      }
    };

    gltfLoader.load(
      '/models/aim.glb',
      onModelLoaded,
      undefined,
      (err) => {
        console.warn('[SATELLITE] Local Draco load failed, attempting Google CDN Draco decoder:', err);
        const cdnDraco = new DRACOLoader();
        cdnDraco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
        const fallbackLoader = new GLTFLoader();
        fallbackLoader.setDRACOLoader(cdnDraco);
        fallbackLoader.load('/models/aim.glb', onModelLoaded, undefined, (finalErr) => {
          console.error('[SATELLITE] Failed to load AIM GLB model:', finalErr);
        });
      }
    );
  }

  // ==========================================
  // BUILD AVIONICS TERMINAL & HOLOGRAPHIC RIG
  // ==========================================
  function buildAvionicsTerminal() {
    const termGroup = new THREE.Group();
    termGroup.position.set(0, 0.75, 1.45);

    // Housing console
    const housingGeo = new THREE.BoxGeometry(0.7, 0.45, 0.22);
    const housing = new THREE.Mesh(housingGeo, darkMetalMat);
    termGroup.add(housing);

    // Gold trim edge
    const bezelGeo = new THREE.BoxGeometry(0.74, 0.48, 0.04);
    const bezel = new THREE.Mesh(bezelGeo, goldTrimMat);
    bezel.position.z = 0.1;
    termGroup.add(bezel);

    // Screen
    const screenGeo = new THREE.PlaneGeometry(0.6, 0.35);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x051a24 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.z = 0.125;
    termGroup.add(screen);

    // Master Beacon Dome
    const domeGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    avionicsBeaconMesh = new THREE.Mesh(domeGeo, beaconMat);
    avionicsBeaconMesh.position.set(0, 0.16, 0.14);
    termGroup.add(avionicsBeaconMesh);

    // Point Light for dramatic hull lighting
    avionicsStatusLight = new THREE.PointLight(0xffaa00, 1.2, 3.5);
    avionicsStatusLight.position.set(0, 0.2, 0.3);
    termGroup.add(avionicsStatusLight);

    // Floating Holographic Launch Ring (appears when equilibrium reached)
    const ringGeo = new THREE.RingGeometry(0.24, 0.29, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0
    });
    avionicsRingMesh = new THREE.Mesh(ringGeo, ringMat);
    avionicsRingMesh.position.set(0, 0.16, 0.18);
    termGroup.add(avionicsRingMesh);

    avionicsSlot.add(termGroup);

    // Collider for Avionics
    const colGeo = new THREE.BoxGeometry(1.0, 0.8, 0.6);
    const colMat = new THREE.MeshBasicMaterial({ visible: false });
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.copy(termGroup.position);
    col.userData = {
      interactive: true,
      category: 'avionics',
      label: 'AVIONICS MASTER TERMINAL',
      subtext: 'AIM ORBITAL VERIFICATION & INSERTION INTERFACE',
      isAvionics: true
    };
    satelliteRoot.add(col);
    interactiveColliders.push(col);
  }

  function setupInteractiveColliders() {
    // 1. Power collider (covers AIM deployed solar array wings)
    const powerColGeo = new THREE.BoxGeometry(8.2, 2.6, 1.4);
    const powerCol = new THREE.Mesh(powerColGeo, new THREE.MeshBasicMaterial({ visible: false }));
    powerCol.position.set(0, -0.05, 1.1);
    powerCol.userData = {
      interactive: true,
      category: 'power',
      label: 'AIM SOLAR ARRAY & POWER BUS',
      tuneParam: 'solarTilt',
      tuneLabel: 'SOLAR PANEL TILT',
      tuneUnit: '°'
    };
    satelliteRoot.add(powerCol);
    interactiveColliders.push(powerCol);

    // 2. Comms collider (covers AIM S-band uplink & high-gain transponder)
    const commsColGeo = new THREE.BoxGeometry(2.2, 2.2, 2.0);
    const commsCol = new THREE.Mesh(commsColGeo, new THREE.MeshBasicMaterial({ visible: false }));
    commsCol.position.set(0, 0.8, 1.6);
    commsCol.userData = {
      interactive: true,
      category: 'comms',
      label: 'AIM S-BAND COMMS & TELEMETRY',
      tuneParam: 'commsPower',
      tuneLabel: 'TRANSMITTER BOOST',
      tuneUnit: 'W'
    };
    satelliteRoot.add(commsCol);
    interactiveColliders.push(commsCol);

    // 3. Chassis collider (covers central LEOStar-2 bus & thermal radiators)
    const chassisColGeo = new THREE.BoxGeometry(3.0, 2.6, 2.8);
    const chassisCol = new THREE.Mesh(chassisColGeo, new THREE.MeshBasicMaterial({ visible: false }));
    chassisCol.position.set(0, -0.45, -0.58);
    chassisCol.userData = {
      interactive: true,
      category: 'chassis',
      label: 'AIM BUS & RADIATOR LOUVERS',
      tuneParam: 'radiatorLouvers',
      tuneLabel: 'RADIATOR LOUVER APERTURE',
      tuneUnit: '%'
    };
    satelliteRoot.add(chassisCol);
    interactiveColliders.push(chassisCol);

    // 4. Science collider (covers upper science deck: CIPS UV Camera, SOFIE Spectrometer, CDE)
    const sciColGeo = new THREE.BoxGeometry(2.6, 2.0, 2.0);
    const sciCol = new THREE.Mesh(sciColGeo, new THREE.MeshBasicMaterial({ visible: false }));
    sciCol.position.set(0, 1.1, -0.2);
    sciCol.userData = {
      interactive: true,
      category: 'science',
      label: 'AIM SCIENCE PAYLOAD (CIPS / SOFIE / CDE)',
      tuneParam: 'sensorRate',
      tuneLabel: 'SENSOR DUTY CYCLE',
      tuneUnit: '%'
    };
    satelliteRoot.add(sciCol);
    interactiveColliders.push(sciCol);
  }

  function setupHolographicFX() {
    // 3D In-World Target Highlighting Bracket (wraps around hovered part)
    const bracketGeo = new THREE.BoxGeometry(1, 1, 1);
    const bracketMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.0
    });
    highlightBracket = new THREE.Mesh(bracketGeo, bracketMat);
    hologramGroup.add(highlightBracket);

    // Telemetry Launch Laser Beam
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.45, 120, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending
    });
    telemetryBeamMesh = new THREE.Mesh(beamGeo, beamMat);
    telemetryBeamMesh.position.set(0, -60, 1.8);
    hologramGroup.add(telemetryBeamMesh);

    // 4 Cold-gas RCS thruster nozzles and burst cones
    const nozzlePositions = [
      [-1.4, 1.4, 0.9],
      [1.4, 1.4, 0.9],
      [-1.4, -1.4, 0.9],
      [1.4, -1.4, 0.9]
    ];
    nozzlePositions.forEach(pos => {
      const coneGeo = new THREE.ConeGeometry(0.18, 0.8, 12);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0x88ddff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(pos[0], pos[1], pos[2]);
      cone.rotation.x = Math.PI / 2;
      hologramGroup.add(cone);
      rcsThrusterMeshes.push(cone);
    });
  }

  loadAIMModel();
  buildAvionicsTerminal();
  setupInteractiveColliders();
  setupHolographicFX();

  function triggerSnapEffect(targetGroup, playAudio = true) {
    if (snapGhostMesh) {
      satelliteRoot.remove(snapGhostMesh);
      snapGhostMesh = null;
    }
    if (playAudio) {
      spaceAudio.playHydraulicLock();
    }

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
  // MODULAR SUBSYSTEM BUILDERS
  // ==========================================
  function buildChassis(type) {
    activeLouvers = [];
    const group = new THREE.Group();

    if (type === 'titanium_exo') {
      // Active Radiator Louver Panel
      const louverPanel = new THREE.Group();
      louverPanel.position.set(0, -0.45, -1.9);

      const frameGeo = new THREE.BoxGeometry(2.2, 1.8, 0.1);
      const frame = new THREE.Mesh(frameGeo, darkMetalMat);
      louverPanel.add(frame);

      // Louver slats
      const slatGeo = new THREE.BoxGeometry(1.8, 0.04, 0.22);
      for (let i = -4; i <= 4; i++) {
        const slatPivot = new THREE.Group();
        slatPivot.position.set(0, i * 0.18, 0.08);

        const slatMesh = new THREE.Mesh(slatGeo, titaniumMat);
        slatMesh.position.z = 0.1;
        slatPivot.add(slatMesh);

        louverPanel.add(slatPivot);
        activeLouvers.push(slatPivot);
      }
      group.add(louverPanel);
    } else if (type === 'carbon_hex') {
      // Carbon Composite Truss Reinforcement
      const trussGroup = new THREE.Group();
      trussGroup.position.set(0, -0.45, -0.58);
      const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.8, 8);
      [-1.3, 1.3].forEach(x => {
        const strut = new THREE.Mesh(strutGeo, carbonMat);
        strut.position.set(x, 0, -1.2);
        trussGroup.add(strut);
      });
      group.add(trussGroup);
    }

    return group;
  }

  function buildPower(type) {
    activeSolarWings = [];
    const group = new THREE.Group();

    // Secondary Articulated Solar Wing Rigs that respond to Tilt
    const wingPivotL = new THREE.Group();
    wingPivotL.position.set(-3.8, -0.05, 1.1);

    const wingPivotR = new THREE.Group();
    wingPivotR.position.set(3.8, -0.05, 1.1);

    if (type === 'hex_array') {
      // High-efficiency extended photovoltaic wings
      const panelGeo = new THREE.BoxGeometry(2.0, 1.2, 0.04);
      const wingL = new THREE.Mesh(panelGeo, solarPanelMat);
      wingL.position.x = -1.1;
      wingPivotL.add(wingL);

      const wingR = new THREE.Mesh(panelGeo, solarPanelMat);
      wingR.position.x = 1.1;
      wingPivotR.add(wingR);

      group.add(wingPivotL);
      group.add(wingPivotR);
      activeSolarWings.push(wingPivotL, wingPivotR);
    } else if (type === 'nuclear_rtg') {
      // RTG Core Cylinder mounted on aft boom
      const rtgGroup = new THREE.Group();
      rtgGroup.position.set(0, -1.8, -1.2);

      const cylGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 16);
      const cyl = new THREE.Mesh(cylGeo, darkMetalMat);
      rtgGroup.add(cyl);

      const ringGeo = new THREE.TorusGeometry(0.38, 0.03, 8, 24);
      [-0.4, 0, 0.4].forEach(y => {
        const ring = new THREE.Mesh(ringGeo, goldTrimMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        rtgGroup.add(ring);
      });
      group.add(rtgGroup);
    }

    return group;
  }

  function buildComms(type) {
    activeLaserEmitters = [];
    const group = new THREE.Group();
    group.position.set(0, 0.8, 1.6);

    if (type === 'dish') {
      // High-Gain S-Band Parabolic Reflector
      const dishGroup = new THREE.Group();
      const dishGeo = new THREE.SphereGeometry(0.75, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.8);
      const dishMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.85,
        roughness: 0.15,
        side: THREE.DoubleSide
      });
      const dish = new THREE.Mesh(dishGeo, dishMat);
      dish.rotation.x = Math.PI;
      dishGroup.add(dish);

      // Feed horn
      const hornGeo = new THREE.ConeGeometry(0.08, 0.45, 12);
      const horn = new THREE.Mesh(hornGeo, goldTrimMat);
      horn.position.z = 0.4;
      dishGroup.add(horn);

      group.add(dishGroup);
      activeLaserEmitters.push(horn);
    } else if (type === 'phased_array') {
      // Planar Hex Phased Array
      const arrayGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.08, 6);
      const arrayMesh = new THREE.Mesh(arrayGeo, titaniumMat);
      arrayMesh.rotation.x = Math.PI / 2;
      group.add(arrayMesh);
      activeLaserEmitters.push(arrayMesh);
    } else if (type === 'laser_comm') {
      // Optical Deep-Space Laser Turret
      const turretGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.5, 16);
      const turret = new THREE.Mesh(turretGeo, darkMetalMat);
      turret.rotation.x = Math.PI / 2;

      const lensGeo = new THREE.CircleGeometry(0.16, 16);
      const lensMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.z = 0.26;
      turret.add(lens);

      group.add(turret);
      activeLaserEmitters.push(lens);
    }

    return group;
  }

  function buildScience(type) {
    activeSensorPulseMesh = null;
    const group = new THREE.Group();
    group.position.set(0, 1.1, -0.2);

    if (type === 'earth_cam') {
      // CIPS Panoramic UV Cloud Imager Baffles & Lens
      const camGroup = new THREE.Group();
      const barrelGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.6, 24);
      const barrel = new THREE.Mesh(barrelGeo, darkMetalMat);
      camGroup.add(barrel);

      const lensGeo = new THREE.CircleGeometry(0.22, 24);
      const lensMat = new THREE.MeshBasicMaterial({ color: 0x88ccff });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.y = 0.31;
      lens.rotation.x = -Math.PI / 2;
      camGroup.add(lens);

      // Scanning Aperture Ring
      const ringGeo = new THREE.RingGeometry(0.26, 0.32, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.32;
      ring.rotation.x = -Math.PI / 2;
      camGroup.add(ring);

      group.add(camGroup);
      activeSensorPulseMesh = ring;
    } else if (type === 'sar_radar') {
      // SOFIE Solar Occultation Infrared Spectrometer
      const sofieGroup = new THREE.Group();
      const boomGeo = new THREE.BoxGeometry(0.3, 0.3, 1.4);
      const boom = new THREE.Mesh(boomGeo, titaniumMat);
      sofieGroup.add(boom);

      const sensorGeo = new THREE.SphereGeometry(0.18, 16, 16);
      const sensorMat = new THREE.MeshBasicMaterial({ color: 0xffaa44 });
      const sensor = new THREE.Mesh(sensorGeo, sensorMat);
      sensor.position.z = 0.75;
      sofieGroup.add(sensor);

      group.add(sofieGroup);
      activeSensorPulseMesh = sensor;
    } else if (type === 'spectrometer') {
      // CDE Cosmic Dust Experiment Detector Mast
      const cdeGroup = new THREE.Group();
      const mastGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8);
      const mast = new THREE.Mesh(mastGeo, titaniumMat);
      mast.position.y = 0.8;
      cdeGroup.add(mast);

      const cupGeo = new THREE.CylinderGeometry(0.2, 0.08, 0.25, 12);
      const cup = new THREE.Mesh(cupGeo, goldFoilMat);
      cup.position.y = 1.65;
      cdeGroup.add(cup);

      group.add(cdeGroup);
      activeSensorPulseMesh = cup;
    }

    return group;
  }

  // ==========================================
  // LOADOUT UPDATE HANDLER
  // ==========================================
  function updateLoadout(loadout, tuning) {
    const playAudio = !isInitialLoad;

    // 1. Chassis
    if (currentParts.chassis !== loadout.chassis) {
      currentParts.chassis = loadout.chassis;
      chassisSlot.clear();
      const newChassis = buildChassis(loadout.chassis);
      chassisSlot.add(newChassis);
      triggerSnapEffect(newChassis, playAudio);
    }

    // 2. Power
    if (currentParts.power !== loadout.power) {
      currentParts.power = loadout.power;
      powerSlot.clear();
      const newPower = buildPower(loadout.power);
      powerSlot.add(newPower);
      triggerSnapEffect(newPower, playAudio);
    }

    // 3. Comms
    if (currentParts.comms !== loadout.comms) {
      currentParts.comms = loadout.comms;
      commsSlot.clear();
      const newComms = buildComms(loadout.comms);
      commsSlot.add(newComms);
      triggerSnapEffect(newComms, playAudio);
    }

    // 4. Science
    if (currentParts.science !== loadout.science) {
      currentParts.science = loadout.science;
      scienceSlot.clear();
      const newScience = buildScience(loadout.science);
      scienceSlot.add(newScience);
      triggerSnapEffect(newScience, playAudio);
    }

    // Apply Live Tuning Sliders
    applyTuning(tuning);

    isInitialLoad = false;
  }

  function applyTuning(tuning) {
    if (!tuning) return;
    lastAppliedTuning = tuning;

    // A. Solar tilt: physically rotate solar wings in 3D
    const tiltRad = (tuning.solarTilt * Math.PI) / 180;
    activeSolarWings.forEach(wing => {
      wing.rotation.y = tiltRad;
    });

    // If GLB model is loaded, also apply subtle tilt response to deployed panels
    if (aimGLBMesh) {
      aimGLBMesh.rotation.x = Math.sin(tiltRad) * 0.12;
    }

    // B. Radiator louvers: physically angle louvers in 3D
    const louverRad = (tuning.radiatorLouvers / 100) * (Math.PI / 2.5);
    activeLouvers.forEach(louver => {
      louver.rotation.z = louverRad;
    });

    // C. Comms Power boost: adjust intensity / emissive color
    const powerRatio = tuning.commsPower / 200;
    activeLaserEmitters.forEach(emitter => {
      if (emitter.material && emitter.material.color) {
        emitter.material.color.setRGB(0, 0.7 + powerRatio * 0.3, 0.9 + powerRatio * 0.1);
      }
    });
  }

  function highlightTarget(targetMesh) {
    if (!targetMesh || !highlightBracket) return;
    const cat = targetMesh.userData.category;
    activeHoveredCategory = cat;

    if (cat === 'power') {
      highlightBracket.scale.set(8.4, 2.8, 1.6);
      highlightBracket.position.set(0, -0.05, 1.1);
    } else if (cat === 'comms') {
      highlightBracket.scale.set(2.4, 2.4, 2.2);
      highlightBracket.position.set(0, 0.8, 1.6);
    } else if (cat === 'chassis') {
      highlightBracket.scale.set(3.2, 2.8, 3.0);
      highlightBracket.position.set(0, -0.45, -0.58);
    } else if (cat === 'science') {
      highlightBracket.scale.set(2.8, 2.2, 2.2);
      highlightBracket.position.set(0, 1.1, -0.2);
    } else if (cat === 'avionics') {
      highlightBracket.scale.set(1.1, 0.85, 0.65);
      highlightBracket.position.set(0, 0.75, 1.45);
    }

    highlightBracket.material.opacity = 0.9;
  }

  function clearHighlight() {
    activeHoveredCategory = null;
    if (highlightBracket) {
      highlightBracket.material.opacity = 0.0;
    }
  }

  function setAvionicsReady(isReady) {
    if (!avionicsBeaconMesh || !avionicsStatusLight || !avionicsRingMesh) return;
    if (isReady) {
      avionicsBeaconMesh.material.color.setHex(0x00ff88);
      avionicsStatusLight.color.setHex(0x00ff88);
      avionicsStatusLight.intensity = 2.4;
      avionicsRingMesh.material.color.setHex(0x00ff88);
      avionicsRingMesh.material.opacity = 0.9;
    } else {
      avionicsBeaconMesh.material.color.setHex(0xffaa00);
      avionicsStatusLight.color.setHex(0xffaa00);
      avionicsStatusLight.intensity = 1.2;
      avionicsRingMesh.material.opacity = 0.0;
    }
  }

  function triggerLaunchSequence(onComplete) {
    if (isLaunchingSequence) return;
    isLaunchingSequence = true;
    launchTimer = 2.8;
    launchCallback = onComplete;

    spaceAudio.playAvionicsLaunchSound();

    if (telemetryBeamMesh) {
      telemetryBeamMesh.material.opacity = 0.9;
    }
  }

  // Animation Loop Update
  function update(delta, elapsedTime) {
    if (isLaunchingSequence) {
      launchTimer -= delta;

      // Spin up satellite into operational polar orbit
      satelliteRoot.rotation.y += delta * 0.6;
      satelliteRoot.rotation.z += delta * 0.15;

      // Burst RCS Thrusters
      rcsThrusterMeshes.forEach((cone, idx) => {
        cone.material.opacity = 0.4 + Math.sin(elapsedTime * 35 + idx) * 0.5;
        cone.scale.y = 1.0 + Math.sin(elapsedTime * 25 + idx) * 0.6;
      });

      // Pulse telemetry laser beam
      if (telemetryBeamMesh) {
        telemetryBeamMesh.material.opacity = 0.7 + Math.sin(elapsedTime * 20) * 0.3;
        telemetryBeamMesh.rotation.y += delta * 3.0;
      }

      if (launchTimer <= 0) {
        isLaunchingSequence = false;
        if (telemetryBeamMesh) telemetryBeamMesh.material.opacity = 0.0;
        rcsThrusterMeshes.forEach(cone => { cone.material.opacity = 0.0; });
        if (launchCallback) {
          const cb = launchCallback;
          launchCallback = null;
          cb();
        }
      }
    } else {
      // Normal gentle orbital wobble
      satelliteRoot.rotation.y = Math.sin(elapsedTime * 0.08) * 0.03;
    }

    // Pulse sensor optical aperture if present
    if (activeSensorPulseMesh && activeSensorPulseMesh.material) {
      const pulse = 0.7 + Math.sin(elapsedTime * 8) * 0.3;
      if (activeSensorPulseMesh.material.opacity !== undefined) {
        activeSensorPulseMesh.material.opacity = pulse;
      }
    }

    // Pulse Avionics ring
    if (avionicsRingMesh && avionicsRingMesh.material.opacity > 0.01) {
      avionicsRingMesh.rotation.z += delta * 2.5;
      const pulse = 0.24 + Math.sin(elapsedTime * 6.0) * 0.03;
      avionicsRingMesh.scale.set(pulse / 0.24, pulse / 0.24, 1);
    }

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
    getInteractiveObjects: () => interactiveColliders,
    highlightTarget,
    clearHighlight,
    setAvionicsReady,
    triggerLaunchSequence,
    getCenterPosition: () => satelliteRoot.position.clone()
  };
}
