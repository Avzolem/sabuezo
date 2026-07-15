// Server-only. Inteligencia de IP para /ip: geolocalización + reputación + registro.
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type IpGeo = {
  ip: string;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type IpReputation = {
  isp: string | null;
  isProxy: boolean | null; // VPN / proxy / Tor
  isHosting: boolean | null; // datacenter / hosting
  isMobile: boolean | null;
  abuseScore: number | null; // AbuseIPDB 0-100 (null si no hay key)
};

/** Extrae la IP pública del visitante desde los headers del proxy (Vercel). */
export function getClientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") || "";
}

function dec(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Geo instantánea desde los headers que Vercel inyecta (sin API externa). */
export function getVercelGeo(h: Headers, ip: string): IpGeo {
  const lat = h.get("x-vercel-ip-latitude");
  const lon = h.get("x-vercel-ip-longitude");
  return {
    ip,
    country: dec(h.get("x-vercel-ip-country")),
    region: dec(h.get("x-vercel-ip-country-region")),
    city: dec(h.get("x-vercel-ip-city")),
    latitude: lat ? Number(lat) : null,
    longitude: lon ? Number(lon) : null,
  };
}

const isPublicIp = (ip: string) =>
  !!ip &&
  !/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fe80:|fc00:|localhost)/i.test(
    ip
  );

/**
 * Reputación vía ip-api (gratis, sin key): proxy/VPN, datacenter, móvil, ISP.
 * Si falla, degrada a nulls sin romper. También completa geo si Vercel no la dio.
 */
export async function lookupReputation(
  ip: string,
  geo: IpGeo
): Promise<{ rep: IpReputation; geo: IpGeo }> {
  const rep: IpReputation = {
    isp: null,
    isProxy: null,
    isHosting: null,
    isMobile: null,
    abuseScore: null,
  };
  if (!isPublicIp(ip)) return { rep, geo };

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(
      ip
    )}?fields=status,country,regionName,city,lat,lon,isp,proxy,hosting,mobile`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const d = await r.json();
      if (d.status === "success") {
        rep.isp = d.isp ?? null;
        rep.isProxy = !!d.proxy;
        rep.isHosting = !!d.hosting;
        rep.isMobile = !!d.mobile;
        // Completa geo faltante con ip-api.
        geo = {
          ...geo,
          country: geo.country ?? (d.country || null),
          region: geo.region ?? (d.regionName || null),
          city: geo.city ?? (d.city || null),
          latitude: geo.latitude ?? (typeof d.lat === "number" ? d.lat : null),
          longitude:
            geo.longitude ?? (typeof d.lon === "number" ? d.lon : null),
        };
      }
    }
  } catch {
    // silencioso: nos quedamos con la geo de Vercel
  }

  // AbuseIPDB (opcional): solo si hay API key configurada.
  const key = process.env.ABUSEIPDB_API_KEY;
  if (key) {
    try {
      const r = await fetch(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(
          ip
        )}&maxAgeInDays=90`,
        {
          headers: { Key: key, Accept: "application/json" },
          signal: AbortSignal.timeout(6000),
        }
      );
      if (r.ok) {
        const d = await r.json();
        const score = d?.data?.abuseConfidenceScore;
        if (typeof score === "number") rep.abuseScore = score;
      }
    } catch {
      // silencioso
    }
  }

  return { rep, geo };
}

/** Registra la visita en Supabase (service_role, bypassa RLS). No lanza. */
export async function recordVisit(
  geo: IpGeo,
  rep: IpReputation,
  meta: { userAgent: string | null; referer: string | null }
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("ip_visits").insert({
      ip: geo.ip || null,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      latitude: geo.latitude,
      longitude: geo.longitude,
      isp: rep.isp,
      is_proxy: rep.isProxy,
      is_hosting: rep.isHosting,
      is_mobile: rep.isMobile,
      abuse_score: rep.abuseScore,
      user_agent: meta.userAgent,
      referer: meta.referer,
    });
  } catch (e) {
    console.error("[ip-visits] no se pudo registrar la visita:", e);
  }
}
