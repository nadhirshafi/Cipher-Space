import * as THREE from 'three';
import { ROLE_CONFIGS } from './astronaut.js';
import { spaceAudio } from './audio.js';
import { networkManager } from './network.js';

export class MultiplayerHUD {
  constructor(scene) {
    this.scene = scene;
    this.rosterContainer = document.getElementById('visor-crew-roster');
    this.radioLog = document.getElementById('visor-radio-log');
    this.quickRadioMenu = document.getElementById('quick-radio-menu');

    // 3D Active Waypoint Pings
    this.activePings = [];
    this.isQuickRadioOpen = false;

    this._setupQuickRadio();
  }

  _setupQuickRadio() {
    window.addEventListener('keydown', (e) => {
      // 'T' toggles Quick Radio Menu
      if (e.code === 'KeyT') {
        e.preventDefault();
        this.toggleQuickRadio();
      }

      // 1-4 triggers radio quick callout when menu open
      if (this.isQuickRadioOpen) {
        const calls = {
          Digit1: 'Power generation nominal! Solar array tracking.',
          Digit2: 'Thermal warning! Radiator louvers needed.',
          Digit3: 'Comms bandwidth synchronized with Earth station.',
          Digit4: 'All systems in equilibrium! Commander authorize launch!'
        };
        if (calls[e.code]) {
          e.preventDefault();
          this.sendCallout(calls[e.code]);
          this.toggleQuickRadio(false);
        }
      }
    });
  }

  toggleQuickRadio(forceState = null) {
    this.isQuickRadioOpen = forceState !== null ? forceState : !this.isQuickRadioOpen;
    if (this.quickRadioMenu) {
      this.quickRadioMenu.style.display = this.isQuickRadioOpen ? 'flex' : 'none';
    }
  }

  sendCallout(text) {
    spaceAudio.playHoverPing();
    networkManager.sendRadioMessage(text);
    this.addRadioLogEntry(networkManager.localCallsign, networkManager.localRole, text);
  }

  addRadioLogEntry(callsign, roleKey, text) {
    if (!this.radioLog) return;
    const role = ROLE_CONFIGS[roleKey] || ROLE_CONFIGS.power;

    const row = document.createElement('div');
    row.className = 'radio-log-row';
    row.innerHTML = `
      <span class="radio-badge" style="color: ${role.colorCss}; border-color: ${role.colorCss};">[${role.code}] ${callsign}:</span>
      <span class="radio-text">${text}</span>
    `;

    this.radioLog.appendChild(row);
    // Keep last 6 messages
    while (this.radioLog.children.length > 6) {
      this.radioLog.removeChild(this.radioLog.children[0]);
    }

    // Auto-scroll
    this.radioLog.scrollTop = this.radioLog.scrollHeight;
  }

  updateCrewRoster(room, localPlayerPos, avatarsMap) {
    if (!this.rosterContainer || !room) return;

    const players = room.players || [];
    this.rosterContainer.innerHTML = `
      <div class="crew-roster-title">ORBITAL EXPEDITION CREW (${players.length}/4)</div>
      <div class="crew-roster-list">
        ${players.map(p => {
          const role = ROLE_CONFIGS[p.role] || ROLE_CONFIGS.power;
          let distText = 'SELF';
          if (p.id !== networkManager.selfId && avatarsMap && avatarsMap.has(p.id)) {
            const avatar = avatarsMap.get(p.id);
            const dist = localPlayerPos.distanceTo(avatar.group.position);
            distText = `${dist.toFixed(1)} m`;
          }
          return `
            <div class="crew-member-pill ${p.id === networkManager.selfId ? 'self' : ''}">
              <span class="crew-role-dot" style="background-color: ${role.colorCss}; box-shadow: 0 0 6px ${role.colorCss};"></span>
              <span class="crew-callsign">${p.callsign}</span>
              <span class="crew-role-code" style="color: ${role.colorCss};">[${role.code}]</span>
              <span class="crew-dist">${distText}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  spawnWaypointPing(worldPos, label, roleKey, callsign) {
    const role = ROLE_CONFIGS[roleKey] || ROLE_CONFIGS.power;

    // 3D Visual Ping Group
    const pingGroup = new THREE.Group();
    pingGroup.position.copy(worldPos);

    // Glowing Rings
    const ringGeo = new THREE.RingGeometry(0.3, 0.38, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: role.colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    pingGroup.add(ring);

    // Pillar beacon line
    const lineGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.0, 8);
    const lineMat = new THREE.MeshBasicMaterial({ color: role.colorHex, transparent: true, opacity: 0.8 });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.y = 1.0;
    pingGroup.add(line);

    this.scene.add(pingGroup);
    spaceAudio.playHoverPing();

    this.addRadioLogEntry(callsign, roleKey, `📍 Marked Waypoint: ${label}`);

    this.activePings.push({
      group: pingGroup,
      ring,
      createdAt: performance.now(),
      lifetime: 7500 // 7.5s
    });
  }

  update(delta, cameraPos) {
    const now = performance.now();

    // Update active 3D waypoints
    for (let i = this.activePings.length - 1; i >= 0; i--) {
      const ping = this.activePings[i];
      const age = now - ping.createdAt;

      if (age > ping.lifetime) {
        this.scene.remove(ping.group);
        this.activePings.splice(i, 1);
        continue;
      }

      // Face camera and expand rings
      ping.group.lookAt(cameraPos);
      const scale = 1.0 + (age / 1200) % 2.0;
      ping.ring.scale.set(scale, scale, 1);
      ping.ring.material.opacity = Math.max(0, 1.0 - age / ping.lifetime);
    }
  }
}
