"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  Lightbulb,
} from "lucide-react";

type EmailResult = {
  ok: boolean;
  found?: boolean;
  count?: number;
  breaches?: string[];
  error?: string;
};

type PhoneResult = {
  ok: boolean;
  found?: boolean;
  count?: number;
  sources?: { name: string; date: string }[];
  fields?: string[];
  error?: string;
};

type Mode = "email" | "phone";

export default function FiltracionesPage() {
  const [mode, setMode] = useState<Mode>("email");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailRes, setEmailRes] = useState<EmailResult | null>(null);
  const [phoneRes, setPhoneRes] = useState<PhoneResult | null>(null);

  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "";

  // Lee ?tipo=correo|numero|email|phone para arrancar en el tab correcto
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tipo = (params.get("tipo") || "").toLowerCase();
    if (tipo === "numero" || tipo === "número" || tipo === "phone" || tipo === "telefono" || tipo === "teléfono") {
      setMode("phone");
    } else if (tipo === "correo" || tipo === "email") {
      setMode("email");
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setValue("");
    setError(null);
    setEmailRes(null);
    setPhoneRes(null);
  }

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    setEmailRes(null);
    setPhoneRes(null);

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: mode, value: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error desconocido");
      } else if (mode === "email") {
        setEmailRes(data);
      } else {
        setPhoneRes(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      <header className="border-b border-zinc-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition"
          >
            <ArrowLeft className="size-4 text-zinc-500" />
            <Image src="/sabuezo-logo.webp" alt="Sabuezo" width={28} height={28} className="size-7" />
            <span className="font-semibold">Sabuezo</span>
          </Link>
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}?text=hola`}
              className="rounded-full bg-amber-500 hover:bg-amber-400 transition text-black px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap"
            >
              Empezar por WhatsApp
            </a>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
          ¿Tu correo o número <span className="text-amber-400">está filtrado</span>?
        </h1>
        <p className="mt-4 text-zinc-400 max-w-2xl">
          Cruzo tu dato contra millones de filtraciones públicas (Yahoo, LinkedIn, Adobe,
          Instagram, fugas regionales en LATAM). Si aparece, te digo en cuántas y qué hacer
          para mitigar el daño.
        </p>

        {/* Tabs */}
        <div className="mt-8 flex gap-2 p-1 rounded-full border border-zinc-800 bg-zinc-900/40 w-fit">
          <button
            type="button"
            onClick={() => switchMode("email")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
              mode === "email"
                ? "bg-amber-500 text-black font-medium"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Mail className="size-4" /> Correo
          </button>
          <button
            type="button"
            onClick={() => switchMode("phone")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
              mode === "phone"
                ? "bg-amber-500 text-black font-medium"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Phone className="size-4" /> Número celular
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCheck} className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-zinc-500" />
            <input
              type={mode === "email" ? "email" : "tel"}
              inputMode={mode === "email" ? "email" : "tel"}
              autoComplete={mode === "email" ? "email" : "tel"}
              placeholder={
                mode === "email" ? "tu@correo.com" : "55 1234 5678 (10 dígitos para MX)"
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={loading}
              className="w-full rounded-full bg-zinc-900/60 border border-zinc-800 pl-12 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 transition disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 transition text-black px-6 py-3 font-medium disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Buscando…
              </>
            ) : (
              <>Verificar</>
            )}
          </button>
        </form>

        <p className="mt-3 text-xs text-zinc-500">
          No guardamos tu correo ni número. Las consultas se hacen contra fuentes públicas
          (XposedOrNot, LeakCheck) y se descartan después de mostrarte el resultado.
        </p>

        {/* Resultado */}
        {error && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex items-start gap-3">
            <AlertCircle className="size-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-red-300 font-medium">No pude verificar</div>
              <div className="text-sm text-red-200/80 mt-1">{error}</div>
            </div>
          </div>
        )}

        {mode === "email" && emailRes && <EmailResultCard data={emailRes} value={value} />}
        {mode === "phone" && phoneRes && <PhoneResultCard data={phoneRes} value={value} />}

        {/* CTA bottom */}
        <div className="mt-12 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-6 sm:p-8">
          <h3 className="text-lg sm:text-xl font-semibold text-white">
            ¿Y si quieres que te avise cada vez que aparezcas en una nueva fuga?
          </h3>
          <p className="mt-2 text-zinc-300 leading-relaxed">
            Registra tu PyME por WhatsApp y Sabuezo monitorea tu correo, tu número y tu sitio en
            automático. Te avisamos en cuanto algo cambie.
          </p>
          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}?text=registrar`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 transition text-black px-5 py-2.5 text-sm font-medium"
            >
              Registrar mi PyME por WhatsApp
            </a>
          )}
        </div>
      </section>
    </main>
  );
}

function EmailResultCard({ data, value }: { data: EmailResult; value: string }) {
  if (!data.ok) {
    return (
      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="text-zinc-300">No pude consultar la fuente ahora mismo. Intenta en un momento.</div>
      </div>
    );
  }

  if (!data.found) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-500/15 p-3">
            <CheckCircle2 className="size-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">
              <span className="font-mono text-emerald-300">{value}</span> no aparece en filtraciones públicas
            </h3>
            <p className="mt-2 text-zinc-300 leading-relaxed">
              Buenas noticias. Esto no garantiza 100% — los criminales también usan listas
              privadas — pero si no estás en breaches públicos, recibes mucho menos phishing
              dirigido.
            </p>
            <p className="mt-3 text-sm text-zinc-400">
              💡 Aun así: mantén una contraseña única para este correo y activa 2FA donde puedas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const top = (data.breaches || []).slice(0, 12);
  const remaining = (data.count || 0) - top.length;

  return (
    <div className="mt-8 space-y-5">
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-red-500/20 p-3">
            <AlertTriangle className="size-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-semibold text-white">
              <span className="font-mono text-red-300">{value}</span> aparece en {data.count} filtración
              {data.count === 1 ? "" : "es"}
            </h3>
            <p className="mt-2 text-zinc-300 leading-relaxed">
              Tu correo se ha expuesto en bases de datos hackeadas. Eso explica el spam y
              phishing dirigido que probablemente recibes.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Aparece en estos breaches
        </h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {top.map((b) => (
            <span
              key={b}
              className="rounded-full bg-zinc-800/80 text-zinc-200 text-xs px-3 py-1.5 border border-zinc-700"
            >
              {b}
            </span>
          ))}
          {remaining > 0 && (
            <span className="rounded-full bg-zinc-800/40 text-zinc-400 text-xs px-3 py-1.5 border border-zinc-800">
              +{remaining} más
            </span>
          )}
        </div>
      </div>

      <ActionPlan
        items={[
          "Cambia la contraseña de este correo y de cualquier servicio donde uses la misma.",
          "Activa autenticación de dos pasos (2FA) en este correo.",
          "Espera más phishing dirigido — los criminales ya tienen tu dirección.",
          "Si recibes 'factura de proveedor' desde un correo parecido al tuyo, asume estafa.",
        ]}
      />
    </div>
  );
}

function PhoneResultCard({ data, value }: { data: PhoneResult; value: string }) {
  if (!data.ok) {
    if (data.error === "rate_limited") {
      return (
        <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
          <div className="text-amber-200">
            Demasiadas consultas a la base de filtraciones. Inténtalo en 1-2 minutos.
          </div>
        </div>
      );
    }
    return (
      <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="text-zinc-300">No pude consultar la fuente ahora mismo. Intenta en un momento.</div>
      </div>
    );
  }

  if (!data.found) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-500/15 p-3">
            <CheckCircle2 className="size-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">
              <span className="font-mono text-emerald-300">{value}</span> no aparece en filtraciones públicas
            </h3>
            <p className="mt-2 text-zinc-300 leading-relaxed">
              Tu número no está en las bases de datos públicas que consultamos. Mantente
              atento a llamadas y SMS desconocidos: si alguien se hace pasar por tu banco o
              agencia tributaria (SAT, AFIP, SUNAT, DIAN, SRI), cuelga y márcale tú al número
              oficial.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const top = (data.sources || []).slice(0, 12);
  const remaining = (data.count || 0) - top.length;
  const fields = (data.fields || []).slice(0, 12);

  return (
    <div className="mt-8 space-y-5">
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-red-500/20 p-3">
            <AlertTriangle className="size-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl sm:text-2xl font-semibold text-white">
              <span className="font-mono text-red-300">{value}</span> aparece en {data.count} fuga
              {data.count === 1 ? "" : "s"} de datos
            </h3>
            <p className="mt-2 text-zinc-300 leading-relaxed">
              Asume que llamadas y SMS pueden ser estafa dirigida — los criminales tienen tu
              número y posiblemente más datos asociados.
            </p>
          </div>
        </div>
      </div>

      {top.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Fuentes (las principales)
          </h4>
          <ul className="mt-3 space-y-2">
            {top.map((s, idx) => (
              <li key={`${s.name}-${idx}`} className="flex items-center justify-between text-sm">
                <span className="text-zinc-200">{s.name}</span>
                {s.date && <span className="text-zinc-500 font-mono text-xs">{s.date}</span>}
              </li>
            ))}
            {remaining > 0 && (
              <li className="text-sm text-zinc-500 pt-2 border-t border-zinc-800">
                …y {remaining} fuentes más
              </li>
            )}
          </ul>
        </div>
      )}

      {fields.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Datos expuestos junto a tu número
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {fields.map((f) => (
              <span
                key={f}
                className="rounded-full bg-zinc-800/80 text-zinc-200 text-xs px-3 py-1.5 border border-zinc-700"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <ActionPlan
        items={[
          "Asume que cualquier llamada o SMS de 'tu banco' o 'tu agencia tributaria' (SAT, AFIP, SUNAT, DIAN, SRI) puede ser estafa.",
          "Nunca des códigos de WhatsApp o SMS por teléfono. Nunca.",
          "Activa 2FA en tu correo y banca, de preferencia con app (no SMS).",
          "Si recibes mensajes de 'secuestro virtual', cuelga y verifica directamente.",
        ]}
      />
    </div>
  );
}

function ActionPlan({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-amber-500/20 p-2.5">
          <Lightbulb className="size-5 text-amber-300" />
        </div>
        <div className="flex-1">
          <h4 className="text-base sm:text-lg font-semibold text-white">Plan de acción</h4>
          <ol className="mt-3 space-y-2 text-zinc-200 text-sm leading-relaxed">
            {items.map((it, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-amber-400 font-medium shrink-0">{i + 1}.</span>
                <span>{it}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
