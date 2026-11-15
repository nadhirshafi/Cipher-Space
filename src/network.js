/**
 * Serverless WebRTC Peer-to-Peer Networking Manager
 * Powered by Trystero with curated high-uptime Nostr WebRTC signaling relays.
 * Runs 100% serverless on static hosting (Vercel, GitHub Pages) without any custom backend or ports.
 */

import { joinRoom } from 'trystero';
import { gameState } from './gameState.js';

export class NetworkManager {
  constructor() {
    this.isConnected = false;
    this.selfId = 'ast_' + Math.random().toString(36).substring(2, 9);
    this.currentRoom = null;
    this.trysteroRoom = null;
    this.localCallsign = '';
    this.localRole = 'power';
    this.isReady = false;

    // Map peerId -> player metadata
    this.peerMap = new Map();

    // 20Hz transform rate limiting
    this.lastTransformSent = 0;
    this.transformInterval = 50; // 50ms = 20 packets/sec

    // Trystero action channel handles
    this.actions = null;

    // Event hooks
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

  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  _getSelfRoster() {
    return {
      id: this.selfId,
      callsign: this.localCallsign,
      role: this.localRole,
      isReady: this.isReady
    };
  }

  joinRoom(roomCode, callsign, role) {
    const code = (roomCode || this._generateCode()).toUpperCase().trim();
    this.localCallsign = callsign || `Astronaut-${Math.floor(100 + Math.random() * 900)}`;
    this.localRole = role || 'power';
    this.isReady = false;

    // Leave any existing room
    if (this.trysteroRoom) {
      try {
        this.trysteroRoom.leave();
      } catch (e) {
        console.warn('[NETWORK P2P] Error leaving previous room:', e);
      }
    }

    this.peerMap.clear();

    const selfPlayer = {
      id: this.selfId,
      callsign: this.localCallsign,
      role: this.localRole,
      isReady: false,
      transform: {
        pos: [0, 0, 5.2],
        rot: [0, 0, 0, 1],
        thrusters: false
      }
    };

    this.currentRoom = {
      code,
      players: [selfPlayer],
      satelliteState: {
        loadout: { ...gameState.loadout },
        tuning: { ...gameState.tuning }
      },
      scenarioIndex: gameState.currentScenarioIndex
    };

    console.log(`[NETWORK P2P] Initializing WebRTC room ${code} as ${this.localCallsign} (${this.selfId})...`);

    try {
      // Connect using Trystero with curated stable Nostr signaling relays
      this.trysteroRoom = joinRoom(
        {
          appId: 'cipher-space-orbital-2026',
          relayConfig: {
            urls: [
              'wss://relay.damus.io',
              'wss://nos.lol',
              'wss://relay.primal.net',
              'wss://relay.snort.social'
            ],
            redundancy: 2
          }
        },
        code
      );

      this.isConnected = true;
      this._setupActions();

      if (this.onRoomJoined) {
        this.onRoomJoined(this.currentRoom, this.selfId);
      }

      console.log(`[NETWORK P2P] Successfully entered room ${code}`);
    } catch (err) {
      console.error('[NETWORK P2P] Room initialization failed:', err);
      if (this.onError) {
        this.onError('Unable to establish peer-to-peer room connection');
      }
    }
  }

  _setupActions() {
    if (!this.trysteroRoom) return;

    // In Trystero 0.27, makeAction returns an object: { send, onMessage, onReceive, onReceiveProgress }
    const transformAction = this.trysteroRoom.makeAction('transform');
    const rosterAction = this.trysteroRoom.makeAction('roster');
    const satelliteAction = this.trysteroRoom.makeAction('satellite');
    const pingAction = this.trysteroRoom.makeAction('ping');
    const radioAction = this.trysteroRoom.makeAction('radio');
    const advanceAction = this.trysteroRoom.makeAction('advance');
    const countdownAction = this.trysteroRoom.makeAction('countdown');

    this.actions = {
      transform: transformAction,
      roster: rosterAction,
      satellite: satelliteAction,
      ping: pingAction,
      radio: radioAction,
      advance: advanceAction,
      countdown: countdownAction
    };

    // 1. Peer Joins Room
    this.trysteroRoom.onPeerJoin((peerInfo) => {
      const peerId = (peerInfo && peerInfo.peerId) ? peerInfo.peerId : peerInfo;
      console.log(`[NETWORK P2P] Peer joined room: ${peerId}`);

      // Broadcast self roster so the new peer receives our profile
      this.actions.roster.send(this._getSelfRoster()).catch(() => {});

      // Broadcast current satellite loadout so new peers are in sync
      this.actions.satellite.send({
        satelliteState: {
          loadout: { ...gameState.loadout },
          tuning: { ...gameState.tuning }
        },
        category: 'sync',
        action: 'sync'
      }).catch(() => {});
    });

    // 2. Peer Leaves Room
    this.trysteroRoom.onPeerLeave((peerInfo) => {
      const peerId = (peerInfo && peerInfo.peerId) ? peerInfo.peerId : peerInfo;
      console.log(`[NETWORK P2P] Peer left room: ${peerId}`);

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

    // 3. Receive Peer Roster
    rosterAction.onMessage((data, peerContext) => {
      if (!data || !data.id || data.id === this.selfId) return;

      const peerId = peerContext?.peerId || data.id;
      const isNew = !this.peerMap.has(peerId);

      this.peerMap.set(peerId, {
        id: data.id,
        callsign: data.callsign,
        role: data.role,
        isReady: !!data.isReady
      });

      if (this.currentRoom) {
        const existingIdx = this.currentRoom.players.findIndex(p => p.id === data.id);
        const playerEntry = {
          id: data.id,
          callsign: data.callsign,
          role: data.role,
          isReady: !!data.isReady,
          transform: { pos: [0, 0, 5.2], rot: [0, 0, 0, 1], thrusters: false }
        };

        if (existingIdx >= 0) {
          this.currentRoom.players[existingIdx] = {
            ...this.currentRoom.players[existingIdx],
            ...playerEntry
          };
        } else {
          this.currentRoom.players.push(playerEntry);
        }
      }

      if (isNew) {
        if (this.onPlayerJoined) {
          this.onPlayerJoined({
            id: data.id,
            callsign: data.callsign,
            role: data.role,
            isReady: !!data.isReady
          });
        }

        // Send back self roster to guarantee bidirectional discovery
        this.actions.roster.send(this._getSelfRoster()).catch(() => {});
      }

      if (this.onRoleUpdated) {
        this.onRoleUpdated(data.id, data.role);
      }
      if (this.onReadyUpdated) {
        this.onReadyUpdated(data.id, data.isReady);
      }
    });

    // 4. Receive 3D Transform
    transformAction.onMessage((data, peerContext) => {
      if (!data) return;
      const peerId = peerContext?.peerId;
      const playerInfo = peerId ? this.peerMap.get(peerId) : null;
      const targetId = playerInfo ? playerInfo.id : (data.id || peerId);

      if (targetId && targetId !== this.selfId && this.onPlayerTransform) {
        this.onPlayerTransform(targetId, data);
      }
    });

    // 5. Receive Subsystem Modifications
    satelliteAction.onMessage((data, peerContext) => {
      if (!data) return;
      const peerId = peerContext?.peerId;
      const playerInfo = peerId ? this.peerMap.get(peerId) : null;
      const targetId = playerInfo ? playerInfo.id : peerId;

      if (this.onSatelliteUpdated) {
        this.onSatelliteUpdated(data.satelliteState, targetId, data.category);
      }
    });

    // 6. Receive 3D Waypoint Ping
    pingAction.onMessage((data) => {
      if (data && this.onTeamPing) {
        this.onTeamPing(data);
      }
    });

    // 7. Receive Radio Message
    radioAction.onMessage((data) => {
      if (data && this.onRadioMessage) {
        this.onRadioMessage(data);
      }
    });

    // 8. Receive Mission Advancement
    advanceAction.onMessage((data) => {
      if (data && data.scenarioIndex !== undefined && this.onMissionAdvanced) {
        this.onMissionAdvanced(data.scenarioIndex);
      }
    });

    // 9. Receive Launch Countdown
    countdownAction.onMessage((data) => {
      if (data && this.onLaunchStart) {
        this.onLaunchStart(data.countdown || 3);
      }
    });
  }

  setRole(role) {
    this.localRole = role;
    if (this.currentRoom) {
      const selfPlayer = this.currentRoom.players.find(p => p.id === this.selfId);
      if (selfPlayer) selfPlayer.role = role;
    }

    if (this.actions?.roster?.send) {
      this.actions.roster.send(this._getSelfRoster()).catch(() => {});
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

    if (this.actions?.roster?.send) {
      this.actions.roster.send(this._getSelfRoster()).catch(() => {});
    }

    if (this.onReadyUpdated) {
      this.onReadyUpdated(this.selfId, isReady);
    }

    // If all players are ready, trigger countdown
    if (this.currentRoom && this.currentRoom.players.length > 0) {
      const allReady = this.currentRoom.players.every(p => p.isReady);
      if (allReady && this.actions?.countdown?.send) {
        this.actions.countdown.send({ countdown: 3 }).catch(() => {});
        if (this.onLaunchStart) {
          this.onLaunchStart(3);
        }
      }
    }
  }

  sendTransform(pos, quat, thrusters, aimTarget) {
    if (!this.actions?.transform?.send) return;
    const now = performance.now();
    if (now - this.lastTransformSent < this.transformInterval) return;
    this.lastTransformSent = now;

    this.actions.transform.send({
      id: this.selfId,
      pos: [Number(pos.x.toFixed(3)), Number(pos.y.toFixed(3)), Number(pos.z.toFixed(3))],
      rot: [Number(quat.x.toFixed(3)), Number(quat.y.toFixed(3)), Number(quat.z.toFixed(3)), Number(quat.w.toFixed(3))],
      thrusters: !!thrusters,
      aimTarget: aimTarget ? [Number(aimTarget.x.toFixed(2)), Number(aimTarget.y.toFixed(2)), Number(aimTarget.z.toFixed(2))] : null
    }).catch(() => {});
  }

  sendSatelliteModify(category, action, value, currentSatelliteState) {
    if (!this.actions?.satellite?.send) return;
    this.actions.satellite.send({
      category,
      action,
      value,
      satelliteState: currentSatelliteState
    }).catch(() => {});
  }

  sendTeamPing(worldPos, label) {
    if (!this.actions?.ping?.send) return;
    this.actions.ping.send({
      playerId: this.selfId,
      callsign: this.localCallsign,
      role: this.localRole,
      worldPos: [worldPos.x, worldPos.y, worldPos.z],
      label: label || 'WAYPOINT'
    }).catch(() => {});
  }

  sendRadioMessage(text) {
    if (!this.actions?.radio?.send) return;
    this.actions.radio.send({
      playerId: this.selfId,
      callsign: this.localCallsign,
      role: this.localRole,
      text
    }).catch(() => {});
  }

  sendAdvanceMission(scenarioIndex) {
    if (!this.actions?.advance?.send) return;
    this.actions.advance.send({
      scenarioIndex
    }).catch(() => {});
  }
}

export const networkManager = new NetworkManager();
