import asyncio
import websockets
import json
import logging
from datetime import datetime
from typing import Dict, Set, Any
import firebase_admin
from firebase_admin import auth, credentials
from dataclasses import dataclass, asdict
import secrets

# ================= CONFIGURACIÓN =================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración de Firebase (descarga tu clave desde Firebase Console)
FIREBASE_CREDENTIALS_PATH = "firebase-private-key.json"

try:
    cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)
    logger.info("[✅] Firebase Admin inicializado")
except Exception as e:
    logger.warning(f"[⚠️] Firebase no disponible (operando en modo local/desarrollo): {e}")

# ================= ESTRUCTURAS DE DATOS =================
@dataclass
class Player:
    """Representa un jugador conectado"""
    uid: str
    name: str
    avatar_idx: int
    room_id: str = "main_room"
    x: float = 0.0
    y: float = 0.0
    hp: int = 1000
    score: int = 0
    angle: float = 0.0
    has_helmet: bool = False
    on_motorcycle: bool = False
    is_invisible: bool = False
    last_update: datetime = None
    ws_connection: Any = None
    is_guest: bool = True
    
    def to_dict(self):
        return {
            "uid": self.uid,
            "name": self.name,
            "avatarIdx": self.avatar_idx,
            "roomId": self.room_id,
            "x": self.x,
            "y": self.y,
            "hp": self.hp,
            "score": self.score,
            "angle": self.angle,
            "hasHelmet": self.has_helmet,
            "onMotorcycle": self.on_motorcycle,
            "isInvisible": self.is_invisible
        }

@dataclass
class Room:
    """Sala de juego multijugador"""
    id: str
    players: Dict[str, Player]
    max_players: int = 50
    created_at: datetime = None
    zombie_count: int = 10
    bot_count: int = 10
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
    
    def add_player(self, player: Player):
        if len(self.players) < self.max_players:
            self.players[player.uid] = player
            return True
        return False
    
    def remove_player(self, uid: str):
        if uid in self.players:
            del self.players[uid]
            return True
        return False
    
    def get_state(self):
        return {
            "roomId": self.id,
            "playerCount": len(self.players),
            "zombieCount": self.zombie_count,
            "botCount": self.bot_count,
            "players": [p.to_dict() for p in self.players.values()],
            "createdAt": self.created_at.isoformat()
        }

class GameServer:
    """Servidor principal del juego"""
    
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        # Crear sala inicial por defecto
        self.main_room = Room(id="main_room", players={})
        self.rooms["main_room"] = self.main_room
        
        # Estadísticas
        self.total_connections = 0
        self.current_players = 0
        self.peak_players = 0
        self.total_zombies_killed = 0
        self.total_bots_spawned = 0
        
        # Configuración del juego
        self.max_zombies_per_room = 100
        self.bot_spawn_rate = 30  # segundos
        self.last_bot_spawn = datetime.now()
    
    def get_stats(self):
        return {
            "totalConnections": self.total_connections,
            "currentPlayers": self.current_players,
            "peakPlayers": self.peak_players,
            "activeRooms": len(self.rooms),
            "totalZombiesKilled": self.total_zombies_killed,
            "activeBots": self.total_bots_spawned,
            "serverTime": datetime.now().isoformat()
        }
    
    async def spawn_bots(self):
        """Genera bots automáticamente en salas activas"""
        now = datetime.now()
        if (now - self.last_bot_spawn).seconds >= self.bot_spawn_rate:
            self.total_bots_spawned += 1
            self.last_bot_spawn = now
            
            # Aumentar zombies en todas las salas
            for room in self.rooms.values():
                if room.players:
                    room.zombie_count = min(
                        self.max_zombies_per_room,
                        room.zombie_count + 2
                    )
    
    async def broadcast_room_state(self, room: Room):
        """Envía el estado actual de la sala a todos sus jugadores"""
        room_state = room.get_state()
        server_stats = self.get_stats()
        
        broadcast_data = {
            "type": "ROOM_UPDATE",
            "roomState": room_state,
            "serverStats": server_stats,
            "timestamp": datetime.now().isoformat()
        }
        
        serialized = json.dumps(broadcast_data)
        tasks = []
        for player in room.players.values():
            if player.ws_connection:
                try:
                    tasks.append(player.ws_connection.send(serialized))
                except:
                    continue
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def broadcast_chat(self, room: Room, message: str, sender: str = "Sistema"):
        """Envía un mensaje de chat a la sala"""
        chat_data = {
            "type": "CHAT_MESSAGE",
            "sender": sender,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        serialized = json.dumps(chat_data)
        tasks = []
        for player in room.players.values():
            if player.ws_connection:
                try:
                    tasks.append(player.ws_connection.send(serialized))
                except:
                    continue
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def handle_player_join(self, websocket, data: Dict):
        """Maneja la conexión de un nuevo jugador a una sala"""
        try:
            player_data = data.get("playerData", {})
            firebase_token = data.get("firebaseToken")
            room_id = data.get("roomId", "main_room").strip().lower()
            if not room_id:
                room_id = "main_room"
            
            uid = player_data.get("uid", f"guest_{secrets.token_hex(8)}")
            name = player_data.get("name", "Agente")
            avatar_idx = player_data.get("avatarIdx", 0)
            is_guest = player_data.get("isGuest", True)
            
            # Verificar token de Firebase si no es invitado y Firebase está activo
            if firebase_token and not is_guest and firebase_admin._apps:
                try:
                    decoded_token = auth.verify_id_token(firebase_token)
                    uid = decoded_token["uid"]
                    name = decoded_token.get("name", name)
                    is_guest = False
                except Exception as e:
                    logger.warning(f"Error verificando token de Firebase: {e}")
            
            # Crear o buscar sala
            if room_id not in self.rooms:
                self.rooms[room_id] = Room(id=room_id, players={})
            room = self.rooms[room_id]
            
            # Crear jugador
            player = Player(
                uid=uid,
                name=name,
                avatar_idx=avatar_idx,
                room_id=room_id,
                ws_connection=websocket,
                is_guest=is_guest,
                last_update=datetime.now()
            )
            
            if room.add_player(player):
                self.total_connections += 1
                self.current_players += 1
                self.peak_players = max(self.peak_players, self.current_players)
                
                logger.info(f"[🎮] {name} se unió a la sala '{room_id}'")
                
                # Enviar bienvenida
                welcome_data = {
                    "type": "WELCOME",
                    "player": player.to_dict(),
                    "roomState": room.get_state(),
                    "serverStats": self.get_stats(),
                    "message": f"Conectado con éxito a la sala: {room_id.upper()}"
                }
                
                await websocket.send(json.dumps(welcome_data))
                
                # Notificar a otros en la misma sala
                await self.broadcast_chat(
                    room,
                    f"🎮 {name} se unió a la operación táctica.",
                    "Sistema"
                )
                
                # Broadcast del estado de sala
                await self.broadcast_room_state(room)
                return player
            else:
                await websocket.send(json.dumps({
                    "type": "ERROR",
                    "message": "La sala seleccionada está completa"
                }))
                return None
                
        except Exception as e:
            logger.error(f"Error en player_join: {e}")
            await websocket.send(json.dumps({
                "type": "ERROR",
                "message": "Error interno al conectar"
            }))
            return None
    
    async def handle_player_update(self, player: Player, data: Dict):
        """Actualiza la posición/estado de un jugador"""
        try:
            update_data = data.get("player", {})
            player.x = update_data.get("x", player.x)
            player.y = update_data.get("y", player.y)
            player.hp = update_data.get("hp", player.hp)
            player.score = update_data.get("score", player.score)
            player.angle = update_data.get("angle", player.angle)
            player.has_helmet = update_data.get("hasHelmet", player.has_helmet)
            player.on_motorcycle = update_data.get("onMotorcycle", player.on_motorcycle)
            player.is_invisible = update_data.get("isInvisible", player.is_invisible)
            player.last_update = datetime.now()
        except Exception as e:
            logger.error(f"Error en player_update: {e}")
    
    async def handle_chat_message(self, player: Player, data: Dict):
        """Maneja mensajes de chat"""
        try:
            message = data.get("message", "").strip()
            room = self.rooms.get(player.room_id)
            if message and room and len(message) <= 200:
                await self.broadcast_chat(
                    room,
                    message,
                    player.name
                )
        except Exception as e:
            logger.error(f"Error en chat: {e}")
    
    async def handle_game_event(self, player: Player, data: Dict):
        """Maneja eventos del juego"""
        try:
            event_type = data.get("eventType")
            room = self.rooms.get(player.room_id)
            if not room:
                return
                
            if event_type == "ZOMBIE_KILLED":
                self.total_zombies_killed += 1
                await self.broadcast_chat(
                    room,
                    f"☠️ {player.name} neutralizó a un zombie",
                    "Sistema"
                )
            elif event_type == "ITEM_PICKED":
                item_type = data.get("itemType")
                await self.broadcast_chat(
                    room,
                    f"🎁 {player.name} recolectó {item_type}",
                    "Sistema"
                )
        except Exception as e:
            logger.error(f"Error en game_event: {e}")
    
    async def handle_disconnection(self, player: Player):
        """Limpia los datos cuando un jugador se desconecta"""
        try:
            room_id = player.room_id
            room = self.rooms.get(room_id)
            if room and player.uid in room.players:
                room.remove_player(player.uid)
                self.current_players = max(0, self.current_players - 1)
                
                logger.info(f"[👋] {player.name} abandonó la sala '{room_id}'")
                
                # Notificar desconexión
                await self.broadcast_chat(
                    room,
                    f"🚪 {player.name} abandonó la partida.",
                    "Sistema"
                )
                
                # Broadcast de la sala
                await self.broadcast_room_state(room)
                
                # Limpiar sala vacía (excepto main_room)
                if len(room.players) == 0 and room_id != "main_room":
                    del self.rooms[room_id]
                    logger.info(f"[🗑️] Sala vacía eliminada: '{room_id}'")
        except Exception as e:
            logger.error(f"Error en desconexión: {e}")
    
    async def connection_handler(self, websocket, path):
        """Manejador principal de conexiones WebSocket"""
        player = None
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    message_type = data.get("type")
                    
                    if message_type == "PLAYER_JOIN":
                        player = await self.handle_player_join(websocket, data)
                    elif message_type == "PLAYER_UPDATE" and player:
                        await self.handle_player_update(player, data)
                    elif message_type == "CHAT_MESSAGE" and player:
                        await self.handle_chat_message(player, data)
                    elif message_type == "GAME_EVENT" and player:
                        await self.handle_game_event(player, data)
                    elif message_type == "PING":
                        await websocket.send(json.dumps({
                            "type": "PONG",
                            "timestamp": datetime.now().isoformat()
                        }))
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        "type": "ERROR",
                        "message": "Mensaje JSON inválido"
                    }))
                except Exception as e:
                    logger.error(f"Error procesando mensaje: {e}")
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"[🔌] Conexión cerrada por el cliente")
        finally:
            if player:
                await self.handle_disconnection(player)
    
    async def room_broadcast_loop(self):
        """Envía el estado de las salas activas a 30 FPS para un movimiento totalmente suave"""
        while True:
            try:
                for room in list(self.rooms.values()):
                    if room.players:
                        await self.broadcast_room_state(room)
                await asyncio.sleep(0.033) # ~30 Ticks por segundo
            except Exception as e:
                logger.error(f"Error en loop de broadcast: {e}")
                await asyncio.sleep(1)

    async def background_cleanup_tasks(self):
        """Tareas periódicas secundarias de limpieza y estadísticas (cada 5 segundos)"""
        while True:
            try:
                await self.spawn_bots()
                
                # Limpieza de jugadores inactivos (timeout 45 segundos)
                now = datetime.now()
                for room in list(self.rooms.values()):
                    inactive_uids = []
                    for p in list(room.players.values()):
                        if p.last_update and (now - p.last_update).seconds > 45:
                            inactive_uids.append(p.uid)
                    for uid in inactive_uids:
                        p = room.players.get(uid)
                        if p:
                            await self.handle_disconnection(p)
                
                # Registro periódico de estado del servidor
                logger.info(f"[📊] Servidor en línea. Salas activas: {len(self.rooms)}. Conexiones activas: {self.current_players}")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Error en tareas de limpieza: {e}")
                await asyncio.sleep(5)

# ================= INICIO DEL SERVIDOR =================
async def main():
    server = GameServer()
    
    # Iniciar loops de tareas asíncronas
    asyncio.create_task(server.room_broadcast_loop())
    asyncio.create_task(server.background_cleanup_tasks())
    
    PORT = 8765
    HOST = "0.0.0.0"
    
    logger.info(f"[🚀] Servidor Zombie Survivor Iniciando en {HOST}:{PORT}")
    logger.info("[⚡] Presiona Ctrl+C para apagar el servidor")
    
    async with websockets.serve(
        server.connection_handler,
        HOST,
        PORT,
        ping_interval=20,
        ping_timeout=30,
        close_timeout=5
    ):
        logger.info("[✅] Servidor WebSocket en línea y listo para recibir agentes.")
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("[❌] Servidor detenido ordenadamente por el administrador.")
    except Exception as e:
        logger.error(f"[💥] Error crítico del servidor: {e}")
