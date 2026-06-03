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
# Breach checks (filtraciones de correo/teléfono)
# ============================================================
def save_breach_check(
    kind: str,
    value: str,
    found: bool,
    breach_count: int,
    domain: Optional[str] = None,
    source: Optional[str] = None,
    user_jid: Optional[str] = None,
) -> dict:
    """Registra una consulta de filtración (email o teléfono)."""
    client = get_client()
    payload = {
        "kind": kind,
        "value": value,
        "domain": domain,
        "found": found,
        "breach_count": breach_count,
        "source": source,
        "user_jid": user_jid,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    res = client.table("breach_checks").insert(payload).execute()
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


# ============================================================
# Métricas (dashboard /metricas)
# ============================================================
def _fetch_all(client, table: str, columns: str, cap: int = 50000) -> list[dict]:
    """Trae todas las filas paginando (PostgREST corta en 1000 por request)."""
    rows: list[dict] = []
    size = 1000
    page = 0
    while len(rows) < cap:
        lo = page * size
        r = client.table(table).select(columns).range(lo, lo + size - 1).execute()
        batch = r.data or []
        rows.extend(batch)
        if len(batch) < size:
            break
        page += 1
    return rows


def _count(client, table: str) -> int:
    return client.table(table).select("id", count="exact").limit(1).execute().count or 0


def compute_metrics() -> dict:
    """Agrega todas las métricas del servicio en un solo dict serializable."""
    from collections import Counter, defaultdict

    client = get_client()

    # ---- Resumen global ----
    detections = _fetch_all(client, "phishing_detections", "user_jid")
    usuarios_bot = len({d["user_jid"] for d in detections if d.get("user_jid")})
    summary = {
        "pymes": _count(client, "pymes"),
        "sitios_escaneados": _count(client, "scans"),
        "mensajes_analizados": _count(client, "phishing_detections"),
        "chequeos_filtraciones": _count(client, "breach_checks"),
        "usuarios_unicos_bot": usuarios_bot,
    }

    # ---- Filtraciones ----
    bc = _fetch_all(client, "breach_checks", "kind,domain,found,breach_count,source,created_at")

    por_tipo = {}
    for kind in ("email", "phone"):
        rows = [x for x in bc if x.get("kind") == kind]
        filtrados = [x for x in rows if x.get("found")]
        n = len(rows)
        por_tipo[kind] = {
            "consultas": n,
            "filtrados": len(filtrados),
            "pct_filtrados": round(100 * len(filtrados) / n, 1) if n else 0,
            "prom_filtraciones": round(sum((x.get("breach_count") or 0) for x in rows) / n, 1) if n else 0,
        }

    email_domains = Counter(x["domain"] for x in bc if x.get("kind") == "email" and x.get("domain"))
    top_dominios_email = [{"dominio": d, "consultas": n} for d, n in email_domains.most_common(10)]

    phone_cc = Counter(x["domain"] for x in bc if x.get("kind") == "phone" and x.get("domain"))
    telefonos_por_pais = [{"cod_pais": d, "consultas": n} for d, n in phone_cc.most_common(10)]

    by_day = defaultdict(lambda: {"web": 0, "bot": 0})
    for x in bc:
        dia = (x.get("created_at") or "")[:10]
        if not dia:
            continue
        src = x.get("source") if x.get("source") in ("web", "bot") else "web"
        by_day[dia][src] += 1
    serie_diaria = [{"dia": d, **v} for d, v in sorted(by_day.items(), reverse=True)[:14]]

    # ---- Sitios más escaneados ----
    sc = _fetch_all(client, "scans", "domain,score")
    dom_counter = Counter(x["domain"] for x in sc if x.get("domain"))
    dom_scores = defaultdict(list)
    for x in sc:
        if x.get("domain") and x.get("score") is not None:
            dom_scores[x["domain"]].append(x["score"])
    sitios_top = []
    for d, n in dom_counter.most_common(15):
        scores = dom_scores.get(d, [])
        sitios_top.append({
            "sitio": d,
            "escaneos": n,
            "score_promedio": round(sum(scores) / len(scores)) if scores else None,
        })

    return {
        "summary": summary,
        "filtraciones_por_tipo": por_tipo,
        "top_dominios_email": top_dominios_email,
        "telefonos_por_pais": telefonos_por_pais,
        "serie_diaria": serie_diaria,
        "sitios_top": sitios_top,
    }
