import { ROLE_CONFIGS } from './astronaut.js';
import { networkManager } from './network.js';
import { spaceAudio } from './audio.js';

export class CrewLobby {
  constructor(onLaunchGame) {
    this.onLaunchGame = onLaunchGame;
    this.selectedRole = 'power';
    this.isReady = false;
    this.isMultiplayer = false;

    this.container = document.getElementById('lobby-modal');
    this.init();
  }

  init() {
    if (!this.container) return;

    // Check URL parameters for ?room=XXXX
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room') || '';

    const savedCallsign = localStorage.getItem('cipher_callsign') || `Astro-${Math.floor(100 + Math.random() * 900)}`;

    this.container.innerHTML = `
      <div class="modal-box lobby-box">
        <div class="lobby-header">
          <div class="modal-title">CIPHER SPACE</div>
          <div class="modal-subtitle">4-PLAYER ORBITAL ENGINEERING EXPEDITION</div>
        </div>

        <!-- Pre-flight Setup Form -->
        <div class="lobby-form" id="lobby-prejoin">
          <div class="form-row">
            <label class="form-label">ASTRONAUT CALLSIGN</label>
            <input type="text" id="callsign-input" class="lobby-input" value="${savedCallsign}" maxlength="14" placeholder="CALLSIGN">
          </div>

          <div class="form-row">
            <label class="form-label">ORBITAL CREW ROOM CODE</label>
            <div class="room-input-group">
              <input type="text" id="room-code-input" class="lobby-input room-code" value="${roomFromUrl.toUpperCase()}" maxlength="4" placeholder="ROOM">
              <button id="btn-join-room" class="lobby-btn">JOIN CREW</button>
            </div>
          </div>

          <div class="lobby-actions-separator">
            <span>OR</span>
          </div>

          <div class="lobby-action-buttons">
            <button id="btn-create-room" class="lobby-btn primary-glow">CREATE 4-PLAYER CREW</button>
            <button id="btn-solo-flight" class="lobby-btn secondary">SOLO SPACEWALK (OFFLINE)</button>
          </div>
        </div>

        <!-- Room Roster Matrix (Shown after joining a room) -->
        <div class="lobby-roster-view" id="lobby-roster" style="display: none;">
          <div class="roster-header">
            <div class="roster-code-display">
              <span class="label">CREW CODE:</span>
              <span id="display-room-code" class="code-val">----</span>
              <button id="btn-copy-link" class="icon-btn-small" title="Copy Invite Link">🔗 COPY INVITE LINK</button>
            </div>
            <div id="roster-count" class="crew-counter">1 / 4 ASTRONAUTS</div>
          </div>

          <!-- Role Cards Matrix -->
          <div class="roles-grid" id="roles-grid">
            ${Object.values(ROLE_CONFIGS).map(role => `
              <div class="role-card" data-role="${role.id}" id="role-card-${role.id}">
                <div class="role-badge" style="color: ${role.colorCss}; border-color: ${role.colorCss};">${role.badge}</div>
                <div class="role-name">${role.name}</div>
                <div class="role-desc">${role.desc}</div>
                <div class="role-occupant" id="occupant-${role.id}">UNASSIGNED</div>
              </div>
            `).join('')}
          </div>

          <!-- Ready / Launch Status -->
          <div class="roster-footer">
            <button id="btn-toggle-ready" class="modal-btn ready-btn">CONFIRM ROLE & READY</button>
            <div id="lobby-countdown" class="countdown-text" style="display: none;">LAUNCHING ORBITAL MISSION IN 3...</div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const lobbyBox = document.querySelector('.lobby-box');
    if (lobbyBox) {
      lobbyBox.addEventListener('click', (e) => e.stopPropagation());
      lobbyBox.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    const callsignInput = document.getElementById('callsign-input');
    const roomCodeInput = document.getElementById('room-code-input');
    const btnJoin = document.getElementById('btn-join-room');
    const btnCreate = document.getElementById('btn-create-room');
    const btnSolo = document.getElementById('btn-solo-flight');
    const btnCopy = document.getElementById('btn-copy-link');
    const btnReady = document.getElementById('btn-toggle-ready');

    if (callsignInput) {
      callsignInput.addEventListener('mousedown', (e) => e.stopPropagation());
    }
    if (roomCodeInput) {
      roomCodeInput.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // Solo Flight
    if (btnSolo) {
      btnSolo.addEventListener('click', () => {
        spaceAudio.init();
        spaceAudio.playClick();
        this.isMultiplayer = false;
        this.close();
        if (this.onLaunchGame) this.onLaunchGame({ isMultiplayer: false });
      });
    }

    // Create Room
    if (btnCreate) {
      btnCreate.addEventListener('click', () => {
        spaceAudio.init();
        spaceAudio.playClick();
        const callsign = (callsignInput.value || 'Astronaut').trim();
        localStorage.setItem('cipher_callsign', callsign);
        this.isMultiplayer = true;
        networkManager.joinRoom('', callsign, this.selectedRole);
      });
    }

    // Join Room
    if (btnJoin) {
      btnJoin.addEventListener('click', () => {
        spaceAudio.init();
        spaceAudio.playClick();
        const callsign = (callsignInput.value || 'Astronaut').trim();
        const code = (roomCodeInput.value || '').toUpperCase().trim();
        if (!code) {
          alert('Please enter a 4-letter room code');
          return;
        }
        localStorage.setItem('cipher_callsign', callsign);
        this.isMultiplayer = true;
        networkManager.joinRoom(code, callsign, this.selectedRole);
      });
    }

    // Copy Invite Link
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (!networkManager.currentRoom) return;
        const url = `${window.location.origin}${window.location.pathname}?room=${networkManager.currentRoom.code}`;
        navigator.clipboard.writeText(url).then(() => {
          btnCopy.textContent = '✓ COPIED!';
          setTimeout(() => { btnCopy.textContent = '🔗 COPY INVITE LINK'; }, 2000);
        });
      });
    }

    // Role Matrix Clicks
    const roleCards = document.querySelectorAll('.role-card');
    roleCards.forEach(card => {
      card.addEventListener('click', () => {
        const role = card.getAttribute('data-role');
        if (card.classList.contains('taken')) return;
        spaceAudio.playClick();
        this.selectedRole = role;
        networkManager.setRole(role);
        this._updateRoleSelection(role);
      });
    });

    // Ready Toggle
    if (btnReady) {
      btnReady.addEventListener('click', () => {
        spaceAudio.playClick();
        this.isReady = !this.isReady;
        btnReady.textContent = this.isReady ? '✓ READY (WAITING FOR CREW)' : 'CONFIRM ROLE & READY';
        btnReady.classList.toggle('active', this.isReady);
        networkManager.setReady(this.isReady);
      });
    }

    // Setup Network Callbacks for Lobby
    networkManager.onRoomJoined = (room, selfId) => {
      this._showRoster(room);
    };

    networkManager.onPlayerJoined = (player) => {
      spaceAudio.playHoverPing();
      this._refreshRosterDisplay();
    };

    networkManager.onPlayerLeft = (playerId) => {
      this._refreshRosterDisplay();
    };

    networkManager.onRoleUpdated = (playerId, role) => {
      this._refreshRosterDisplay();
    };

    networkManager.onReadyUpdated = (playerId, isReady) => {
      this._refreshRosterDisplay();
    };

    networkManager.onLaunchStart = (countdown) => {
      const countdownEl = document.getElementById('lobby-countdown');
      if (countdownEl) {
        countdownEl.style.display = 'block';
        let remaining = countdown || 3;
        countdownEl.textContent = `ALL CREW READY! LAUNCHING IN ${remaining}...`;
        const timer = setInterval(() => {
          remaining--;
          if (remaining > 0) {
            countdownEl.textContent = `ALL CREW READY! LAUNCHING IN ${remaining}...`;
          } else {
            clearInterval(timer);
            this.close();
            if (this.onLaunchGame) {
              this.onLaunchGame({
                isMultiplayer: true,
                role: this.selectedRole,
                callsign: networkManager.localCallsign,
                room: networkManager.currentRoom
              });
            }
          }
        }, 1000);
      }
    };
  }

  _showRoster(room) {
    const prejoin = document.getElementById('lobby-prejoin');
    const roster = document.getElementById('lobby-roster');
    const codeDisplay = document.getElementById('display-room-code');

    if (prejoin) prejoin.style.display = 'none';
    if (roster) roster.style.display = 'block';
    if (codeDisplay) codeDisplay.textContent = room.code;

    // Update URL without reloading
    window.history.replaceState({}, '', `?room=${room.code}`);

    this._refreshRosterDisplay();
  }

  _refreshRosterDisplay() {
    const room = networkManager.currentRoom;
    if (!room) return;

    const countEl = document.getElementById('roster-count');
    if (countEl) {
      countEl.textContent = `${room.players.length} / 4 ASTRONAUTS`;
    }

    // Reset all role slots
    Object.keys(ROLE_CONFIGS).forEach(roleId => {
      const card = document.getElementById(`role-card-${roleId}`);
      const occupant = document.getElementById(`occupant-${roleId}`);
      if (!card || !occupant) return;

      const playerInRole = room.players.find(p => p.role === roleId);
      if (playerInRole) {
        const isSelf = playerInRole.id === networkManager.selfId;
        occupant.textContent = isSelf ? `YOU (${playerInRole.callsign})` : playerInRole.callsign;
        occupant.className = `role-occupant ${playerInRole.isReady ? 'ready' : 'claimed'}`;
        card.classList.toggle('selected', isSelf);
        card.classList.toggle('taken', !isSelf);
      } else {
        occupant.textContent = 'AVAILABLE (CLICK TO ASSIGN)';
        occupant.className = 'role-occupant open';
        card.classList.remove('selected', 'taken');
      }
    });
  }

  _updateRoleSelection(role) {
    this._refreshRosterDisplay();
  }

  close() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  open() {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }
}
