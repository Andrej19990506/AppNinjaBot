"""
Redis client configuration for WebSocket service
"""
import os
import json
import logging
from typing import Optional, Dict, Any
import redis.asyncio as redis
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class RedisManager:
    """Redis connection manager for WebSocket service"""
    
    def __init__(self):
        self.redis_host = os.getenv("REDIS_HOST", "cache")
        self.redis_port = int(os.getenv("REDIS_PORT", 6379))
        self.redis_db = int(os.getenv("REDIS_DB", 0))
        self.redis_password = os.getenv("REDIS_PASSWORD", None)
        self.client: Optional[redis.Redis] = None
        
    async def connect(self):
        """Connect to Redis"""
        try:
            self.client = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                password=self.redis_password,
                decode_responses=True,
                socket_keepalive=True,
                socket_keepalive_options={},
                retry_on_timeout=True
            )
            
            # Test connection
            await self.client.ping()
            logger.info(f"✅ Connected to Redis at {self.redis_host}:{self.redis_port}")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.client:
            await self.client.close()
            logger.info("🔌 Disconnected from Redis")
    
    async def set_connection_info(self, sid: str, connection_data: Dict[str, Any], ttl: int = 3600):
        """Store connection information in Redis"""
        if not self.client:
            return False
            
        try:
            key = f"websocket:connection:{sid}"
            await self.client.setex(key, ttl, json.dumps(connection_data))
            return True
        except Exception as e:
            logger.error(f"Failed to set connection info for {sid}: {e}")
            return False
    
    async def get_connection_info(self, sid: str) -> Optional[Dict[str, Any]]:
        """Get connection information from Redis"""
        if not self.client:
            return None
            
        try:
            key = f"websocket:connection:{sid}"
            data = await self.client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Failed to get connection info for {sid}: {e}")
            return None
    
    async def remove_connection_info(self, sid: str):
        """Remove connection information from Redis"""
        if not self.client:
            return False
            
        try:
            key = f"websocket:connection:{sid}"
            await self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Failed to remove connection info for {sid}: {e}")
            return False
    
    async def add_user_to_room(self, user_id: str, room: str):
        """Add user to room in Redis"""
        if not self.client:
            return False
            
        try:
            key = f"websocket:room:{room}"
            await self.client.sadd(key, user_id)
            await self.client.expire(key, 3600)  # 1 hour TTL
            return True
        except Exception as e:
            logger.error(f"Failed to add user {user_id} to room {room}: {e}")
            return False
    
    async def remove_user_from_room(self, user_id: str, room: str):
        """Remove user from room in Redis"""
        if not self.client:
            return False
            
        try:
            key = f"websocket:room:{room}"
            await self.client.srem(key, user_id)
            return True
        except Exception as e:
            logger.error(f"Failed to remove user {user_id} from room {room}: {e}")
            return False
    
    async def get_room_users(self, room: str) -> set:
        """Get all users in a room from Redis"""
        if not self.client:
            return set()
            
        try:
            key = f"websocket:room:{room}"
            users = await self.client.smembers(key)
            return users if users else set()
        except Exception as e:
            logger.error(f"Failed to get users for room {room}: {e}")
            return set()
    
    async def publish_message(self, channel: str, message: Dict[str, Any]):
        """Publish message to Redis channel for broadcasting"""
        if not self.client:
            return False
            
        try:
            await self.client.publish(channel, json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"Failed to publish message to channel {channel}: {e}")
            return False
    
    async def subscribe_to_channel(self, channel: str, callback):
        """Subscribe to Redis channel for message broadcasting"""
        if not self.client:
            return None
            
        try:
            pubsub = self.client.pubsub()
            await pubsub.subscribe(channel)
            logger.info(f"🔔 Subscribed to Redis channel: {channel}")
            
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        await callback(data)
                    except Exception as e:
                        logger.error(f"Error processing Redis message: {e}")
            
        except Exception as e:
            logger.error(f"Failed to subscribe to channel {channel}: {e}")
            return None
    
    async def get_all_active_connections(self) -> Dict[str, Dict[str, Any]]:
        """Get all active connections from Redis"""
        if not self.client:
            return {}
            
        try:
            pattern = "websocket:connection:*"
            keys = await self.client.keys(pattern)
            connections = {}
            
            for key in keys:
                data = await self.client.get(key)
                if data:
                    sid = key.split(':')[-1]
                    connections[sid] = json.loads(data)
            
            return connections
        except Exception as e:
            logger.error(f"Failed to get all connections: {e}")
            return {}

# Global Redis manager instance
redis_manager = RedisManager()
