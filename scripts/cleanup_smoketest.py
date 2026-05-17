"""Limpia datos de smoke-test."""
import asyncio, asyncpg, os


async def main():
    c = await asyncpg.connect(
        host="db.yxchclzczusogzfpqyir.supabase.co",
        user="postgres",
        password=os.environ["SUPABASE_DB_PASSWORD"],
        database="postgres",
        ssl="require",
    )
    await c.execute("delete from phishing_detections where user_jid = 'smoke-test@lid'")
    await c.execute("delete from pymes where owner_jid = 'smoke-test@lid'")
    p = await c.fetchval("select count(*) from pymes")
    d = await c.fetchval("select count(*) from phishing_detections")
    print(f"PyMEs={p}  Detecciones={d}")
    await c.close()


asyncio.run(main())
