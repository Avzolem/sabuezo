import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Server,
  Network,
  Smartphone,
  Search,
} from "lucide-react";
import {
  getClientIp,
  getVercelGeo,
  lookupReputation,
  recordVisit,
} from "@/lib/ip-intel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "¿Cuál es mi IP? · Sabuezo",
  description:
    "Descubre tu IP pública, tu ubicación aproximada y si tu conexión muestra señales de riesgo.",
};

export default async function IpPage() {
  const h = await headers();
  const ip = getClientIp(h);
  const geo0 = getVercelGeo(h, ip);
  const { rep, geo } = await lookupReputation(ip, geo0);

  // Registra la visita (IP + geo + reputación). No bloquea el render si falla.
  await recordVisit(geo, rep, {
    userAgent: h.get("user-agent"),
    referer: h.get("referer"),
  });

  const hasIp = !!ip;
  const abuse = rep.abuseScore;
  const risky =
    rep.isProxy === true ||
    rep.isHosting === true ||
    (typeof abuse === "number" && abuse >= 25);

  const location = [geo.city, geo.region, geo.country]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      <header className="border-b border-zinc-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition"
          >
            <ArrowLeft className="size-4 text-zinc-500" />
            <Image
              src="/sabuezo-logo.webp"
              alt="Sabuezo"
              width={28}
              height={28}
              className="size-7"
            />
            <span className="font-semibold">Sabuezo</span>
          </Link>
          <div className="text-xs text-zinc-500">Mi IP</div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 space-y-6 sm:space-y-8">
        {/* Hero: la IP */}
        <section className="text-center">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400 mb-3">
            <Globe className="size-4" /> Tu huella en internet
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-4">
            Esta es tu IP pública
          </h1>
          {hasIp ? (
            <div className="inline-block rounded-2xl border border-zinc-800 bg-zinc-900/50 px-6 sm:px-10 py-5">
              <div className="text-3xl sm:text-5xl font-semibold tabular-nums text-white tracking-tight break-all">
                {ip}
              </div>
              {location && (
                <div className="mt-3 text-sm text-zinc-400 flex items-center justify-center gap-1.5">
                  <MapPin className="size-4 text-zinc-500" /> {location}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400">
              No pudimos detectar tu IP pública desde esta conexión.
            </div>
          )}
        </section>

        {hasIp && (
          <>
            {/* Veredicto */}
            <section
              className={`rounded-2xl border p-6 sm:p-8 flex items-start gap-4 ${
                risky
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-emerald-500/30 bg-emerald-500/10"
              }`}
            >
              <div
                className={`rounded-xl p-3 shrink-0 ${
                  risky ? "bg-amber-500/20" : "bg-emerald-500/20"
                }`}
              >
                {risky ? (
                  <ShieldAlert className="size-6 text-amber-300" />
                ) : (
                  <ShieldCheck className="size-6 text-emerald-300" />
                )}
              </div>
              <div>
                <h2
                  className={`text-lg sm:text-xl font-semibold ${
                    risky ? "text-amber-200" : "text-emerald-200"
                  }`}
                >
                  {risky
                    ? "Tu conexión muestra señales a revisar"
                    : "Tu conexión se ve limpia"}
                </h2>
                <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
                  {risky
                    ? "Detectamos que tu IP está marcada como proxy/VPN, centro de datos o con reportes de abuso. Eso no siempre es malo (una VPN es legítima), pero muchos servicios la tratan con desconfianza."
                    : "Tu IP no aparece marcada como proxy/VPN, centro de datos ni con reportes de abuso. Es lo esperado en una conexión residencial normal."}
                </p>
              </div>
            </section>

            {/* Señales de reputación */}
            <section className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <SignalCard
                icon={<Network className="size-5" />}
                label="VPN / Proxy / Tor"
                value={rep.isProxy}
                goodWhenFalse
                yesText="Detectado"
                noText="No detectado"
              />
              <SignalCard
                icon={<Server className="size-5" />}
                label="Centro de datos / Hosting"
                value={rep.isHosting}
                goodWhenFalse
                yesText="Sí (no residencial)"
                noText="No (residencial)"
              />
              <SignalCard
                icon={<Smartphone className="size-5" />}
                label="Red móvil"
                value={rep.isMobile}
                yesText="Sí"
                noText="No"
              />
              <AbuseCard score={abuse} />
            </section>

            {/* ISP */}
            {rep.isp && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-400">
                Proveedor de internet detectado:{" "}
                <span className="text-zinc-200 font-medium">{rep.isp}</span>
              </div>
            )}
          </>
        )}

        {/* CTA a filtraciones */}
        <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-amber-500/10 to-transparent p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-white">
            ¿Y tus datos personales?
          </h3>
          <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
            Tu IP es solo una parte. Revisa si tu correo, teléfono o contraseñas
            aparecen en filtraciones de datos conocidas.
          </p>
          <Link
            href="/filtraciones"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 font-medium text-zinc-950 hover:bg-amber-400 transition"
          >
            <Search className="size-4" /> Revisar mis filtraciones
          </Link>
        </section>

        <p className="text-center text-xs text-zinc-600 leading-relaxed">
          Sabuezo registra la IP y ubicación aproximada de las visitas a esta
          página con fines de seguridad y estadística.
        </p>
      </div>
    </main>
  );
}

function SignalCard({
  icon,
  label,
  value,
  goodWhenFalse,
  yesText,
  noText,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean | null;
  goodWhenFalse?: boolean;
  yesText: string;
  noText: string;
}) {
  const unknown = value === null;
  // Con goodWhenFalse: "true" es la señal de alerta (amber); "false" es bueno (emerald).
  const alert = goodWhenFalse ? value === true : false;
  const tone = unknown
    ? "border-zinc-800 bg-zinc-900/30 text-zinc-400"
    : alert
    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
    : goodWhenFalse
    ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-200"
    : "border-zinc-800 bg-zinc-900/40 text-zinc-200";
  return (
    <div className={`rounded-xl border ${tone} p-5`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold">
        {unknown ? "Sin dato" : value ? yesText : noText}
      </div>
    </div>
  );
}

function AbuseCard({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 text-zinc-400">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
          <ShieldAlert className="size-5" />
          Reportes de abuso
        </div>
        <div className="mt-2 text-lg font-semibold">Sin dato</div>
      </div>
    );
  }
  const high = score >= 25;
  return (
    <div
      className={`rounded-xl border p-5 ${
        high
          ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
          : "border-emerald-500/25 bg-emerald-500/5 text-emerald-200"
      }`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-80">
        <ShieldAlert className="size-5" />
        Reportes de abuso (AbuseIPDB)
      </div>
      <div className="mt-2 text-lg font-semibold tabular-nums">
        {score}/100 {high ? "· riesgoso" : "· limpio"}
      </div>
    </div>
  );
}
