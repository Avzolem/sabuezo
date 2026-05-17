"""Aplica el schema SQL a Supabase via conexión directa Postgres.

Uso (en el VPS):
  cd /home/avsolem/sabuezo
  backend/.venv/bin/python scripts/apply_schema.py
"""
import asyncio
import asyncpg
import os
import sys
from pathlib import Path


async def main():
    pwd = os.environ.get("SUPABASE_DB_PASSWORD")
    if not pwd:
        print("ERROR: define SUPABASE_DB_PASSWORD en env", file=sys.stderr)
        sys.exit(1)

    host = os.environ.get("SUPABASE_DB_HOST", "db.yxchclzczusogzfpqyir.supabase.co")
    user = os.environ.get("SUPABASE_DB_USER", "postgres")
    port = int(os.environ.get("SUPABASE_DB_PORT", "5432"))
    dbname = os.environ.get("SUPABASE_DB_NAME", "postgres")

    print(f"Conectando a {host}:{port} como {user}/{dbname}...")
    conn = await asyncpg.connect(
        host=host, port=port, user=user, password=pwd, database=dbname,
        ssl="require",
        timeout=15,
    )
    print("✓ Conexión OK")

    sql_path = Path(__file__).parent / "01_schema.sql"
    sql = sql_path.read_text()
    print(f"Aplicando {sql_path.name} ({len(sql)} bytes)...")
    await conn.execute(sql)
    print("✓ Schema aplicado")

    rows = await conn.fetch("""
        select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name
    """)
    print("Tablas en public:", [r["table_name"] for r in rows])

    views = await conn.fetch("""
        select table_name from information_schema.views
        where table_schema = 'public'
        order by table_name
    """)
    print("Vistas en public:", [r["table_name"] for r in views])

    counts = {}
    for t in ["pymes", "scans", "phishing_detections"]:
        c = await conn.fetchval(f"select count(*) from public.{t}")
        counts[t] = c
    print("Counts iniciales:", counts)

    await conn.close()
    print("✅ Listo")


if __name__ == "__main__":
    asyncio.run(main())
