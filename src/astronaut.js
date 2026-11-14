import * as THREE from 'three';

export const ROLE_CONFIGS = {
  power: {
    id: 'power',
    name: 'Power Engineer',
    code: 'PWR',
    colorHex: 0xffdd33,
    colorCss: '#ffdd33',
    badge: '⚡ POWER',
    desc: 'Owns Solar Arrays & RTG Power Generation'
  },
  comms: {
    id: 'comms',
    name: 'Comms Officer',
    code: 'CMS',
    colorHex: 0x00e5ff,
    colorCss: '#00e5ff',
    badge: '📡 COMMS',
    desc: 'Owns High-Gain Dish, Phased Array & Laser Uplink'
  },
  thermal: {
    id: 'thermal',
    name: 'Thermal Specialist',
    code: 'THM',
    colorHex: 0xff5533,
    colorCss: '#ff5533',
    badge: '🔥 THERMAL',
    desc: 'Owns Chassis Armor & Radiator Louvers'
  },
  commander: {
    id: 'commander',
    name: 'Payload Commander',
    code: 'CMD',
    colorHex: 0x00ff88,
    colorCss: '#00ff88',
    badge: '🔬 COMMAND',
    desc: 'Owns Science Instruments & Mission Launch Authorization'
  }
};

export class AstronautAvatar {
  constructor(id, callsign, roleKey = 'power') {
    this.id = id;
    this.callsign = callsign;
    this.roleKey = roleKey;
    this.roleConfig = ROLE_CONFIGS[roleKey] || ROLE_CONFIGS.power;

    this.group = new THREE.Group();
    this.group.name = `Astronaut_${id}`;

    // Target transform for interpolation
    this.targetPos = new THREE.Vector3(0, 0, 5);
    this.targetQuat = new THREE.Quaternion();
    this.isFiringThrusters = false;

    // Thruster meshes
    this.thrusterCones = [];
    this.aimLaser = null;
    this.nametagSprite = null;

    this._buildMesh();
  }

  _buildMesh() {
    // Shared Materials
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0xf0f3f6,
      roughness: 0.35,
      metalness: 0.15
    });

    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      roughness: 0.45,
      metalness: 0.8
    });

    const roleMat = new THREE.MeshStandardMaterial({
      color: this.roleConfig.colorHex,
      roughness: 0.2,
      metalness: 0.9,
      emissive: this.roleConfig.colorHex,
      emissiveIntensity: 0.35
    });

    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.98,
      roughness: 0.08,
      reflectivity: 1.0
    });

    // 1. Torso & Pressure Suit
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.38);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.y = 0;
    torso.castShadow = true;
    this.group.add(torso);

    // Chest pack console
    const chestGeo = new THREE.BoxGeometry(0.35, 0.32, 0.1);
    const chest = new THREE.Mesh(chestGeo, darkTrimMat);
    chest.position.set(0, 0.05, 0.23);
    this.group.add(chest);

    // Role badge stripe on chest
    const badgeGeo = new THREE.BoxGeometry(0.28, 0.06, 0.02);
    const badge = new THREE.Mesh(badgeGeo, roleMat);
    badge.position.set(0, 0.12, 0.28);
    this.group.add(badge);

    // 2. PLSS Backpack (Portable Life Support System)
    const packGeo = new THREE.BoxGeometry(0.48, 0.65, 0.28);
    const backpack = new THREE.Mesh(packGeo, darkTrimMat);
    backpack.position.set(0, 0.05, -0.32);
    this.group.add(backpack);

    // Role identification bands on backpack
    const packStripeGeo = new THREE.BoxGeometry(0.5, 0.08, 0.3);
    const packStripe = new THREE.Mesh(packStripeGeo, roleMat);
    packStripe.position.set(0, 0.22, -0.32);
    this.group.add(packStripe);

    // 4 RCS Thruster Nozzles on backpack
    const nozzleOffsets = [
      [-0.24, 0.32, -0.4],
      [0.24, 0.32, -0.4],
      [-0.24, -0.22, -0.4],
      [0.24, -0.22, -0.4]
    ];

    nozzleOffsets.forEach(pos => {
      const nozzleGeo = new THREE.CylinderGeometry(0.04, 0.055, 0.1, 8);
      const nozzle = new THREE.Mesh(nozzleGeo, darkTrimMat);
      nozzle.position.set(pos[0], pos[1], pos[2]);
      nozzle.rotation.x = Math.PI / 2;
      this.group.add(nozzle);

      // Jet Plume
      const flameGeo = new THREE.ConeGeometry(0.08, 0.45, 8);
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0x88ddff,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(pos[0], pos[1], pos[2] - 0.25);
      flame.rotation.x = -Math.PI / 2;
      this.group.add(flame);
      this.thrusterCones.push(flame);
    });

    // 3. Astronaut Helmet
    const helmetGeo = new THREE.SphereGeometry(0.24, 20, 20);
    const helmet = new THREE.Mesh(helmetGeo, suitMat);
    helmet.position.set(0, 0.58, 0.02);
    this.group.add(helmet);

    // Gold Sun Visor
    const visorGeo = new THREE.SphereGeometry(0.21, 20, 20, 0, Math.PI, 0, Math.PI * 0.7);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.rotation.y = -Math.PI / 2;
    visor.position.set(0, 0.58, 0.06);
    this.group.add(visor);

    // Helmet Headlamp Flashlight
    const lampLight = new THREE.SpotLight(0xffffff, 2.0, 16, Math.PI / 6, 0.4);
    lampLight.position.set(0, 0.7, 0.15);
    lampLight.target.position.set(0, 0.7, 10);
    this.group.add(lampLight);
    this.group.add(lampLight.target);

    // 4. Limbs in Zero-G Float Pose
    // Arms
    [-0.38, 0.38].forEach((x, idx) => {
      const armGeo = new THREE.CylinderGeometry(0.085, 0.075, 0.6, 12);
      const arm = new THREE.Mesh(armGeo, suitMat);
      arm.position.set(x, 0.1, 0.1);
      arm.rotation.z = idx === 0 ? 0.35 : -0.35;
      arm.rotation.x = -0.35;
      this.group.add(arm);

      // Arm Role Cuff
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), roleMat);
      cuff.position.copy(arm.position);
      cuff.rotation.copy(arm.rotation);
      this.group.add(cuff);
    });

    // Legs
    [-0.18, 0.18].forEach((x, idx) => {
      const legGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.75, 12);
      const leg = new THREE.Mesh(legGeo, suitMat);
      leg.position.set(x, -0.65, -0.05);
      leg.rotation.x = 0.2;
      leg.rotation.z = idx === 0 ? -0.1 : 0.1;
      this.group.add(leg);
    });

    // 5. Nametag Billboard Sprite
    this._createNametag();
  }

  _createNametag() {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    // Draw high-tech HUD name badge
    ctx.fillStyle = 'rgba(6, 18, 32, 0.82)';
    ctx.strokeStyle = this.roleConfig.colorCss;
    ctx.lineWidth = 4;
    ctx.roundRect(10, 10, 364, 76, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 30px Orbitron, sans-serif';
    ctx.fillStyle = this.roleConfig.colorCss;
    ctx.textAlign = 'center';
    ctx.fillText(`[${this.roleConfig.code}] ${this.callsign.toUpperCase()}`, 192, 45);

    ctx.font = '20px Share Tech Mono, monospace';
    ctx.fillStyle = '#a4c8e6';
    ctx.fillText('EVA ACTIVE', 192, 72);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    this.nametagSprite = new THREE.Sprite(spriteMat);
    this.nametagSprite.position.set(0, 1.15, 0);
    this.nametagSprite.scale.set(1.5, 0.4, 1);
    this.group.add(this.nametagSprite);
  }

  setRole(newRoleKey) {
    if (this.roleKey === newRoleKey) return;
    this.roleKey = newRoleKey;
    this.roleConfig = ROLE_CONFIGS[newRoleKey] || ROLE_CONFIGS.power;

    // Rebuild mesh with new role colors
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.thrusterCones = [];
    this._buildMesh();
  }

  setTargetTransform(pos, rot, thrusters) {
    if (pos) {
      this.targetPos.set(pos[0], pos[1], pos[2]);
    }
    if (rot) {
      this.targetQuat.set(rot[0], rot[1], rot[2], rot[3]);
    }
    this.isFiringThrusters = !!thrusters;
  }

  update(delta, elapsedTime) {
    // Smooth interpolation (lerp & slerp) for silky 60fps movement
    this.group.position.lerp(this.targetPos, delta * 12.0);
    this.group.quaternion.slerp(this.targetQuat, delta * 12.0);

    // Subtle zero-g breathing/limb float
    const floatOffset = Math.sin(elapsedTime * 2.5 + this.group.id) * 0.02;
    this.group.position.y += floatOffset * delta;

    // Thruster plumes
    this.thrusterCones.forEach((cone, idx) => {
      if (this.isFiringThrusters) {
        cone.material.opacity = 0.5 + Math.sin(elapsedTime * 30 + idx) * 0.4;
        cone.scale.y = 1.0 + Math.sin(elapsedTime * 20 + idx) * 0.4;
      } else {
        cone.material.opacity = 0.0;
      }
    });
  }

  dispose() {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
