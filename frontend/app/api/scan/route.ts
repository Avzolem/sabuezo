import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El escaneo real tarda 15-40s; sin esto Vercel corta la función a ~10s (504 HTML).
export const maxDuration = 60;

const API_URL = process.env.INTERNAL_API_URL;
const TOKEN = process.env.INTERNAL_API_TOKEN;

// Rate limiting simple en memoria (best effort, sirve para hackathon)
// En cold start de Vercel se reinicia; aceptable para demo.
const calls = new Map<string, number[]>();
const LIMIT = 6;
const WINDOW_MS = 10 * 60 * 1000; // 10 min

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const recent = (calls.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  calls.set(ip, recent);
  return true;
}

function isValidUrl(u: string): boolean {
  if (!u || u.length > 500) return false;
  // Quitar protocolo si lo trae
  const stripped = u.trim().replace(/^https?:\/\//, "");
  // Dominio razonable
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+/i.test(stripped);
}

export async function POST(req: Request) {
  if (!API_URL || !TOKEN) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!rateLimitOk(ip)) {
    return NextResponse.json(
      { error: "Demasiados escaneos desde tu red. Inténtalo en unos minutos." },
      { status: 429 }
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const url = (body.url || "").trim();
  if (!isValidUrl(url)) {
    return NextResponse.json(
      { error: "URL inválida. Usa formato como 'misitio.com' o 'https://misitio.com'." },
      { status: 400 }
    );
  }

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 60000);

    const upstream = await fetch(`${API_URL}/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": TOKEN,
      },
      body: JSON.stringify({ url }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!upstream.ok) {
      // Log crudo en el server; al cliente solo un mensaje limpio.
      const text = await upstream.text();
      console.error(`[scan] backend ${upstream.status}: ${text.slice(0, 300)}`);
      return NextResponse.json(
        { error: "El motor de análisis no pudo procesar el sitio. Intenta de nuevo en un momento." },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    console.error(`[scan] fallo de red: ${e instanceof Error ? e.message : "unknown"}`);
    return NextResponse.json(
      {
        error: isAbort
          ? "El escaneo tardó demasiado, el servidor está ocupado. Intenta de nuevo."
          : "No pudimos conectar con el motor de análisis. Reintenta en un minuto.",
      },
      { status: isAbort ? 504 : 502 }
    );
  }
}
