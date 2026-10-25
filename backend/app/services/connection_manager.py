import json
from typing import Dict, Iterable, Optional, Set

from fastapi import WebSocket


class ConnectionManager:
    """
    Real-time notifications (ABHA consent requests/decisions, history updates) for signed-in users.
    Each message goes only to the users it concerns; there is no broadcast to everyone.
    """
    def __init__(self):
        self._by_user: Dict[str, Set[WebSocket]] = {}

    def add(self, user_id: str, websocket: WebSocket) -> None:
        self._by_user.setdefault(user_id, set()).add(websocket)

    def remove(self, user_id: str, websocket: WebSocket) -> None:
        sockets = self._by_user.get(user_id)
        if sockets:
            sockets.discard(websocket)
            if not sockets:
                self._by_user.pop(user_id, None)

    async def send_to(self, user_ids: Iterable[Optional[str]], message: Dict) -> None:
        text = json.dumps(message, default=str)
        for user_id in {u for u in user_ids if u}:
            for ws in list(self._by_user.get(user_id, ())):
                try:
                    await ws.send_text(text)
                except Exception:  # noqa: BLE001 - closed connection
                    self.remove(user_id, ws)


ws_manager = ConnectionManager()
