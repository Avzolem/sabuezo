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
  KeyRound,
  ShieldCheck,
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

type PasswordResult = {
  found: boolean;
  count: number;
};

type Mode = "email" | "phone" | "password";

// SHA-1 en el navegador (Web Crypto). La contraseña nunca sale del dispositivo.
async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

// Chequeo k-anonymity contra HaveIBeenPwned Pwned Passwords.
// Solo se envían los primeros 5 caracteres del hash; la comparación es local.
async function checkPasswordPwned(password: string): Promise<PasswordResult> {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  if (!res.ok) throw new Error("No pude consultar la base de contraseñas.");
  const text = await res.text();
  for (const line of text.split("\n")) {
    const [suf, count] = line.trim().split(":");
    if (suf === suffix) {
      return { found: true, count: parseInt(count, 10) || 0 };
    }
  }
  return { found: false, count: 0 };
}

export default function FiltracionesPage() {
  const [mode, setMode] = useState<Mode>("email");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailRes, setEmailRes] = useState<EmailResult | null>(null);
  const [phoneRes, setPhoneRes] = useState<PhoneResult | null>(null);
  const [passwordRes, setPasswordRes] = useState<PasswordResult | null>(null);

  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "";

  // Lee ?tipo=correo|numero|contraseña|... para arrancar en el tab correcto
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tipo = (params.get("tipo") || "").toLowerCase();
    if (tipo === "numero" || tipo === "número" || tipo === "phone" || tipo === "telefono" || tipo === "teléfono") {
      setMode("phone");
    } else if (tipo === "correo" || tipo === "email") {
      setMode("email");
    } else if (tipo === "password" || tipo === "contrasena" || tipo === "contraseña" || tipo === "clave") {
      setMode("password");
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setValue("");
    setError(null);
    setEmailRes(null);
    setPhoneRes(null);
    setPasswordRes(null);
  }

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setLoading(true);
    setError(null);
    setEmailRes(null);
    setPhoneRes(null);
    setPasswordRes(null);

    try {
      if (mode === "password") {
        // 100% en el navegador: la contraseña nunca se envía a ningún servidor.
        const r = await checkPasswordPwned(value);
        setPasswordRes(r);
      } else {
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
          ¿Tu correo, número o contraseña <span className="text-amber-400">está filtrado</span>?
        </h1>
        <p className="mt-4 text-zinc-400 max-w-2xl">
          Cruzo tu dato contra millones de filtraciones públicas (Yahoo, LinkedIn, Adobe,
          Instagram, fugas regionales en LATAM). Si aparece, te digo en cuántas y qué hacer
          para mitigar el daño.
        </p>

        {/* Tabs */}
        <div className="mt-8 flex flex-wrap gap-2 p-1 rounded-full border border-zinc-800 bg-zinc-900/40 w-fit">
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
          <button
            type="button"
            onClick={() => switchMode("password")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
              mode === "password"
                ? "bg-amber-500 text-black font-medium"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <KeyRound className="size-4" /> Contraseña
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCheck} className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            {mode === "password" ? (
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-zinc-500" />
            ) : (
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-zinc-500" />
            )}
            <input
              type={mode === "email" ? "email" : mode === "phone" ? "tel" : "password"}
              inputMode={mode === "email" ? "email" : mode === "phone" ? "tel" : "text"}
              autoComplete={mode === "email" ? "email" : mode === "phone" ? "tel" : "off"}
              placeholder={
                mode === "email"
                  ? "tu@correo.com"
                  : mode === "phone"
                    ? "55 1234 5678 (10 dígitos para MX)"
                    : "Escribe la contraseña a revisar"
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={loading}
              className="w-full rounded-full bg-zinc-900/60 border border-zinc-800 pl-12 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60 transition disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !value}
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

        {mode === "password" ? (
          <p className="mt-3 text-xs text-zinc-500 flex items-start gap-1.5">
            <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-px" />
            <span>
              Tu contraseña <strong className="text-zinc-300">nunca sale de tu dispositivo</strong>. Sabuezo
              la revisa de forma cifrada contra cientos de millones de contraseñas expuestas en filtraciones,
              sin guardarla ni verla.
            </span>
          </p>
        ) : (
          <p className="mt-3 text-xs text-zinc-500 flex items-start gap-1.5">
            <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-px" />
            <span>
              Sabuezo cruza tu dato contra cientos de millones de registros expuestos en filtraciones
              públicas de todo el mundo.
            </span>
          </p>
        )}

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
        {mode === "password" && passwordRes && <PasswordResultCard data={passwordRes} />}

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
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-white">
              <span className="font-mono text-emerald-300 break-all">{value}</span> no aparece en filtraciones públicas
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
          <div className="flex-1 min-w-0">
            <h3 className="text-xl sm:text-2xl font-semibold text-white">
              <span className="font-mono text-red-300 break-all">{value}</span> aparece en {data.count} filtración
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

// Traduce el conteo crudo de la base de filtraciones a qué tan "quemada" está.
function exposureLevel(count: number): { label: string; detail: string } {
  if (count >= 100_000)
    return {
      label: "De las más usadas del mundo",
      detail:
        "Está entre las contraseñas más comunes del planeta. Un atacante la prueba de primero — la adivinaría en segundos.",
    };
  if (count >= 10_000)
    return {
      label: "Muy común",
      detail: "Aparece en las primeras listas que se prueban en ataques automáticos.",
    };
  if (count >= 1_000)
    return {
      label: "Común",
      detail: "Sale con frecuencia en filtraciones; es una apuesta segura para un atacante.",
    };
  if (count >= 100)
    return {
      label: "Vista varias veces",
      detail: "Ya circula en bases de datos filtradas y se prueba en ataques.",
    };
  return {
    label: "Vista en filtraciones",
    detail: "Pocas apariciones, pero ya está expuesta. No la sigas usando.",
  };
}

function PasswordResultCard({ data }: { data: PasswordResult }) {
  if (!data.found) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-500/15 p-3">
            <ShieldCheck className="size-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">
              Esta contraseña no aparece en filtraciones conocidas
            </h3>
            <p className="mt-2 text-zinc-300 leading-relaxed">
              No la encontré entre los cientos de millones de contraseñas expuestas en filtraciones que
              vigilo. Buena señal — pero{" "}
              <strong className="text-white">que no esté filtrada no significa que sea fuerte</strong>.
            </p>
            <p className="mt-3 text-sm text-zinc-400">
              💡 Una buena contraseña es larga (12+ caracteres), única por sitio y, de preferencia, generada
              por un gestor de contraseñas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-red-500/20 p-3">
            <AlertTriangle className="size-6 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl sm:text-2xl font-semibold text-white">
              Esta contraseña apareció{" "}
              <span className="text-red-300">{data.count.toLocaleString("es-MX")}</span>{" "}
              {data.count === 1 ? "vez" : "veces"} en filtraciones
            </h3>
            <div className="mt-2 inline-flex items-center rounded-full bg-red-500/20 border border-red-500/30 px-3 py-1 text-xs font-medium text-red-200">
              {exposureLevel(data.count).label}
            </div>
            <p className="mt-3 text-zinc-300 leading-relaxed">
              {exposureLevel(data.count).detail} Si la usas en algún lado, considérala{" "}
              <strong className="text-white">comprometida</strong>.
            </p>
          </div>
        </div>
      </div>

      <ActionPlan
        items={[
          "Deja de usar esta contraseña en cualquier servicio donde la tengas.",
          "Cámbiala primero en tu correo y tu banca — son las cuentas más críticas.",
          "Usa una contraseña única por sitio; un gestor de contraseñas lo hace fácil.",
          "Activa autenticación de dos pasos (2FA) donde puedas.",
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
          <div className="min-w-0">
            <h3 className="text-xl font-semibold text-white">
              <span className="font-mono text-emerald-300 break-all">{value}</span> no aparece en filtraciones públicas
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
          <div className="flex-1 min-w-0">
            <h3 className="text-xl sm:text-2xl font-semibold text-white">
              <span className="font-mono text-red-300 break-all">{value}</span> aparece en {data.count} fuga
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
