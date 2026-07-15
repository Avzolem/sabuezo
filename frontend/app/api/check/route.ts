import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const API_URL = process.env.INTERNAL_API_URL;
const TOKEN = process.env.INTERNAL_API_TOKEN;

const calls = new Map<string, number[]>();
const LIMIT = 8;
const WINDOW_MS = 10 * 60 * 1000;

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const recent = (calls.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  calls.set(ip, recent);
  return true;
}

function isValidEmail(v: string): boolean {
  return /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(v) && v.length <= 254;
}

function isValidPhone(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
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
      { error: "Demasiadas consultas desde tu red. Inténtalo en unos minutos." },
      { status: 429 }
    );
  }

  let body: { type?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const type = (body.type || "").trim().toLowerCase();
  const value = (body.value || "").trim();

  if (type !== "email" && type !== "phone") {
    return NextResponse.json({ error: "type debe ser 'email' o 'phone'" }, { status: 400 });
  }
  if (type === "email" && !isValidEmail(value)) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }
  if (type === "phone" && !isValidPhone(value)) {
    return NextResponse.json(
      { error: "Número inválido. Usa 10 dígitos (MX) o incluye tu lada internacional (+52, +57, +54, +56, +51, +593…)." },
      { status: 400 }
    );
  }

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 30000);

    const upstream = await fetch(`${API_URL}/check/${type}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-token": TOKEN,
      },
      body: JSON.stringify({ value, source: "web" }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error(`[check] backend ${upstream.status}: ${text.slice(0, 300)}`);
      return NextResponse.json(
        { error: "El servicio de verificación no está disponible. Intenta de nuevo en un momento." },
        { status: 502 }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    console.error(`[check] fallo de red: ${e instanceof Error ? e.message : "unknown"}`);
    return NextResponse.json(
      {
        error: isAbort
          ? "La verificación tardó demasiado. Intenta de nuevo."
          : "No pudimos conectar con el servicio. Reintenta en un minuto.",
      },
      { status: isAbort ? 504 : 502 }
    );
  }
}
