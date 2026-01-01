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
    logger.warning(f"[⚠️] Firebase no disponible (modo desarrollo): {e}")

# ================= ESTRUCTURAS DE DATOS =================
@dataclass
class Player:
    """Representa un jugador conectado"""
    uid: str
    name: str
    avatar_idx: int
    x: float = 0.0
    y: float = 0.0
    hp: int = 100
    score: int = 0
    angle: float = 0.0
    has_helmet: bool = False
    on_motorcycle: bool = False
    is_invisible: bool = False
    last_update: datetime = None
    ws_connection: Any = None
    is_guest: bool = False
    
    def to_dict(self):
        return {
            "uid": self.uid,
            "name": self.name,
            "avatarIdx": self.avatar_idx,
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
        self.main_room = Room(id="main_room", players={})
        self.rooms["main_room"] = self.main_room
        
        # Estadísticas
        self.total_connections = 0
        self.current_players = 0
        self.peak_players = 0
        self.total_zombies_killed = 0
        self.total_bots_spawned = 10
        
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
        """Genera bots automáticamente"""
        now = datetime.now()
        if (now - self.last_bot_spawn).seconds >= self.bot_spawn_rate:
            self.total_bots_spawned += 5
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
        
        tasks = []
        for player in room.players.values():
            if player.ws_connection:
                try:
                    tasks.append(
                        player.ws_connection.send(json.dumps(broadcast_data))
                    )
                except:
                    continue
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def broadcast_chat(self, room: Room, message: str, sender: str = "System"):
        """Envía un mensaje de chat a la sala"""
        chat_data = {
            "type": "CHAT_MESSAGE",
            "sender": sender,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        tasks = []
        for player in room.players.values():
            if player.ws_connection:
                try:
                    tasks.append(
                        player.ws_connection.send(json.dumps(chat_data))
                    )
                except:
                    continue
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def handle_player_join(self, websocket, data: Dict):
        """Maneja la conexión de un nuevo jugador"""
        try:
            player_data = data.get("playerData", {})
            firebase_token = data.get("firebaseToken")
            
            uid = player_data.get("uid", f"guest_{secrets.token_hex(8)}")
            name = player_data.get("name", "Agente")
            avatar_idx = player_data.get("avatarIdx", 0)
            is_guest = player_data.get("isGuest", True)
            
            # Verificar token de Firebase si no es invitado
            if firebase_token and not is_guest:
                try:
                    decoded_token = auth.verify_id_token(firebase_token)
                    uid = decoded_token["uid"]
                    name = decoded_token.get("name", name)
                    is_guest = False
                except Exception as e:
                    logger.warning(f"Error verificando token: {e}")
            
            # Crear jugador
            player = Player(
                uid=uid,
                name=name,
                avatar_idx=avatar_idx,
                ws_connection=websocket,
                is_guest=is_guest,
                last_update=datetime.now()
            )
            
            # Añadir a la sala principal
            if self.main_room.add_player(player):
                self.total_connections += 1
                self.current_players += 1
                self.peak_players = max(self.peak_players, self.current_players)
                
                logger.info(f"[🎮] {name} ({'Google' if not is_guest else 'Invitado'}) se unió a la sala")
                
                # Enviar bienvenida
                welcome_data = {
                    "type": "WELCOME",
                    "player": player.to_dict(),
                    "roomState": self.main_room.get_state(),
                    "serverStats": self.get_stats(),
                    "message": f"Bienvenido a Zombie Survivor, {name}!"
                }
                
                await websocket.send(json.dumps(welcome_data))
                
                # Notificar a otros jugadores
                await self.broadcast_chat(
                    self.main_room,
                    f"🎮 {name} se unió al juego",
                    "System"
                )
                
                # Broadcast del nuevo estado
                await self.broadcast_room_state(self.main_room)
                
                return player
            else:
                await websocket.send(json.dumps({
                    "type": "ERROR",
                    "message": "La sala está llena"
                }))
                return None
                
        except Exception as e:
            logger.error(f"Error en player_join: {e}")
            await websocket.send(json.dumps({
                "type": "ERROR",
                "message": "Error interno del servidor"
            }))
            return None
    
    async def handle_player_update(self, player: Player, data: Dict):
        """Actualiza la posición/estado de un jugador"""
        try:
            update_data = data.get("player", {})
            
            # Actualizar datos del jugador
            player.x = update_data.get("x", player.x)
            player.y = update_data.get("y", player.y)
            player.hp = update_data.get("hp", player.hp)
            player.score = update_data.get("score", player.score)
            player.angle = update_data.get("angle", player.angle)
            player.has_helmet = update_data.get("hasHelmet", player.has_helmet)
            player.on_motorcycle = update_data.get("onMotorcycle", player.on_motorcycle)
            player.is_invisible = update_data.get("isInvisible", player.is_invisible)
            player.last_update = datetime.now()
            
            # Broadcast periódico (cada 2 segundos)
            now = datetime.now()
            if hasattr(player, 'last_broadcast'):
                if (now - player.last_broadcast).seconds >= 2:
                    await self.broadcast_room_state(self.main_room)
                    player.last_broadcast = now
            else:
                player.last_broadcast = now
            
            # Confirmación al jugador
            await player.ws_connection.send(json.dumps({
                "type": "UPDATE_ACK",
                "timestamp": now.isoformat(),
                "onlinePlayers": self.current_players
            }))
            
        except Exception as e:
            logger.error(f"Error en player_update: {e}")
    
    async def handle_chat_message(self, player: Player, data: Dict):
        """Maneja mensajes de chat"""
        try:
            message = data.get("message", "").strip()
            if message and len(message) <= 200:
                await self.broadcast_chat(
                    self.main_room,
                    message,
                    player.name
                )
        except Exception as e:
            logger.error(f"Error en chat: {e}")
    
    async def handle_game_event(self, player: Player, data: Dict):
        """Maneja eventos del juego (disparos, muertes, etc.)"""
        try:
            event_type = data.get("eventType")
            
            if event_type == "ZOMBIE_KILLED":
                self.total_zombies_killed += 1
                
                # Notificar a todos (opcional)
                await self.broadcast_chat(
                    self.main_room,
                    f"☠️ {player.name} eliminó un zombie",
                    "System"
                )
                
            elif event_type == "PLAYER_HIT":
                damage = data.get("damage", 0)
                target_id = data.get("targetId")
                
                # Buscar jugador objetivo
                target = self.main_room.players.get(target_id)
                if target:
                    # En un juego real, aquí actualizarías el HP del objetivo
                    pass
                    
            elif event_type == "ITEM_PICKED":
                item_type = data.get("itemType")
                await self.broadcast_chat(
                    self.main_room,
                    f"🎁 {player.name} consiguió {item_type}",
                    "System"
                )
            
        except Exception as e:
            logger.error(f"Error en game_event: {e}")
    
    async def handle_disconnection(self, player: Player):
        """Limpia los datos cuando un jugador se desconecta"""
        try:
            if player.uid in self.main_room.players:
                self.main_room.remove_player(player.uid)
                self.current_players = max(0, self.current_players - 1)
                
                logger.info(f"[👋] {player.name} dejó el juego")
                
                # Notificar a otros jugadores
                await self.broadcast_chat(
                    self.main_room,
                    f"🚪 {player.name} dejó la partida",
                    "System"
                )
                
                # Actualizar estado de la sala
                await self.broadcast_room_state(self.main_room)
                
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
            logger.info(f"[🔌] Conexión cerrada: {player.name if player else 'Desconocido'}")
        
        finally:
            if player:
                await self.handle_disconnection(player)
    
    async def background_tasks(self):
        """Tareas en segundo plano del servidor"""
        while True:
            try:
                # Spawn de bots
                await self.spawn_bots()
                
                # Limpieza de jugadores inactivos
                now = datetime.now()
                inactive_players = []
                
                for player in list(self.main_room.players.values()):
                    if player.last_update and (now - player.last_update).seconds > 60:
                        inactive_players.append(player.uid)
                
                for uid in inactive_players:
                    player = self.main_room.players.get(uid)
                    if player:
                        await self.handle_disconnection(player)
                
                # Broadcast periódico del estado
                if self.main_room.players:
                    await self.broadcast_room_state(self.main_room)
                
                # Log de estadísticas
                if hasattr(self, 'last_stats_log'):
                    if (now - self.last_stats_log).seconds >= 30:
                        stats = self.get_stats()
                        logger.info(f"[📊] Estadísticas: {stats}")
                        self.last_stats_log = now
                else:
                    self.last_stats_log = now
                
                await asyncio.sleep(5)
                
            except Exception as e:
                logger.error(f"Error en background_tasks: {e}")
                await asyncio.sleep(10)

# ================= INICIO DEL SERVIDOR =================
async def main():
    server = GameServer()
    
    # Iniciar tareas en segundo plano
    asyncio.create_task(server.background_tasks())
    
    # Configurar WebSocket
    PORT = 8765
    HOST = "0.0.0.0"
    
    logger.info(f"[🚀] Servidor Zombie Survivor iniciando en {HOST}:{PORT}")
    logger.info(f"[📊] Estadísticas iniciales: {server.get_stats()}")
    logger.info("[⚡] Usa Ctrl+C para detener el servidor")
    
    async with websockets.serve(
        server.connection_handler,
        HOST,
        PORT,
        ping_interval=30,
        ping_timeout=60,
        close_timeout=10
    ):
        logger.info("[✅] Servidor listo para conexiones")
        
        # Mantener el servidor activo
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("[❌] Servidor detenido por el usuario")
    except Exception as e:
        logger.error(f"[💥] Error fatal: {e}")
