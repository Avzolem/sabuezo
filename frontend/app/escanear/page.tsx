"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Loader2,
  Shield,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Download,
  FileDown,
} from "lucide-react";
import type { Finding } from "@/lib/supabase";
import {
  scoreColor,
  scoreBg,
  scoreLabel,
  severityLabel,
  severityStyle,
} from "@/lib/utils";

type ScanResult = {
  url: string;
  domain: string;
  score: number;
  summary: string;
  findings: Finding[];
  raw?: {
    email_auth?: { spf_present?: boolean; dmarc_present?: boolean };
  };
};

export default function EscanearPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [phase, setPhase] = useState<string>("");

  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "";

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    // Mensajes de progreso (cosméticos, real scan toma 15-40s)
    const phases = [
      "Resolviendo dominio...",
      "Probando certificado SSL...",
      "Analizando headers HTTP...",
      "Consultando registros SPF/DKIM/DMARC...",
      "Detectando CMS...",
      "Buscando archivos expuestos...",
      "Calculando score...",
    ];
    let i = 0;
    setPhase(phases[0]);
    const interval = setInterval(() => {
      i = Math.min(i + 1, phases.length - 1);
      setPhase(phases[i]);
    }, 4000);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        // Un poco más que el AbortController del proxy (60s) para no cortar antes.
        signal: AbortSignal.timeout(65000),
      });
      // Parseo defensivo: si Vercel corta la función, el cuerpo es HTML, no JSON.
      const text = await res.text();
      let data: { error?: string } & Record<string, unknown> = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        setError(
          data.error ||
            "El servicio no está disponible en este momento. Intenta de nuevo en unos segundos."
        );
      } else {
        setResult(data as unknown as ScanResult);
      }
    } catch (err) {
      // No exponer mensajes crudos (fetch failed / aborted): mapear a algo claro.
      if (err instanceof DOMException && err.name === "TimeoutError") {
        setError(
          "El escaneo tardó demasiado y el servidor está ocupado. Intenta de nuevo."
        );
      } else {
        setError(
          "No pudimos conectar con el motor de análisis. Reintenta en un minuto."
        );
      }
    } finally {
      clearInterval(interval);
      setLoading(false);
      setPhase("");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      <header className="border-b border-zinc-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition">
            <ArrowLeft className="size-4 text-zinc-500" />
            <Image src="/sabuezo-logo.webp" alt="Sabuezo" width={28} height={28} className="size-7" />
            <span className="font-semibold">Sabuezo</span>
          </Link>
          <div className="text-xs text-zinc-500">Diagnóstico gratuito</div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 pt-10 sm:pt-16 pb-10">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 mb-5 sm:mb-6">
            <Shield className="size-3" /> 100% gratis · sin registro
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-semibold tracking-tighter text-white leading-[1.05]">
            ¿Qué tan <span className="text-amber-400">expuesto</span> está tu sitio?
          </h1>
          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-zinc-400 leading-relaxed">
            Diagnóstico de seguridad en 30 segundos. Sin instalar nada, sin tarjeta,
            sin login. Solo pega la URL.
          </p>
        </div>

        <form
          onSubmit={handleScan}
          className="mt-12 max-w-2xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-900/40 p-2 flex flex-col md:flex-row items-stretch gap-2"
        >
          <div className="flex-1 flex items-center gap-3 px-4">
            <Search className="size-5 text-zinc-500 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="misitio.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="bg-transparent outline-none flex-1 text-white placeholder-zinc-600 text-lg py-3"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed transition text-black px-6 py-3 font-medium inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Escaneando...
              </>
            ) : (
              <>
                Escanear gratis
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>

        {loading && (
          <div className="mt-6 max-w-2xl mx-auto text-center">
            <div className="text-sm text-zinc-400">
              <span className="text-amber-300">●</span> {phase}
            </div>
            <div className="mt-2 text-xs text-zinc-600">Esto suele tomar 15-40 segundos.</div>
          </div>
        )}

        {error && (
          <div className="mt-6 max-w-2xl mx-auto rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}
      </section>

      {/* RESULTADOS */}
      {result && <ResultsSection result={result} waNumber={waNumber} />}

      {/* Bottom CTA si no hay resultados aún */}
      {!result && !loading && (
        <section className="mx-auto max-w-5xl px-6 py-16 grid md:grid-cols-3 gap-4">
          <InfoCard
            title="SSL + Headers"
            desc="Verificamos tu certificado, HSTS, CSP, X-Frame y más."
          />
          <InfoCard
            title="SPF / DKIM / DMARC"
            desc="Detectamos si pueden suplantar correos de tu dominio."
          />
          <InfoCard
            title="Archivos expuestos"
            desc=".env, .git, /admin, backups públicos. Lo encontramos."
          />
        </section>
      )}
    </main>
  );
}

function InfoCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
      <div className="text-amber-300 text-sm font-medium uppercase tracking-wider">{title}</div>
      <div className="mt-2 text-zinc-300 leading-relaxed">{desc}</div>
    </div>
  );
}

const SEV_ORDER: Finding["severity"][] = ["critical", "high", "medium", "low", "info"];
const SEV_GROUP_LABEL: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
  info: "Informativo",
};

function ResultsSection({ result, waNumber }: { result: ScanResult; waNumber: string }) {
  const findings = result.findings || [];
  const grouped = SEV_ORDER
    .map((sev) => ({ sev, items: findings.filter((f) => f.severity === sev) }))
    .filter((g) => g.items.length > 0);
  const spfMissing = result.raw?.email_auth?.spf_present === false;
  const dmarcMissing = result.raw?.email_auth?.dmarc_present === false;

  return (
    <section className="mx-auto max-w-5xl px-6 pb-20 space-y-6">
      {/* Score card */}
      <div className={`rounded-2xl border ${scoreBg(result.score)} p-8 flex flex-col gap-6`}>
        <div className="flex items-center gap-6 flex-wrap">
          <div className={`text-7xl font-semibold tabular-nums ${scoreColor(result.score)}`}>
            {result.score}
          </div>
          <div className="flex-1 min-w-0 sm:min-w-[200px]">
            <div className="text-xs uppercase tracking-wider text-zinc-400 break-all">
              {result.domain}
            </div>
            <div className={`text-2xl font-semibold mt-1 ${scoreColor(result.score)}`}>
              {scoreLabel(result.score)}
            </div>
            <div className="mt-1 text-zinc-300">{result.summary}</div>
          </div>
        </div>
        <div className="flex justify-center">
          <DownloadReportButton result={result} />
        </div>
      </div>

      {/* Cross-cutting insight */}
      {(spfMissing || dmarcMissing) && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-amber-500/20 p-3 shrink-0">
              <Lightbulb className="size-6 text-amber-300" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-300 font-medium mb-1">
                Insight crítico
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-white">
                Cualquiera puede impersonar tu correo
              </h3>
              <p className="mt-3 text-zinc-300 leading-relaxed">
                {spfMissing && "Te falta SPF. "}
                {dmarcMissing && "Te falta DMARC. "}
                Eso significa que un atacante puede mandar correos pretendiendo ser
                de <code className="text-amber-300">{result.domain}</code> a tus clientes y empleados.
                Lo arreglas con 2 registros TXT en tu DNS.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Findings agrupados por severidad */}
      {findings.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-300 flex items-center gap-3">
          <CheckCircle2 className="size-5" />
          <span>Sin hallazgos. Tu sitio está bien protegido.</span>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-white">Hallazgos completos ({findings.length})</h2>
          {grouped.map((g) => (
            <div key={g.sev} className="space-y-3">
              <div className="flex items-baseline gap-3 pb-2 border-b border-zinc-800">
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${severityStyle[g.sev]}`}>
                  {SEV_GROUP_LABEL[g.sev]}
                </span>
                <span className="text-xs text-zinc-500">
                  {g.items.length} {g.items.length === 1 ? "hallazgo" : "hallazgos"}
                </span>
              </div>
              {g.items.map((f) => (
                <FindingCard key={f.id} f={f} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 md:p-10 text-center">
        <h3 className="text-2xl font-semibold text-white">¿Quieres protección continua?</h3>
        <p className="mt-3 text-zinc-400 max-w-2xl mx-auto">
          Guarda el número de Sabuezo en tu WhatsApp. Reenvíale mensajes sospechosos,
          screenshots, correos de proveedor — te dice si es estafa al instante. Para
          PyMEs de Latinoamérica, gratis.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={waNumber ? `https://wa.me/${waNumber}?text=hola` : "#"}
            className="inline-flex items-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 transition text-black px-6 py-3 font-medium"
          >
            Empezar por WhatsApp
            <ArrowRight className="size-4" />
          </a>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 hover:border-zinc-500 transition px-6 py-3 text-zinc-200"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </section>
  );
}

function DownloadReportButton({ result }: { result: ScanResult }) {
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    try {
      // Lazy load (ahorra ~200KB del bundle inicial)
      const [{ pdf }, { ReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/ReportPDF"),
      ]);
      const blob = await pdf(<ReportPDF scan={result} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sabuezo-${result.domain}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF error:", err);
      alert("No pude generar el PDF. Intenta de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={generating}
      className="inline-flex items-center gap-2 rounded-xl bg-black hover:bg-zinc-900 disabled:bg-zinc-800 disabled:cursor-not-allowed transition text-amber-400 hover:text-amber-300 border border-amber-500/30 px-5 py-3 font-medium text-sm whitespace-nowrap"
    >
      {generating ? (
        <>
          <Loader2 className="size-4 animate-spin text-amber-400" /> Generando PDF...
        </>
      ) : (
        <>
          <FileDown className="size-4 text-amber-400" /> Descargar reporte en PDF
        </>
      )}
    </button>
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
        <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words font-mono">{f.fix}</pre>
      </div>
    </div>
  );
}
