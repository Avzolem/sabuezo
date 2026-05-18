import { supabase, type Pyme, type Scan, type PhishingDetection, type Finding } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Mail,
  Shield,
  Clock,
  Lightbulb,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  scoreColor,
  scoreBg,
  scoreLabel,
  severityLabel,
  severityStyle,
  riskStyle,
  timeAgo,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function loadData(id: string) {
  const { data: pyme } = await supabase
    .from("pymes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!pyme) return null;

  const { data: scan } = await supabase
    .from("scans")
    .select("*")
    .eq("pyme_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: detections } = await supabase
    .from("phishing_detections")
    .select("*")
    .eq("pyme_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    pyme: pyme as Pyme,
    scan: scan as Scan | null,
    detections: (detections ?? []) as PhishingDetection[],
  };
}

export default async function PymePage({ params }: Props) {
  const { id } = await params;
  const data = await loadData(id);
  if (!data) notFound();

  const { pyme, scan, detections } = data;
  const score = scan?.score ?? pyme.last_score ?? 0;
  const findings = (scan?.findings ?? []) as Finding[];
  const critical = findings.filter((f) => f.severity === "critical");
  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");
  const topFindings = [...critical, ...high, ...medium].slice(0, 6);

  const reds = detections.filter((d) => d.risk === "rojo");
  const yellows = detections.filter((d) => d.risk === "amarillo");

  // Cross-cutting insight
  const raw = (scan?.raw ?? {}) as Record<string, unknown>;
  const emailAuth = (raw?.email_auth ?? {}) as Record<string, unknown>;
  const spfMissing = emailAuth?.spf_present === false;
  const dmarcMissing = emailAuth?.dmarc_present === false;

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      <header className="border-b border-zinc-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition">
            <ArrowLeft className="size-4 text-zinc-500" />
            <Image src="/sabuezo-logo.webp" alt="Sabuezo" width={28} height={28} className="size-7" />
            <span className="font-semibold">Sabuezo</span>
          </Link>
          <div className="text-xs text-zinc-500">Dashboard PyME</div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10 space-y-6 sm:space-y-8">
        {/* Encabezado de la PyME */}
        <section>
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">PyME protegida</div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white">{pyme.name}</h1>
          <div className="mt-2 text-sm sm:text-base text-zinc-400 flex items-center gap-3 sm:gap-4 flex-wrap">
            <span>{pyme.website}</span>
            {pyme.owner_email && (
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" /> {pyme.owner_email}
              </span>
            )}
            <span className="text-zinc-600">·</span>
            <span className="text-xs">Registrada {timeAgo(pyme.created_at)}</span>
          </div>
        </section>

        {/* Top row: score + counts */}
        <section className="grid sm:grid-cols-3 gap-3 sm:gap-4">
          <ScoreCard score={score} scannedAt={scan?.created_at} />
          <StatCard
            label="Estafas detectadas"
            value={reds.length}
            sub={`${detections.length} mensajes analizados`}
            tone="rose"
            icon={<XCircle className="size-5" />}
          />
          <StatCard
            label="Sospechosos"
            value={yellows.length}
            sub="Mensajes con señales"
            tone="amber"
            icon={<AlertTriangle className="size-5" />}
          />
        </section>

        {/* Cross-cutting insight */}
        {(spfMissing || dmarcMissing) && (
          <section className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-amber-500/20 p-3 shrink-0">
                <Lightbulb className="size-6 text-amber-300" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-amber-300 font-medium mb-1">
                  Insight cross-cutting
                </div>
                <h3 className="text-xl md:text-2xl font-semibold text-white">
                  Tu dominio no protege tu correo
                </h3>
                <p className="mt-3 text-zinc-300 leading-relaxed">
                  {spfMissing && "Te falta SPF. "}
                  {dmarcMissing && "Te falta DMARC. "}
                  Esto significa que <span className="text-amber-300 font-medium">cualquiera puede enviar correos haciéndose pasar por tu empresa</span> —
                  y por eso tu equipo recibe tanto phishing falsificando tus direcciones.
                  Lo arreglas en 15 minutos con 2 registros TXT en tu DNS.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Findings + Detections */}
        <section className="grid lg:grid-cols-5 gap-6">
          {/* Findings del scan */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold text-white">Diagnóstico del sitio</h2>
              {scan && (
                <span className="text-xs text-zinc-500">
                  Escaneado {timeAgo(scan.created_at)}
                </span>
              )}
            </div>
            {!scan && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-400">
                Aún no se ha hecho el primer scan. Pide al dueño que escriba{" "}
                <code className="text-amber-300">registrar</code> al bot.
              </div>
            )}
            {scan && topFindings.length === 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-300 flex items-center gap-3">
                <CheckCircle2 className="size-5" />
                Sin hallazgos importantes. Bien hecho.
              </div>
            )}
            <div className="space-y-3">
              {topFindings.map((f) => (
                <FindingCard key={f.id} f={f} />
              ))}
            </div>
            {findings.length > topFindings.length && (
              <div className="text-sm text-zinc-500">
                + {findings.length - topFindings.length} hallazgos más en el reporte completo.
              </div>
            )}
          </div>

          {/* Phishing recientes */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-white">Phishing reciente</h2>
            {detections.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-400">
                Aún no hay análisis. Reenvía cualquier mensaje sospechoso al bot.
              </div>
            ) : (
              <div className="space-y-3">
                {detections.slice(0, 8).map((d) => (
                  <DetectionCard key={d.id} d={d} />
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="pt-8 pb-12 text-center text-sm text-zinc-500 border-t border-zinc-900 flex items-center justify-center gap-2">
          <Image src="/sabuezo-logo.webp" alt="" width={20} height={20} className="size-5 opacity-70" />
          <span>Sabuezo · Esta vista es pública. Cualquiera con el link puede verla.</span>
        </footer>
      </div>
    </main>
  );
}

function ScoreCard({ score, scannedAt }: { score: number; scannedAt?: string }) {
  return (
    <div className={`rounded-2xl border ${scoreBg(score)} p-5 sm:p-6 flex items-center gap-4 sm:gap-5`}>
      <div className={`text-5xl sm:text-6xl font-semibold tabular-nums ${scoreColor(score)}`}>{score}</div>
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-400">Score de seguridad</div>
        <div className={`text-lg font-medium mt-0.5 ${scoreColor(score)}`}>{scoreLabel(score)}</div>
        {scannedAt && (
          <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
            <Clock className="size-3" /> {timeAgo(scannedAt)}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "rose" | "amber" | "emerald";
  icon: React.ReactNode;
}) {
  const palette = {
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  }[tone];
  return (
    <div className={`rounded-2xl border ${palette} p-6`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
          <div className="text-4xl font-semibold tabular-nums mt-2 text-white">{value}</div>
          <div className="text-xs opacity-70 mt-1">{sub}</div>
        </div>
        <div className="opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-white leading-tight">{f.title}</h3>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${severityStyle[f.severity]}`}>
          {severityLabel[f.severity] ?? f.severity}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{f.description}</p>
      <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
        <div className="text-[11px] uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1">
          <Shield className="size-3" />
          Cómo arreglarlo · {f.fix_time_min} min
        </div>
        <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">{f.fix}</pre>
      </div>
    </div>
  );
}

function DetectionCard({ d }: { d: PhishingDetection }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${riskStyle[d.risk]}`}>
          {d.risk}
        </span>
        <span className="text-[11px] text-zinc-500">{timeAgo(d.created_at)}</span>
      </div>
      {d.category && <div className="mt-2 text-sm font-medium text-white">{d.category}</div>}
      {d.raw_content && (
        <div className="mt-1.5 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
          &ldquo;{d.raw_content}&rdquo;
        </div>
      )}
    </div>
  );
}
