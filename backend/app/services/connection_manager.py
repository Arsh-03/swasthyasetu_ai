import json
from typing import Dict, Optional
from fastapi import WebSocket


class ConnectionManager:
    """
    WebSocket connection hub for WebRTC signaling and real-time consent alerts.

    Each socket may be tied to a signed-in user (from the token passed when connecting).
    Messages with a "to" user id are delivered only to that user's sockets (call signaling);
    everything else is broadcast as before.
    """

    def __init__(self):
        # socket -> user id (None for sockets that connected without a valid token)
        self.active_connections: Dict[WebSocket, Optional[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections[websocket] = user_id

    def disconnect(self, websocket: WebSocket):
        self.active_connections.pop(websocket, None)

    def user_of(self, websocket: WebSocket) -> Optional[str]:
        return self.active_connections.get(websocket)

    async def _send(self, connection: WebSocket, text: str):
        try:
            await connection.send_text(text)
        except Exception:
            self.disconnect(connection)

    async def broadcast(self, message: Dict, exclude: Optional[WebSocket] = None):
        text = json.dumps(message)
        for connection in list(self.active_connections):
            if connection is not exclude:
                await self._send(connection, text)

    async def send_to_user(self, user_id: str, message: Dict) -> int:
        """Delivers to every open socket of one user. Returns how many sockets received it."""
        text = json.dumps(message)
        targets = [c for c, uid in list(self.active_connections.items()) if uid == user_id]
        for connection in targets:
            await self._send(connection, text)
        return len(targets)


ws_manager = ConnectionManager()
