/**
 * Client WebRTC Serverless P2P Networking & State Synchronization
 * Uses decentralized WebRTC relays so multiplayer works seamlessly on Vercel,
 * GitHub Pages, and local development with zero server deployment required.
 */
import { joinRoom } from 'trystero';

export class NetworkManager {
  constructor() {
    this.isConnected = false;
    this.selfId = 'ast_' + Math.random().toString(36).substring(2, 8);
    this.currentRoom = null;
    this.trysteroRoom = null;
    this.localCallsign = '';
    this.localRole = 'power';
    this.isReady = false;

    // Peer mapping: peerId -> playerInfo
    this.peerMap = new Map();

    // Throttled 20Hz transform sender
    this.lastTransformSent = 0;
    this.transformInterval = 50; // 50ms = 20 packets/sec

    // Trystero P2P Action handles
    this.actions = null;

    // Callbacks
    this.onRoomJoined = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onPlayerTransform = null;
    this.onSatelliteUpdated = null;
    this.onTeamPing = null;
    this.onRadioMessage = null;
    this.onMissionAdvanced = null;
    this.onRoleUpdated = null;
    this.onReadyUpdated = null;
    this.onLaunchStart = null;
    this.onError = null;
  }

  joinRoom(roomCode, callsign, role) {
    this.localCallsign = callsign || `Astronaut-${Math.floor(100 + Math.random() * 900)}`;
    this.localRole = role || 'power';
    this.isReady = false;

    const code = (roomCode || this._generateCode()).toUpperCase().trim();

    try {
      // Connect to serverless WebRTC room with Nostr/BitTorrent signaling
      this.trysteroRoom = joinRoom(
        { appId: 'cipher-space-orbital-2026' },
        code
      );
      this.isConnected = true;

      // Initialize room data
      this.currentRoom = {
        code,
        players: [
          {
            id: this.selfId,
            callsign: this.localCallsign,
            role: this.localRole,
            isReady: false
          }
        ]
      };

      this._setupActions();

      if (this.onRoomJoined) {
        this.onRoomJoined(this.currentRoom, this.selfId);
      }

      console.log(`[NETWORK P2P] Joined WebRTC orbital room: ${code} as ${this.localCallsign} (${this.selfId})`);
    } catch (e) {
      console.warn('[NETWORK P2P] Failed to join room:', e);
      if (this.onError) this.onError('Unable to connect to orbital network');
    }
  }

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  _setupActions() {
    if (!this.trysteroRoom) return;

    // Create synchronized actions across WebRTC peers
    const [sendTransform, getTransform] = this.trysteroRoom.makeAction('transform');
    const [sendRoster, getRoster] = this.trysteroRoom.makeAction('roster');
    const [sendSatellite, getSatellite] = this.trysteroRoom.makeAction('satellite');
    const [sendPing, getPing] = this.trysteroRoom.makeAction('ping');
    const [sendRadio, getRadio] = this.trysteroRoom.makeAction('radio');
    const [sendAdvance, getAdvance] = this.trysteroRoom.makeAction('advance');
    const [sendCountdown, getCountdown] = this.trysteroRoom.makeAction('countdown');

    this.actions = {
      sendTransform,
      sendRoster,
      sendSatellite,
      sendPing,
      sendRadio,
      sendAdvance,
      sendCountdown
    };

    // 1. Peer Joins
    this.trysteroRoom.onPeerJoin((peerId) => {
      console.log('[NETWORK P2P] Peer connected via WebRTC:', peerId);

      // Send my local roster and current state to newly joined peer
      sendRoster({
        id: this.selfId,
        callsign: this.localCallsign,
        role: this.localRole,
        isReady: this.isReady
      }, peerId);
    });

    // 2. Peer Leaves
    this.trysteroRoom.onPeerLeave((peerId) => {
      console.log('[NETWORK P2P] Peer disconnected:', peerId);
      const playerInfo = this.peerMap.get(peerId);
      const targetId = playerInfo ? playerInfo.id : peerId;

      this.peerMap.delete(peerId);
      if (this.currentRoom) {
        this.currentRoom.players = this.currentRoom.players.filter(p => p.id !== targetId);
      }

      if (this.onPlayerLeft) {
        this.onPlayerLeft(targetId);
      }
    });

    // 3. Receive Roster Info
    getRoster((data, peerId) => {
      const remoteId = data.id || peerId;
      const existing = this.peerMap.get(peerId);

      this.peerMap.set(peerId, {
        id: remoteId,
        callsign: data.callsign,
        role: data.role,
        isReady: data.isReady
      });

      if (this.currentRoom) {
        const idx = this.currentRoom.players.findIndex(p => p.id === remoteId);
        if (idx >= 0) {
          this.currentRoom.players[idx] = {
            id: remoteId,
            callsign: data.callsign,
            role: data.role,
            isReady: data.isReady
          };
        } else {
          this.currentRoom.players.push({
            id: remoteId,
            callsign: data.callsign,
            role: data.role,
            isReady: data.isReady
          });
        }
      }

      if (!existing && this.onPlayerJoined) {
        this.onPlayerJoined({
          id: remoteId,
          callsign: data.callsign,
          role: data.role,
          isReady: data.isReady
        });

        // Reply with our own roster so two-way connection is guaranteed
        sendRoster({
          id: this.selfId,
          callsign: this.localCallsign,
          role: this.localRole,
          isReady: this.isReady
        }, peerId);
      }

      if (this.onRoleUpdated) {
        this.onRoleUpdated(remoteId, data.role);
      }
      if (this.onReadyUpdated) {
        this.onReadyUpdated(remoteId, data.isReady);
      }
    });

    // 4. Receive Transform
    getTransform((data, peerId) => {
      const playerInfo = this.peerMap.get(peerId);
      const targetId = playerInfo ? playerInfo.id : peerId;
      if (this.onPlayerTransform) {
        this.onPlayerTransform(targetId, data);
      }
    });

    // 5. Receive Satellite Subsystem Modification
    getSatellite((data, peerId) => {
      if (this.onSatelliteUpdated) {
        this.onSatelliteUpdated(data.satelliteState, peerId, data.category);
      }
    });

    // 6. Receive Waypoint Ping
    getPing((data) => {
      if (this.onTeamPing) {
        this.onTeamPing(data);
      }
    });

    // 7. Receive Radio Message
    getRadio((data) => {
      if (this.onRadioMessage) {
        this.onRadioMessage(data);
      }
    });

    // 8. Receive Mission Advance
    getAdvance((data) => {
      if (this.onMissionAdvanced) {
        this.onMissionAdvanced(data.scenarioIndex);
      }
    });

    // 9. Receive Launch Countdown
    getCountdown((data) => {
      if (this.onLaunchStart) {
        this.onLaunchStart(data.countdown);
      }
    });
  }

  setRole(role) {
    this.localRole = role;
    if (this.currentRoom) {
      const selfPlayer = this.currentRoom.players.find(p => p.id === this.selfId);
      if (selfPlayer) selfPlayer.role = role;
    }

    if (this.actions) {
      this.actions.sendRoster({
        id: this.selfId,
        callsign: this.localCallsign,
        role: this.localRole,
        isReady: this.isReady
      });
    }

    if (this.onRoleUpdated) {
      this.onRoleUpdated(this.selfId, role);
    }
  }

  setReady(isReady) {
    this.isReady = isReady;
    if (this.currentRoom) {
      const selfPlayer = this.currentRoom.players.find(p => p.id === this.selfId);
      if (selfPlayer) selfPlayer.isReady = isReady;
    }

    if (this.actions) {
      this.actions.sendRoster({
        id: this.selfId,
        callsign: this.localCallsign,
        role: this.localRole,
        isReady: this.isReady
      });
    }

    if (this.onReadyUpdated) {
      this.onReadyUpdated(this.selfId, isReady);
    }

    // Check if all players in room are ready
    if (this.currentRoom && this.currentRoom.players.length > 0) {
      const allReady = this.currentRoom.players.every(p => p.isReady);
      if (allReady && this.actions) {
        this.actions.sendCountdown({ countdown: 3 });
        if (this.onLaunchStart) {
          this.onLaunchStart(3);
        }
      }
    }
  }

  sendTransform(pos, quat, thrusters, aimTarget) {
    if (!this.actions) return;
    const now = performance.now();
    if (now - this.lastTransformSent < this.transformInterval) return;
    this.lastTransformSent = now;

    this.actions.sendTransform({
      pos: [Number(pos.x.toFixed(3)), Number(pos.y.toFixed(3)), Number(pos.z.toFixed(3))],
      rot: [Number(quat.x.toFixed(3)), Number(quat.y.toFixed(3)), Number(quat.z.toFixed(3)), Number(quat.w.toFixed(3))],
      thrusters: !!thrusters,
      aimTarget: aimTarget ? [Number(aimTarget.x.toFixed(2)), Number(aimTarget.y.toFixed(2)), Number(aimTarget.z.toFixed(2))] : null
    });
  }

  sendSatelliteModify(category, action, value, currentSatelliteState) {
    if (!this.actions) return;
    this.actions.sendSatellite({
      category,
      action,
      value,
      satelliteState: currentSatelliteState
    });
  }

  sendTeamPing(worldPos, label) {
    if (!this.actions) return;
    this.actions.sendPing({
      playerId: this.selfId,
      callsign: this.localCallsign,
      role: this.localRole,
      worldPos: [worldPos.x, worldPos.y, worldPos.z],
      label: label || 'WAYPOINT'
    });
  }

  sendRadioMessage(text) {
    if (!this.actions) return;
    this.actions.sendRadio({
      playerId: this.selfId,
      callsign: this.localCallsign,
      role: this.localRole,
      text
    });
  }

  sendAdvanceMission(scenarioIndex) {
    if (!this.actions) return;
    this.actions.sendAdvance({
      scenarioIndex
    });
  }
}

export const networkManager = new NetworkManager();
