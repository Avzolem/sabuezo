"""Cliente Supabase + helpers de persistencia.

Usa el service-role key (sb_secret_*) que bypassa RLS.
Todas las funciones son síncronas (supabase-py v2 no es async-native),
pero son rápidas y las llamamos desde rutas async sin bloquear apreciablemente.
"""
import os
from typing import Optional, Any
from supabase import create_client, Client

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en env")
        _client = create_client(url, key)
    return _client


# ============================================================
# PyMEs
# ============================================================
def upsert_pyme(
    owner_jid: str,
    name: str,
    website: str,
    owner_email: Optional[str] = None,
    pushname: Optional[str] = None,
) -> dict:
    """Crea o actualiza una PyME por owner_jid (idempotente)."""
    client = get_client()
    payload = {
        "owner_jid": owner_jid,
        "name": name,
        "website": website,
        "owner_email": owner_email,
        "pushname": pushname,
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    # upsert por owner_jid (que es unique)
    res = client.table("pymes").upsert(payload, on_conflict="owner_jid").execute()
    return res.data[0] if res.data else {}


def get_pyme_by_jid(owner_jid: str) -> Optional[dict]:
    client = get_client()
    res = client.table("pymes").select("*").eq("owner_jid", owner_jid).limit(1).execute()
    return res.data[0] if res.data else None


def update_pyme_last_scan(pyme_id: str, score: int) -> None:
    from datetime import datetime, timezone
    client = get_client()
    client.table("pymes").update({
        "last_scan_at": datetime.now(timezone.utc).isoformat(),
        "last_score": score,
    }).eq("id", pyme_id).execute()


# ============================================================
# Scans
# ============================================================
def save_scan(pyme_id: Optional[str], scan_result: dict) -> dict:
    client = get_client()
    payload = {
        "pyme_id": pyme_id,
        "url": scan_result.get("url"),
        "domain": scan_result.get("domain"),
        "score": scan_result.get("score", 0),
        "summary": scan_result.get("summary"),
        "findings": scan_result.get("findings", []),
        "raw": scan_result.get("raw", {}),
    }
    res = client.table("scans").insert(payload).execute()
    if pyme_id and res.data:
        update_pyme_last_scan(pyme_id, scan_result.get("score", 0))
    return res.data[0] if res.data else {}


# ============================================================
# Phishing detections
# ============================================================
def save_phishing_detection(
    user_jid: str,
    kind: str,
    risk: str,
    analysis: dict,
    raw_content: str = "",
    pushname: Optional[str] = None,
    pyme_id: Optional[str] = None,
) -> dict:
    client = get_client()
    payload = {
        "pyme_id": pyme_id,
        "user_jid": user_jid,
        "pushname": pushname,
        "kind": kind,
        "risk": risk,
        "confidence": analysis.get("confidence"),
        "category": analysis.get("category"),
        "red_flags": analysis.get("red_flags", []),
        "explanation": analysis.get("explanation"),
        "recommended_action": analysis.get("recommended_action"),
        "raw_content": (raw_content or "")[:2000],
        "metadata": analysis.get("metadata", {}),
    }
    res = client.table("phishing_detections").insert(payload).execute()
    return res.data[0] if res.data else {}


# ============================================================
# Queries auxiliares (para dashboard / cross-ref)
# ============================================================
def recent_detections_for_pyme(pyme_id: str, limit: int = 10) -> list[dict]:
    client = get_client()
    res = (
        client.table("phishing_detections")
        .select("*")
        .eq("pyme_id", pyme_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


def latest_scan_for_pyme(pyme_id: str) -> Optional[dict]:
    client = get_client()
    res = (
        client.table("scans")
        .select("*")
        .eq("pyme_id", pyme_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None
