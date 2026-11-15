/**
 * Serverless WebRTC Peer-to-Peer Networking Manager
 * Uses Trystero for decentralized, serverless matchmaking over public WebRTC signaling relays.
 * Works out-of-the-box on static hosts like Vercel with zero backend servers or ports!
 */

import { joinRoom } from 'trystero';
import { gameState } from './gameState.js';

export class NetworkManager {
  constructor() {
    this.room = null;
    this.isConnected = false;
    this.selfId = 'ast_' + Math.random().toString(36).substring(2, 9);
    this.currentRoom = null;
    this.localCallsign = '';
    this.localRole = 'power';
    this.isReady = false;

    // Roster tracking: playerId -> playerData
    this.playersMap = new Map();

    // Throttled 20Hz transform sender
    this.lastTransformSent = 0;
    this.transformInterval = 50; // 50ms = 20 packets/sec

    // Trystero Action Dispatchers
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
    let code = (roomCode || '').toUpperCase().trim();
    if (!code) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    this.localCallsign = callsign || `Astro-${Math.floor(100 + Math.random() * 900)}`;
    this.localRole = role || 'power';
    this.isReady = false;

    // Leave any existing room
    if (this.room) {
      try { this.room.leave(); } catch (e) {}
    }

    this.playersMap.clear();

    // Add self to playersMap
    const selfData = {
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
    this.playersMap.set(this.selfId, selfData);

    this.currentRoom = {
      code,
      players: [selfData],
      satelliteState: {
        loadout: { ...gameState.loadout },
        tuning: { ...gameState.tuning }
      },
      scenarioIndex: gameState.currentScenarioIndex
    };

    console.log(`[P2P NETWORK] Joining serverless orbital room: ${code}`);

    try {
      // Connect over public decentralized WebRTC signaling
      this.room = joinRoom({ appId: 'cipher-space-orbital-2026' }, code);
      this.isConnected = true;

      this._setupRoomActions();

      if (this.onRoomJoined) {
        this.onRoomJoined(this.currentRoom, this.selfId);
      }
    } catch (err) {
      console.warn('[P2P NETWORK] Failed to join room:', err);
      if (this.onError) this.onError('Failed to initialize serverless P2P connection');
    }
  }

  _setupRoomActions() {
    if (!this.room) return;

    // Create Action channels
    const [sendRoster, getRoster] = this.room.makeAction('roster');
    const [sendTransform, getTransform] = this.room.makeAction('transform');
    const [sendSatellite, getSatellite] = this.room.makeAction('satellite');
    const [sendPing, getPing] = this.room.makeAction('ping');
    const [sendRadio, getRadio] = this.room.makeAction('radio');
    const [sendLaunch, getLaunch] = this.room.makeAction('launch');
    const [sendAdvance, getAdvance] = this.room.makeAction('advance');
    const [sendSync, getSync] = this.room.makeAction('sync');

    this.actions = {
      sendRoster,
      sendTransform,
      sendSatellite,
      sendPing,
      sendRadio,
      sendLaunch,
      sendAdvance,
      sendSync
    };

    // 1. Peer Joins Room
    this.room.onPeerJoin((peerId) => {
      console.log(`[P2P NETWORK] Peer discovered: ${peerId}`);

      // Send our own roster info to the newly joined peer
      sendRoster({
        id: this.selfId,
        callsign: this.localCallsign,
        role: this.localRole,
        isReady: this.isReady
      }, peerId);

      // Send our current authoritative satellite state to new peer
      sendSync({
        loadout: { ...gameState.loadout },
        tuning: { ...gameState.tuning },
        scenarioIndex: gameState.currentScenarioIndex
      }, peerId);
    });

    // 2. Peer Leaves Room
    this.room.onPeerLeave((peerId) => {
      console.log(`[P2P NETWORK] Peer departed: ${peerId}`);
      this.playersMap.delete(peerId);
      this.currentRoom.players = Array.from(this.playersMap.values());

      if (this.onPlayerLeft) {
        this.onPlayerLeft(peerId);
      }
    });

    // 3. Receive Peer Roster Data
    getRoster((data, peerId) => {
      const pid = data.id || peerId;
      const isNew = !this.playersMap.has(pid);

      this.playersMap.set(pid, {
        id: pid,
        callsign: data.callsign,
        role: data.role,
        isReady: !!data.isReady,
        transform: { pos: [0, 0, 5.2], rot: [0, 0, 0, 1], thrusters: false }
      });

      this.currentRoom.players = Array.from(this.playersMap.values());

      if (isNew && this.onPlayerJoined) {
        this.onPlayerJoined(this.playersMap.get(pid));
      }
      if (this.onRoleUpdated) {
        this.onRoleUpdated(pid, data.role);
      }
      if (this.onReadyUpdated) {
        this.onReadyUpdated(pid, data.isReady);
      }
    });

    // 4. Receive Peer 3D Transforms (20Hz)
    getTransform((transform, peerId) => {
      if (this.onPlayerTransform) {
        this.onPlayerTransform(peerId, transform);
      }
    });

    // 5. Receive Subsystem Modifications
    getSatellite((msg, peerId) => {
      if (this.onSatelliteUpdated) {
        this.onSatelliteUpdated(msg.satelliteState, peerId, msg.category);
      }
    });

    // 6. Receive 3D Waypoint Pings
    getPing((ping, peerId) => {
      if (this.onTeamPing) {
        this.onTeamPing({ ...ping, playerId: peerId });
      }
    });

    // 7. Receive Radio Messages
    getRadio((msg, peerId) => {
      if (this.onRadioMessage) {
        this.onRadioMessage({ ...msg, playerId: peerId });
      }
    });

    // 8. Receive Launch Trigger
    getLaunch((countdown, peerId) => {
      if (this.onLaunchStart) {
        this.onLaunchStart(countdown);
      }
    });

    // 9. Receive Mission Advancement
    getAdvance((scenarioIndex, peerId) => {
      if (this.onMissionAdvanced) {
        this.onMissionAdvanced(scenarioIndex);
      }
    });

    // 10. Receive Initial Full Sync
    getSync((state, peerId) => {
      if (state && state.loadout && state.tuning) {
        Object.assign(gameState.loadout, state.loadout);
        Object.assign(gameState.tuning, state.tuning);
        if (state.scenarioIndex !== undefined) {
          gameState.currentScenarioIndex = state.scenarioIndex;
        }
        if (this.onSatelliteUpdated) {
          this.onSatelliteUpdated(state, peerId, null);
        }
      }
    });
  }

  setRole(role) {
    this.localRole = role;
    const selfData = this.playersMap.get(this.selfId);
    if (selfData) selfData.role = role;

    if (this.actions && this.actions.sendRoster) {
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
    this.isReady = !!isReady;
    const selfData = this.playersMap.get(this.selfId);
    if (selfData) selfData.isReady = this.isReady;

    if (this.actions && this.actions.sendRoster) {
      this.actions.sendRoster({
        id: this.selfId,
        callsign: this.localCallsign,
        role: this.localRole,
        isReady: this.isReady
      });
    }

    if (this.onReadyUpdated) {
      this.onReadyUpdated(this.selfId, this.isReady);
    }

    // Check if all players in room are ready
    const allPlayers = Array.from(this.playersMap.values());
    const allReady = allPlayers.length > 0 && allPlayers.every(p => p.isReady);

    if (allReady) {
      if (this.actions && this.actions.sendLaunch) {
        this.actions.sendLaunch(3);
      }
      if (this.onLaunchStart) {
        this.onLaunchStart(3);
      }
    }
  }

  sendTransform(pos, quat, thrusters, aimTarget) {
    const now = performance.now();
    if (now - this.lastTransformSent < this.transformInterval) return;
    this.lastTransformSent = now;

    if (this.actions && this.actions.sendTransform) {
      this.actions.sendTransform({
        pos: [Number(pos.x.toFixed(3)), Number(pos.y.toFixed(3)), Number(pos.z.toFixed(3))],
        rot: [Number(quat.x.toFixed(3)), Number(quat.y.toFixed(3)), Number(quat.z.toFixed(3)), Number(quat.w.toFixed(3))],
        thrusters: !!thrusters,
        aimTarget: aimTarget ? [Number(aimTarget.x.toFixed(2)), Number(aimTarget.y.toFixed(2)), Number(aimTarget.z.toFixed(2))] : null
      });
    }
  }

  sendSatelliteModify(category, action, value) {
    if (this.actions && this.actions.sendSatellite) {
      this.actions.sendSatellite({
        satelliteState: {
          loadout: { ...gameState.loadout },
          tuning: { ...gameState.tuning }
        },
        category,
        action,
        value
      });
    }
  }

  sendTeamPing(worldPos, label) {
    if (this.actions && this.actions.sendPing) {
      this.actions.sendPing({
        worldPos: [Number(worldPos.x.toFixed(2)), Number(worldPos.y.toFixed(2)), Number(worldPos.z.toFixed(2))],
        label: label || 'WAYPOINT',
        role: this.localRole,
        callsign: this.localCallsign
      });
    }
  }

  sendRadioMessage(text) {
    if (this.actions && this.actions.sendRadio) {
      this.actions.sendRadio({
        text,
        role: this.localRole,
        callsign: this.localCallsign
      });
    }
  }

  sendAdvanceMission() {
    if (this.actions && this.actions.sendAdvance) {
      this.actions.sendAdvance(gameState.currentScenarioIndex);
    }
  }
}

export const networkManager = new NetworkManager();
