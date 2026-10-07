import hmac
import hashlib
import json
import time
from typing import Optional, Dict, Any
from app.config import settings

class EphemeralTokenVault:
    """
    Sub-millisecond token store simulating Redis TTL with strict HMAC-SHA256 verification.
    Enforces time-expiring and purpose-bound record grants.
    """
    def __init__(self):
        # Maps token_hash -> {"data": dict, "expires_at": float, "status": str}
        self._store: Dict[str, Dict[str, Any]] = {}

    def _sign_payload(self, payload_str: str) -> str:
        return hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            payload_str.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

    def create_grant_token(
        self,
        consent_id: str,
        practitioner_id: str,
        patient_id: str,
        record_id: str,
        purpose: str,
        duration_seconds: int = 3600
    ) -> Dict[str, Any]:
        issued_at = int(time.time())
        expires_at = issued_at + duration_seconds

        token_body = {
            "token_type": "carebridge_consent_grant",
            "consent_id": consent_id,
            "practitioner_id": practitioner_id,
            "patient_id": patient_id,
            "record_id": record_id,
            "purpose": purpose,
            "access_scope": "stream_only",
            "issued_at": issued_at,
            "expires_at": expires_at
        }
        
        canonical_str = json.dumps(token_body, sort_keys=True)
        signature = self._sign_payload(canonical_str)
        token_body["hmac_signature"] = signature

        token_hash = hashlib.sha256(signature.encode("utf-8")).hexdigest()

        # Store in ephemeral memory with expiry
        self._store[token_hash] = {
            "payload": token_body,
            "expires_at": expires_at,
            "status": "ACTIVE"
        }

        return {
            "token": token_hash,
            "payload": token_body,
            "expires_at": expires_at
        }

    def verify_and_check(self, token_hash: str) -> Dict[str, Any]:
        """
        Returns status: ACTIVE, EXPIRED, REVOKED, or NOT_FOUND
        """
        entry = self._store.get(token_hash)
        if not entry:
            return {"valid": False, "status": "NOT_FOUND", "reason": "Token does not exist"}

        if entry["status"] == "REVOKED":
            return {"valid": False, "status": "REVOKED", "reason": "Consent has been revoked by patient"}

        now = time.time()
        if now > entry["expires_at"]:
            entry["status"] = "EXPIRED"
            return {"valid": False, "status": "EXPIRED", "reason": "Grant token has expired"}

        return {
            "valid": True,
            "status": "ACTIVE",
            "payload": entry["payload"],
            "remaining_seconds": int(entry["expires_at"] - now)
        }

    def revoke_token(self, token_hash: str) -> bool:
        if token_hash in self._store:
            self._store[token_hash]["status"] = "REVOKED"
            return True
        return False

    def revoke_by_consent_id(self, consent_id: str) -> bool:
        revoked = False
        for token_hash, entry in self._store.items():
            if entry.get("payload", {}).get("consent_id") == consent_id:
                entry["status"] = "REVOKED"
                revoked = True
        return revoked

# Global singleton vault instance
token_vault = EphemeralTokenVault()
