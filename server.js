import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 3001;
const wss = new WebSocketServer({ port: PORT });

console.log(`[CIPHER-SPACE SERVER] Orbital WebSocket Server running on ws://localhost:${PORT}`);

// Active game rooms: code -> roomData
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function broadcastToRoom(roomCode, message, excludeSocket = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const payload = JSON.stringify(message);

  room.players.forEach((player) => {
    if (player.ws !== excludeSocket && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  });
}

function getRoomPublicData(room) {
  const playersList = [];
  room.players.forEach((p) => {
    playersList.push({
      id: p.id,
      callsign: p.callsign,
      role: p.role,
      isReady: p.isReady,
      transform: p.transform
    });
  });

  return {
    code: room.code,
    players: playersList,
    satelliteState: room.satelliteState,
    scenarioIndex: room.scenarioIndex
  };
}

wss.on('connection', (ws) => {
  const playerId = 'ast_' + Math.random().toString(36).substring(2, 9);
  let currentRoomCode = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    switch (msg.type) {
      // 1. Create or Join Room
      case 'join_room': {
        let code = (msg.roomCode || '').toUpperCase().trim();
        if (!code) {
          code = generateRoomCode();
        }

        let room = rooms.get(code);
        if (!room) {
          room = {
            code,
            createdAt: Date.now(),
            players: new Map(),
            scenarioIndex: 0,
            satelliteState: {
              loadout: {
                power: 'dual_wing',
                comms: 'dish',
                chassis: 'gold_mylar',
                science: 'earth_cam'
              },
              tuning: {
                solarTilt: 45,
                commsPower: 60,
                radiatorLouvers: 35,
                sensorRate: 80
              }
            }
          };
          rooms.set(code, room);
        }

        // Room capacity check (max 4 astronauts)
        if (room.players.size >= 4) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room is full (max 4 astronauts)' }));
          return;
        }

        // Assign default unique role if available
        const claimedRoles = Array.from(room.players.values()).map(p => p.role);
        const rolesOrder = ['power', 'comms', 'thermal', 'commander'];
        let chosenRole = msg.role && !claimedRoles.includes(msg.role) ? msg.role : null;
        if (!chosenRole) {
          chosenRole = rolesOrder.find(r => !claimedRoles.includes(r)) || null;
        }

        const playerData = {
          id: playerId,
          ws,
          callsign: msg.callsign || `Astronaut-${room.players.size + 1}`,
          role: chosenRole,
          isReady: false,
          transform: {
            pos: [0, 0, 5.2],
            rot: [0, 0, 0, 1],
            thrusters: false,
            aimTarget: null
          }
        };

        room.players.set(playerId, playerData);
        currentRoomCode = code;

        // Send confirmation to joining player
        ws.send(JSON.stringify({
          type: 'room_joined',
          selfId: playerId,
          room: getRoomPublicData(room)
        }));

        // Broadcast to others
        broadcastToRoom(code, {
          type: 'player_joined',
          player: {
            id: playerId,
            callsign: playerData.callsign,
            role: playerData.role,
            isReady: playerData.isReady,
            transform: playerData.transform
          }
        }, ws);

        console.log(`[ROOM ${code}] Player ${playerData.callsign} (${playerId}) joined as [${playerData.role}]`);
        break;
      }

      // 2. Claim / Switch Role
      case 'set_role': {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const player = room.players.get(playerId);
        if (!player) return;

        const requestedRole = msg.role;
        // Verify role not taken by someone else
        const takenByOther = Array.from(room.players.values()).some(p => p.id !== playerId && p.role === requestedRole);
        if (!takenByOther) {
          player.role = requestedRole;
          broadcastToRoom(currentRoomCode, {
            type: 'role_updated',
            playerId,
            role: requestedRole
          });
        }
        break;
      }

      // 3. Ready Toggle
      case 'set_ready': {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const player = room.players.get(playerId);
        if (!player) return;

        player.isReady = !!msg.isReady;
        broadcastToRoom(currentRoomCode, {
          type: 'ready_updated',
          playerId,
          isReady: player.isReady
        });

        // Check if all ready to launch
        const allReady = room.players.size > 0 && Array.from(room.players.values()).every(p => p.isReady);
        if (allReady) {
          broadcastToRoom(currentRoomCode, {
            type: 'mission_launch_start',
            countdown: 3
          });
        }
        break;
      }

      // 4. Transform Sync (20Hz from client)
      case 'player_transform': {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const player = room.players.get(playerId);
        if (!player) return;

        player.transform = msg.transform;
        broadcastToRoom(currentRoomCode, {
          type: 'player_transform',
          playerId,
          transform: msg.transform
        }, ws);
        break;
      }

      // 5. Shared Satellite Subsystem Modification
      case 'satellite_modify': {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        if (msg.action === 'swap') {
          room.satelliteState.loadout[msg.category] = msg.partId;
        } else if (msg.action === 'tune') {
          room.satelliteState.tuning[msg.tuneParam] = msg.value;
        }

        // Broadcast to all crew members
        broadcastToRoom(currentRoomCode, {
          type: 'satellite_updated',
          satelliteState: room.satelliteState,
          modifiedBy: playerId,
          category: msg.category
        });
        break;
      }

      // 6. Tactical Waypoint Ping
      case 'team_ping': {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const player = room.players.get(playerId);
        broadcastToRoom(currentRoomCode, {
          type: 'team_ping',
          playerId,
          callsign: player ? player.callsign : 'Astronaut',
          role: player ? player.role : 'general',
          worldPos: msg.worldPos,
          label: msg.label || 'WAYPOINT'
        });
        break;
      }

      // 7. Tactical Radio Comms
      case 'radio_message': {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        const player = room.players.get(playerId);
        broadcastToRoom(currentRoomCode, {
          type: 'radio_message',
          playerId,
          callsign: player ? player.callsign : 'Astronaut',
          role: player ? player.role : 'crew',
          text: msg.text
        });
        break;
      }

      // 8. Mission Advance Trigger (Commander)
      case 'advance_mission': {
        if (!currentRoomCode) return;
        const room = rooms.get(currentRoomCode);
        if (!room) return;

        room.scenarioIndex = (room.scenarioIndex + 1) % 3;
        broadcastToRoom(currentRoomCode, {
          type: 'mission_advanced',
          scenarioIndex: room.scenarioIndex
        });
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentRoomCode) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        room.players.delete(playerId);
        broadcastToRoom(currentRoomCode, {
          type: 'player_left',
          playerId
        });
        console.log(`[ROOM ${currentRoomCode}] Player ${playerId} left (remaining: ${room.players.size})`);
        if (room.players.size === 0) {
          rooms.delete(currentRoomCode);
          console.log(`[ROOM ${currentRoomCode}] Deleted empty room`);
        }
      }
    }
  });
});
