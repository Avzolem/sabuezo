import { cookies } from "next/headers";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH_COOKIE = "metricas_ok";

function authToken(): string {
  const pass = process.env.METRICAS_PASSWORD || "";
  return createHash("sha256").update(`sabuezo-metricas::${pass}`).digest("hex");
}

async function isAuthed(): Promise<boolean> {
  if (!process.env.METRICAS_PASSWORD) return true;
  const c = await cookies();
  return c.get(AUTH_COOKIE)?.value === authToken();
}

export async function GET() {
  if (!(await isAuthed())) {
    return new Response("No autorizado", { status: 401 });
  }

  const url = process.env.INTERNAL_API_URL;
  const token = process.env.INTERNAL_API_TOKEN;
  if (!url || !token) {
    return new Response("Servidor no configurado", { status: 500 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${url}/metrics/export.xlsx`, {
      headers: { "x-internal-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return new Response("No pude generar el archivo (backend sin respuesta).", { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(`Backend respondió ${upstream.status}`, { status: 502 });
  }

  const buf = await upstream.arrayBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sabuezo-export-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
