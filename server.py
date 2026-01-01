import asyncio
import websockets
import json
import logging
from datetime import datetime
from typing import Set, Dict, Any
import firebase_admin
from firebase_admin import auth, credentials

# ================= CONFIGURACIÓN FIREBASE (AUTENTICACIÓN GOOGLE) =================
# Descarga tu clave privada de Firebase Console: Proyecto > Configuración > Cuentas de servicio
FIREBASE_CREDENTIALS_PATH = "path/to/your/firebase-private-key.json"

try:
    cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)
    print("[✅] Firebase Admin inicializado para verificación de Google Sign-In")
except Exception as e:
    print(f"[⚠️] Error al inicializar Firebase (modo offline para pruebas): {e}")

# ================= ESTADÍSTICAS GLOBALES DEL SERVIDOR =================
class ServerStats:
    def __init__(self):
        self.total_connections = 0
        self.current_players = 0
        self.current_bots = 10  # Bots iniciales
        self.peak_players = 0
        self.game_rooms: Dict[str, GameRoom] = {}  # Partidas/salas

    def to_dict(self):
        return {
            "total_connections": self.total_connections,
            "current_players": self.current_players,
            "current_bots": self.current_bots,
            "peak_players": self.peak_players,
            "active_rooms": len(self.game_rooms)
        }

stats = ServerStats()

# ================= SALA DE JUEGO (LÓGICA MULTIJUGADOR) =================
class GameRoom:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.players: Dict[str, Player] = {}  # ID de conexión -> Jugador
        self.zombies = []
        self.last_bot_spawn = datetime.now()

    def add_player(self, player):
        self.players[player.conn_id] = player

    def remove_player(self, conn_id):
        if conn_id in self.players:
            del self.players[conn_id]

    def update_state(self):
        """Actualiza estado de la sala (zombies, bots, etc.)"""
        # Lógica para spawn de zombies/bots (simplificada)
        now = datetime.now()
        if (now - self.last_bot_spawn).seconds > 30 and len(self.players) > 0:
            self.last_bot_spawn = now
            stats.current_bots += 2  # Añade 2 bots cada 30 segundos

    def get_state_for_broadcast(self):
        """Prepara datos para enviar a todos los clientes"""
        return {
            "room": self.room_id,
            "timestamp": datetime.now().isoformat(),
            "players": {pid: p.to_dict() for pid, p in self.players.items()},
            "server_stats": {
                "online_players": stats.current_players,
                "active_bots": stats.current_bots
            }
        }

class Player:
    def __init__(self, conn_id: str, user_data: Dict[str, Any]):
        self.conn_id = conn_id
        self.user_id = user_data.get("uid", "anonymous")
        self.name = user_data.get("displayName", "Agent")
        self.avatar_idx = user_data.get("avatarIdx", 0)
        self.x = 0.0
        self.y = 0.0
        self.hp = 100
        self.score = 0
        self.last_update = datetime.now()

    def to_dict(self):
        return {
            "id": self.user_id,
            "name": self.name,
            "avatarIdx": self.avatar_idx,
            "x": self.x,
            "y": self.y,
            "hp": self.hp,
            "score": self.score
        }

# ================= MANEJADOR PRINCIPAL WEBSOCKET =================
async def game_server(websocket, path):
    """Maneja cada conexión de cliente"""
    conn_id = str(id(websocket))
    current_player = None
    current_room = None

    try:
        # 1. AUTENTICACIÓN INICIAL (el cliente envía token de Firebase)
        auth_message = await websocket.recv()
        auth_data = json.loads(auth_message)
        
        user_data = {"uid": "anonymous", "displayName": "Guest"}
        
        if "firebaseToken" in auth_data:
            try:
                # Verifica el token de Google/Firebase
                decoded_token = auth.verify_id_token(auth_data["firebaseToken"])
                user_data = {
                    "uid": decoded_token["uid"],
                    "displayName": decoded_token.get("name", "Agent"),
                    "email": decoded_token.get("email", "")
                }
                print(f"[👤] Usuario autenticado: {user_data['displayName']}")
            except Exception as e:
                print(f"[❌] Error de autenticación: {e}")
                await websocket.send(json.dumps({"error": "Invalid token"}))
                return

        # 2. CREAR JUGADOR Y ASIGNAR SALA
        current_player = Player(conn_id, user_data)
        
        # Usar sala principal (o crear si no existe)
        if "main_room" not in stats.game_rooms:
            stats.game_rooms["main_room"] = GameRoom("main_room")
        
        current_room = stats.game_rooms["main_room"]
        current_room.add_player(current_player)
        
        # 3. ACTUALIZAR ESTADÍSTICAS GLOBALES
        stats.total_connections += 1
        stats.current_players += 1
        if stats.current_players > stats.peak_players:
            stats.peak_players = stats.current_players
        
        print(f"[🎮] Jugador conectado: {current_player.name} | Total: {stats.current_players}")

        # 4. ENVIAR ESTADO INICIAL AL CLIENTE
        welcome_data = {
            "type": "WELCOME",
            "player": current_player.to_dict(),
            "serverStats": stats.to_dict(),
            "roomState": current_room.get_state_for_broadcast()
        }
        await websocket.send(json.dumps(welcome_data))

        # 5. BUCLE PRINCIPAL: Recibir actualizaciones del cliente
        async for message in websocket:
            try:
                data = json.loads(message)
                
                # Actualizar posición/estado del jugador
                if "position" in data:
                    current_player.x = data["position"]["x"]
                    current_player.y = data["position"]["y"]
                    current_player.last_update = datetime.now()
                
                if "score" in data:
                    current_player.score = data["score"]
                
                if "hp" in data:
                    current_player.hp = data["hp"]
                
                # Actualizar estado de la sala
                current_room.update_state()
                
                # Preparar datos para broadcast a TODOS los jugadores
                broadcast_data = {
                    "type": "GAME_UPDATE",
                    "roomState": current_room.get_state_for_broadcast()
                }
                
                # Enviar a todos los jugadores en la misma sala
                for player_conn_id, player in list(current_room.players.items()):
                    try:
                        # (En realidad necesitarías una forma de obtener el websocket de cada jugador)
                        # Esto es un ejemplo simplificado
                        if player_conn_id != conn_id:  # No reenviar al mismo jugador
                            pass  # Aquí iría la lógica real de envío
                    except:
                        continue
                
                # Enviar confirmación al jugador actual
                await websocket.send(json.dumps({
                    "type": "ACK",
                    "serverTime": datetime.now().isoformat(),
                    "onlinePlayers": stats.current_players,
                    "activeBots": stats.current_bots
                }))

            except json.JSONDecodeError:
                print(f"[⚠️] Mensaje inválido de {conn_id}")

    except websockets.exceptions.ConnectionClosed:
        print(f"[🔌] Conexión cerrada: {conn_id}")
    finally:
        # 6. LIMPIEZA AL DESCONECTAR
        if current_room and current_player:
            current_room.remove_player(conn_id)
        
        stats.current_players = max(0, stats.current_players - 1)
        print(f"[👋] Jugador desconectado | Restantes: {stats.current_players}")

# ================= INICIO DEL SERVIDOR =================
async def main():
    port = 8765
    print(f"[🚀] Servidor de juego Zombie Survivor iniciando en ws://localhost:{port}")
    print(f"[📊] Estadísticas iniciales: {stats.to_dict()}")
    
    async with websockets.serve(game_server, "0.0.0.0", port):
        print("[✅] Servidor listo para conexiones WebSocket")
        print("[ℹ️]  Los clientes pueden conectarse usando dirección WebSocket")
        
        # Mantener el servidor ejecutándose
        await asyncio.Future()  # Corre para siempre

if __name__ == "__main__":
    # Configurar logging
    logging.basicConfig(level=logging.INFO)
    
    # Ejecutar servidor
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[❌] Servidor detenido manualmente")
