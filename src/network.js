/**
 * Client WebSocket Networking & State Synchronization Manager
 */

export class NetworkManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.selfId = null;
    this.currentRoom = null;
    this.localCallsign = '';
    this.localRole = 'power';

    // Throttled 20Hz transform sender
    this.lastTransformSent = 0;
    this.transformInterval = 50; // 50ms = 20 packets/sec

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

  connect(serverUrl) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const host = window.location.hostname || 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultUrl = `${protocol}//${host}:3001`;
    const targetUrl = serverUrl || defaultUrl;

    try {
      this.ws = new WebSocket(targetUrl);
    } catch (e) {
      console.warn('[NETWORK] WebSocket connection failed', e);
      if (this.onError) this.onError('Unable to connect to orbital server');
      return;
    }

    this.ws.onopen = () => {
      this.isConnected = true;
      console.log('[NETWORK] Connected to Orbital Server at', targetUrl);
    };

    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      this._handleMessage(msg);
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      console.log('[NETWORK] Disconnected from server');
    };

    this.ws.onerror = (err) => {
      console.warn('[NETWORK] WebSocket error', err);
    };
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'room_joined':
        this.selfId = msg.selfId;
        this.currentRoom = msg.room;
        if (this.onRoomJoined) this.onRoomJoined(msg.room, msg.selfId);
        break;

      case 'player_joined':
        if (this.onPlayerJoined) this.onPlayerJoined(msg.player);
        break;

      case 'player_left':
        if (this.onPlayerLeft) this.onPlayerLeft(msg.playerId);
        break;

      case 'role_updated':
        if (this.onRoleUpdated) this.onRoleUpdated(msg.playerId, msg.role);
        break;

      case 'ready_updated':
        if (this.onReadyUpdated) this.onReadyUpdated(msg.playerId, msg.isReady);
        break;

      case 'mission_launch_start':
        if (this.onLaunchStart) this.onLaunchStart(msg.countdown);
        break;

      case 'player_transform':
        if (this.onPlayerTransform) this.onPlayerTransform(msg.playerId, msg.transform);
        break;

      case 'satellite_updated':
        if (this.onSatelliteUpdated) {
          this.onSatelliteUpdated(msg.satelliteState, msg.modifiedBy, msg.category);
        }
        break;

      case 'team_ping':
        if (this.onTeamPing) this.onTeamPing(msg);
        break;

      case 'radio_message':
        if (this.onRadioMessage) this.onRadioMessage(msg);
        break;

      case 'mission_advanced':
        if (this.onMissionAdvanced) this.onMissionAdvanced(msg.scenarioIndex);
        break;

      case 'error':
        if (this.onError) this.onError(msg.message);
        break;
    }
  }

  joinRoom(roomCode, callsign, role) {
    this.localCallsign = callsign;
    this.localRole = role;

    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
      // Wait for open
      const checkTimer = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          clearInterval(checkTimer);
          this._send({
            type: 'join_room',
            roomCode,
            callsign,
            role
          });
        }
      }, 80);
      return;
    }

    this._send({
      type: 'join_room',
      roomCode,
      callsign,
      role
    });
  }

  setRole(role) {
    this.localRole = role;
    this._send({ type: 'set_role', role });
  }

  setReady(isReady) {
    this._send({ type: 'set_ready', isReady });
  }

  sendTransform(pos, quat, thrusters, aimTarget) {
    const now = performance.now();
    if (now - this.lastTransformSent < this.transformInterval) return;
    this.lastTransformSent = now;

    this._send({
      type: 'player_transform',
      transform: {
        pos: [Number(pos.x.toFixed(3)), Number(pos.y.toFixed(3)), Number(pos.z.toFixed(3))],
        rot: [Number(quat.x.toFixed(3)), Number(quat.y.toFixed(3)), Number(quat.z.toFixed(3)), Number(quat.w.toFixed(3))],
        thrusters: !!thrusters,
        aimTarget: aimTarget ? [Number(aimTarget.x.toFixed(2)), Number(aimTarget.y.toFixed(2)), Number(aimTarget.z.toFixed(2))] : null
      }
    });
  }

  sendSatelliteModify(category, action, value) {
    if (action === 'swap') {
      this._send({
        type: 'satellite_modify',
        category,
        action: 'swap',
        partId: value
      });
    } else if (action === 'tune') {
      this._send({
        type: 'satellite_modify',
        category,
        action: 'tune',
        tuneParam: value.param,
        value: value.val
      });
    }
  }

  sendTeamPing(worldPos, label) {
    this._send({
      type: 'team_ping',
      worldPos: [worldPos.x, worldPos.y, worldPos.z],
      label: label || 'WAYPOINT'
    });
  }

  sendRadioMessage(text) {
    this._send({
      type: 'radio_message',
      text
    });
  }

  sendAdvanceMission() {
    this._send({
      type: 'advance_mission'
    });
  }

  _send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}

export const networkManager = new NetworkManager();
