import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Globe,
  MessageCircleWarning,
  Database,
  Users,
  Mail,
  Phone,
  AlertTriangle,
  Lock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Métricas — Sabuezo",
  description: "Panel interno de métricas del servicio Sabuezo.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// ── Gate de contraseña ──
// La contraseña vive en METRICAS_PASSWORD (env), nunca en el repo.
// La cookie guarda un token derivado: sin la contraseña no se puede forjar.
const AUTH_COOKIE = "metricas_ok";

function authToken(): string {
  const pass = process.env.METRICAS_PASSWORD || "";
  return createHash("sha256").update(`sabuezo-metricas::${pass}`).digest("hex");
}

async function isAuthed(): Promise<boolean> {
  if (!process.env.METRICAS_PASSWORD) return true; // sin pass configurada → abierto
  const c = await cookies();
  return c.get(AUTH_COOKIE)?.value === authToken();
}

async function login(formData: FormData) {
  "use server";
  const pass = String(formData.get("password") || "");
  if (pass && pass === (process.env.METRICAS_PASSWORD || "")) {
    const c = await cookies();
    c.set(AUTH_COOKIE, authToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/metricas",
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });
    redirect("/metricas");
  }
  redirect("/metricas?error=1");
}

type Metrics = {
  summary: {
    pymes: number;
    sitios_escaneados: number;
    mensajes_analizados: number;
    chequeos_filtraciones: number;
    usuarios_unicos_bot: number;
  };
  filtraciones_por_tipo: {
    email: TipoStat;
    phone: TipoStat;
  };
  top_dominios_email: { dominio: string; consultas: number }[];
  telefonos_por_pais: { cod_pais: string; consultas: number }[];
  serie_diaria: { dia: string; web: number; bot: number }[];
  sitios_top: { sitio: string; escaneos: number; score_promedio: number | null }[];
};

type TipoStat = {
  consultas: number;
  filtrados: number;
  pct_filtrados: number;
  prom_filtraciones: number;
};

async function getMetrics(): Promise<Metrics | null> {
  const url = process.env.INTERNAL_API_URL;
  const token = process.env.INTERNAL_API_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/metrics`, {
      headers: { "x-internal-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Metrics;
  } catch {
    return null;
  }
}

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await isAuthed())) {
    const sp = await searchParams;
    return <LoginGate error={sp.error === "1"} />;
  }

  const m = await getMetrics();

  return (
    <main className="min-h-screen bg-[var(--color-background)] grain">
      <header className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Image src="/sabuezo-logo.webp" alt="Sabuezo" width={36} height={36} className="size-9" priority />
          <span>Sabuezo</span>
        </Link>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition">
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/5 px-3 py-1 text-xs text-amber-300/90">
          <BarChart3 className="size-3.5" />
          Panel interno
        </div>
        <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">Métricas del servicio</h1>
        <p className="mt-3 text-zinc-400 leading-relaxed max-w-2xl">
          Números en vivo de Sabuezo: PyMEs, escaneos, mensajes analizados y chequeos de filtraciones. Datos
          agregados — sin información personal individual.
        </p>

        {!m ? (
          <div className="mt-10 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-amber-200/90 font-medium">No pude cargar las métricas ahora mismo.</p>
              <p className="mt-1 text-zinc-400">
                El backend no respondió (puede estar reiniciándose o sin conexión). Recarga en un momento.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi icon={Building2} label="PyMEs registradas" value={m.summary.pymes} />
              <Kpi icon={Globe} label="Sitios escaneados" value={m.summary.sitios_escaneados} accent />
              <Kpi icon={MessageCircleWarning} label="Mensajes analizados" value={m.summary.mensajes_analizados} />
              <Kpi icon={Database} label="Chequeos filtraciones" value={m.summary.chequeos_filtraciones} />
              <Kpi icon={Users} label="Usuarios únicos (bot)" value={m.summary.usuarios_unicos_bot} />
            </div>

            {/* Filtraciones por tipo */}
            <h2 className="mt-14 text-xl font-semibold tracking-tight">Filtraciones consultadas</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <BreachCard icon={Mail} title="Correos" stat={m.filtraciones_por_tipo.email} />
              <BreachCard icon={Phone} title="Teléfonos" stat={m.filtraciones_por_tipo.phone} />
            </div>

            {/* Serie diaria */}
            <h2 className="mt-14 text-xl font-semibold tracking-tight">Consultas por día</h2>
            <SerieDiaria data={m.serie_diaria} />

            {/* Tablas lado a lado */}
            <div className="mt-14 grid lg:grid-cols-2 gap-8">
              <RankTable
                title="Dominios de correo más consultados"
                head={["Dominio", "Consultas"]}
                rows={m.top_dominios_email.map((d) => [d.dominio, d.consultas])}
                empty="Aún no hay correos consultados."
              />
              <RankTable
                title="Teléfonos por código de país"
                head={["País", "Consultas"]}
                rows={m.telefonos_por_pais.map((d) => [`+${d.cod_pais}`, d.consultas])}
                empty="Aún no hay teléfonos consultados."
              />
            </div>

            {/* Sitios top */}
            <h2 className="mt-14 text-xl font-semibold tracking-tight">Sitios más escaneados</h2>
            <RankTable
              className="mt-4"
              head={["Sitio", "Escaneos", "Score prom."]}
              rows={m.sitios_top.map((s) => [
                s.sitio,
                s.escaneos,
                s.score_promedio ?? "—",
              ])}
              empty="Aún no hay escaneos."
            />
          </>
        )}
      </section>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Image src="/sabuezo-logo.webp" alt="Sabuezo" width={24} height={24} className="size-6" />
            <span>
              Sabuezo · Hecho con cariño por{" "}
              <a
                href="https://avsolem.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 hover:text-amber-400 transition underline underline-offset-4 decoration-zinc-700 hover:decoration-amber-400/60"
              >
                Andrés Aguilar
              </a>{" "}
              en LATAM 🌎
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/terminos" className="hover:text-zinc-300 transition">Términos</Link>
            <Link href="/privacidad" className="hover:text-zinc-300 transition">Privacidad</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
      <Icon className={`size-5 ${accent ? "text-amber-400" : "text-zinc-500"}`} />
      <div className={`mt-3 text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums ${accent ? "text-amber-400" : "text-white"}`}>
        {value.toLocaleString("es-MX")}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500 leading-tight">{label}</div>
    </div>
  );
}

function BreachCard({ icon: Icon, title, stat }: { icon: React.ElementType; title: string; stat: TipoStat }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
      <div className="flex items-center gap-2 text-zinc-300">
        <Icon className="size-4 text-amber-400" />
        <span className="font-medium">{title}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Mini label="consultas" value={stat.consultas.toLocaleString("es-MX")} />
        <Mini label="filtrados" value={stat.filtrados.toLocaleString("es-MX")} />
        <Mini label="% filtrados" value={`${stat.pct_filtrados}%`} accent />
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        Promedio de {stat.prom_filtraciones} filtraciones por consulta encontrada.
      </p>
    </div>
  );
}

function LoginGate({ error }: { error: boolean }) {
  return (
    <main className="min-h-screen bg-[var(--color-background)] grain flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 text-lg font-semibold tracking-tight mb-8">
          <Image src="/sabuezo-logo.webp" alt="Sabuezo" width={36} height={36} className="size-9" priority />
          <span>Sabuezo</span>
        </Link>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
          <div className="flex items-center gap-2 text-amber-300/90">
            <Lock className="size-4" />
            <span className="text-sm font-medium">Panel protegido</span>
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">Métricas internas</h1>
          <p className="mt-1 text-sm text-zinc-400">Ingresa la contraseña para continuar.</p>

          <form action={login} className="mt-5 space-y-3">
            <input
              type="password"
              name="password"
              autoFocus
              autoComplete="current-password"
              placeholder="Contraseña"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-500/50 transition"
            />
            {error && (
              <p className="text-sm text-red-400">Contraseña incorrecta. Inténtalo de nuevo.</p>
            )}
            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 transition text-black px-4 py-2.5 text-sm font-medium"
            >
              Entrar
            </button>
          </form>
        </div>
        <Link href="/" className="mt-6 flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition">
          <ArrowLeft className="size-4" />
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-xl font-semibold tabular-nums ${accent ? "text-amber-400" : "text-white"}`}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}

function SerieDiaria({ data }: { data: { dia: string; web: number; bot: number }[] }) {
  if (!data.length) {
    return <p className="mt-4 text-sm text-zinc-500">Aún no hay consultas registradas.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.web + d.bot));
  const ordered = [...data].reverse(); // cronológico ascendente
  return (
    <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
      <div className="flex items-center gap-4 text-xs text-zinc-400 mb-4">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-400" /> Web</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sky-400" /> Bot</span>
      </div>
      <div className="space-y-2">
        {ordered.map((d) => {
          const total = d.web + d.bot;
          return (
            <div key={d.dia} className="flex items-center gap-3 text-xs">
              <span className="w-20 shrink-0 text-zinc-500 tabular-nums">{d.dia.slice(5)}</span>
              <div className="flex-1 flex h-5 rounded overflow-hidden bg-zinc-900">
                <div className="bg-amber-400/80" style={{ width: `${(d.web / max) * 100}%` }} />
                <div className="bg-sky-400/80" style={{ width: `${(d.bot / max) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-zinc-400 tabular-nums">{total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankTable({
  title,
  head,
  rows,
  empty,
  className = "",
}: {
  title?: string;
  head: string[];
  rows: (string | number)[][];
  empty: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {title && <h3 className="text-sm font-semibold text-zinc-300 mb-3">{title}</h3>}
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                {head.map((h, i) => (
                  <th key={h} className={`px-4 py-2.5 font-medium ${i > 0 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/40 transition">
                  {r.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-4 py-2.5 tabular-nums ${ci === 0 ? "text-zinc-200 truncate max-w-[220px]" : "text-right text-zinc-400"}`}
                    >
                      {typeof cell === "number" ? cell.toLocaleString("es-MX") : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
