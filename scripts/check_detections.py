"""Lista detecciones recientes de phishing."""
import asyncio, asyncpg, os


async def main():
    c = await asyncpg.connect(
        host="db.yxchclzczusogzfpqyir.supabase.co",
        user="postgres",
        password=os.environ["SUPABASE_DB_PASSWORD"],
        database="postgres",
        ssl="require",
    )
    rows = await c.fetch(
        "select risk, category, pyme_id is not null as linked, kind, created_at from phishing_detections order by created_at desc"
    )
    print(f"Total: {len(rows)}")
    counts = {"rojo": 0, "amarillo": 0, "verde": 0}
    for r in rows:
        counts[r["risk"]] = counts.get(r["risk"], 0) + 1
        linked = "✓" if r["linked"] else "✗"
        print(f"  [{r['risk']:8}] linked={linked} kind={r['kind']:5} {r['category']}")
    print("\nResumen:", counts)
    await c.close()


asyncio.run(main())
