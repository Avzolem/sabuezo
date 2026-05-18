"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { LATAM_PATHS } from "@/lib/latam-map";
import {
  ChevronLeft,
  ChevronRight,
  MessageCircleWarning,
  Globe,
  Database,
  Shield,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const TOTAL_SLIDES = 8;

export default function PitchPage() {
  const [i, setI] = useState(0);

  const next = useCallback(() => setI((p) => Math.min(p + 1, TOTAL_SLIDES - 1)), []);
  const prev = useCallback(() => setI((p) => Math.max(p - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (/^[0-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= TOTAL_SLIDES) setI(n - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return (
    <main className="min-h-screen bg-[var(--color-background)] grain relative overflow-hidden">
      {/* Slide stage */}
      <div className="relative min-h-screen flex items-center justify-center px-4 sm:px-10">
        {i === 0 && <Slide0 />}
        {i === 1 && <Slide1 />}
        {i === 2 && <Slide2 />}
        {i === 3 && <Slide3 />}
        {i === 4 && <Slide4 />}
        {i === 5 && <Slide5 />}
        {i === 6 && <Slide6 />}
        {i === 7 && <Slide7 />}
      </div>

      {/* Click areas para navegar */}
      <button
        type="button"
        aria-label="Anterior"
        onClick={prev}
        className="absolute left-0 top-0 bottom-0 w-1/4 cursor-pointer focus:outline-none"
      />
      <button
        type="button"
        aria-label="Siguiente"
        onClick={next}
        className="absolute right-0 top-0 bottom-0 w-1/4 cursor-pointer focus:outline-none"
      />

      {/* HUD inferior */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
        <button
          onClick={prev}
          disabled={i === 0}
          className="rounded-full border border-zinc-800 bg-zinc-900/60 backdrop-blur hover:bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed p-2 transition"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-8 bg-amber-400" : "w-1.5 bg-zinc-700 hover:bg-zinc-500"
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={i === TOTAL_SLIDES - 1}
          className="rounded-full border border-zinc-800 bg-zinc-900/60 backdrop-blur hover:bg-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed p-2 transition"
        >
          <ChevronRight className="size-4" />
        </button>

        <span className="text-xs text-zinc-500 tabular-nums ml-2">
          {String(i + 1).padStart(2, "0")} / {String(TOTAL_SLIDES).padStart(2, "0")}
        </span>
      </div>

      {/* Logo discreto + back */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
        <Image src="/sabuezo-logo.webp" alt="Sabuezo" width={28} height={28} className="size-7" />
        <span className="text-sm font-medium text-zinc-400">Sabuezo</span>
      </div>
      <Link
        href="/"
        className="absolute top-6 right-6 z-10 text-xs text-zinc-500 hover:text-zinc-300 transition"
      >
        Salir del pitch ↗
      </Link>
    </main>
  );
}

// ────────────────────────── SLIDES ──────────────────────────

function SlideShell({ children, accent = "amber" }: { children: React.ReactNode; accent?: "amber" | "emerald" }) {
  const gradient =
    accent === "emerald"
      ? "radial-gradient(60% 50% at 50% 0%, rgba(16,185,129,0.18) 0%, transparent 70%)"
      : "radial-gradient(60% 50% at 50% 0%, rgba(245,158,11,0.18) 0%, transparent 70%)";
  return (
    <div className="relative w-full max-w-6xl mx-auto">
      <div aria-hidden className="absolute inset-0 -z-10 opacity-50" style={{ background: gradient }} />
      {children}
    </div>
  );
}

// 1 — HOOK
function Slide0() {
  return (
    <SlideShell>
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs sm:text-sm text-red-300 mb-10">
          <span className="size-2 rounded-full bg-red-400 animate-pulse" /> Realidad LATAM 2026
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-semibold tracking-tighter text-white leading-[1.05]">
          El <span className="text-amber-400">60%</span> de las PyMEs
          <br />
          sufrirá un ciberataque
          <br />
          este año.
        </h1>
        <p className="mt-10 text-xl sm:text-2xl md:text-3xl text-zinc-400 max-w-3xl mx-auto leading-snug">
          Y el <span className="text-white font-semibold">50%</span> de las que sufren uno,{" "}
          <span className="text-red-300">quiebra en 6 meses</span>.
        </p>
        <p className="mt-12 text-xs sm:text-sm text-zinc-600 uppercase tracking-[0.2em]">
          Fuentes: Cisco · ESET · Kaspersky LATAM
        </p>
      </div>
    </SlideShell>
  );
}

// 2 — CONTEXTO
function Slide1() {
  return (
    <SlideShell>
      <div>
        <div className="text-xs sm:text-sm uppercase tracking-[0.2em] text-zinc-500 mb-6">El contexto</div>
        <h2 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight text-white leading-[1.1]">
          LATAM tiene <span className="text-amber-400">32 millones</span>
          <br />
          de PyMEs.
        </h2>
        <p className="mt-6 text-2xl sm:text-3xl text-zinc-400 leading-snug max-w-3xl">
          Sostienen <span className="text-white font-semibold">7 de cada 10</span> empleos
          de la región.
        </p>
        <p className="mt-3 text-2xl sm:text-3xl text-zinc-400 leading-snug max-w-3xl">
          Y <span className="text-red-300 font-semibold">ninguna</span> tiene equipo de TI.
        </p>

        <div className="mt-14 grid sm:grid-cols-2 gap-4 max-w-4xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">En Estados Unidos</div>
            <div className="text-2xl sm:text-3xl font-semibold text-zinc-200 leading-tight">
              Contratan un MSSP por
              <br />
              <span className="text-white">$2,000 USD/mes</span>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="text-xs uppercase tracking-wider text-amber-300/80 mb-2">En Latinoamérica</div>
            <div className="text-2xl sm:text-3xl font-semibold text-zinc-200 leading-tight">
              Contratan al <span className="text-amber-300">sobrino</span>
              <br />
              que sabe de computación.
            </div>
          </div>
        </div>

        <p className="mt-10 text-xl sm:text-2xl text-white font-medium">
          <span className="text-amber-400">No es justo.</span>
        </p>
      </div>
    </SlideShell>
  );
}

// 3 — SOLUCIÓN
function Slide2() {
  return (
    <SlideShell accent="emerald">
      <div className="text-center">
        <Image
          src="/sabuezo-logo.webp"
          alt="Sabuezo"
          width={120}
          height={120}
          className="size-28 sm:size-32 mx-auto mb-8"
          priority
        />
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-semibold tracking-tighter text-white">
          Sabuezo
        </h1>
        <p className="mt-5 text-xl sm:text-2xl md:text-3xl text-zinc-400 max-w-3xl mx-auto leading-snug">
          El <span className="text-amber-400">sabueso</span> que olfatea estafas por tu negocio.
        </p>
        <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-base sm:text-lg text-emerald-200 font-medium">
            Democratizando la ciberseguridad para Latinoamérica
          </span>
        </div>
        <div className="mt-14 flex flex-wrap justify-center gap-3 sm:gap-6 text-base sm:text-lg text-zinc-300">
          <span className="rounded-full bg-zinc-900/60 border border-zinc-800 px-5 py-2">📱 Por WhatsApp</span>
          <span className="rounded-full bg-zinc-900/60 border border-zinc-800 px-5 py-2">🌎 En español</span>
          <span className="rounded-full bg-zinc-900/60 border border-zinc-800 px-5 py-2">💰 Gratis para PyMEs</span>
        </div>
      </div>
    </SlideShell>
  );
}

// 4 — 3 FUNCIONES
function Slide3() {
  return (
    <SlideShell>
      <div>
        <div className="text-xs sm:text-sm uppercase tracking-[0.2em] text-zinc-500 mb-6">Cómo funciona</div>
        <h2 className="text-3xl sm:text-4xl md:text-6xl font-semibold tracking-tight text-white leading-[1.1]">
          Defensa <span className="text-amber-400">360°</span>{" "}
          en menos de 1 minuto.
        </h2>
        <p className="mt-4 text-lg sm:text-xl text-zinc-400 max-w-2xl">
          Tres vías de defensa que ningún otro producto en LATAM conecta entre sí.
        </p>

        <div className="mt-12 grid md:grid-cols-3 gap-4 sm:gap-5">
          <FeatureBlock
            icon={<MessageCircleWarning className="size-7" />}
            title="Detector de phishing"
            desc="Reenvía mensajes, links o screenshots por WhatsApp. IA entrenada en estafas LATAM."
            tag="01"
          />
          <FeatureBlock
            icon={<Globe className="size-7" />}
            title="Scanner de tu sitio"
            desc="SSL, headers, SPF/DKIM/DMARC, CMS, archivos expuestos. Score 0-100 + PDF."
            tag="02"
          />
          <FeatureBlock
            icon={<Database className="size-7" />}
            title="Chequeo de filtraciones"
            desc="¿Tu correo o número está en breaches públicos? Te decimos dónde y qué hacer."
            tag="03"
          />
        </div>
      </div>
    </SlideShell>
  );
}

// 5 — EL INSIGHT DIFERENCIAL
function Slide4() {
  return (
    <SlideShell>
      <div>
        <div className="text-xs sm:text-sm uppercase tracking-[0.2em] text-amber-300 mb-6">El insight diferencial</div>
        <h2 className="text-3xl sm:text-4xl md:text-6xl font-semibold tracking-tight text-white leading-[1.1] max-w-5xl">
          El ataque <span className="text-red-400">entrando</span>{" "}
          y la puerta <span className="text-amber-400">abierta saliendo</span>.
        </h2>

        <div className="mt-12 grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center max-w-5xl">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
            <div className="text-xs uppercase tracking-wider text-red-300/80 mb-2">Lo que recibes</div>
            <div className="text-lg sm:text-xl text-zinc-200 leading-snug">
              Phishing pretendiendo ser <span className="text-white font-semibold">tu propia empresa</span>.
            </div>
          </div>
          <div className="text-3xl text-amber-400 text-center hidden md:block">↔</div>
          <div className="text-3xl text-amber-400 text-center md:hidden">↕</div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
            <div className="text-xs uppercase tracking-wider text-amber-300/80 mb-2">Lo que tienes</div>
            <div className="text-lg sm:text-xl text-zinc-200 leading-snug">
              SPF/DMARC mal configurados: <span className="text-white font-semibold">cualquiera puede suplantarte</span>.
            </div>
          </div>
        </div>

        <div className="mt-12 inline-flex items-start gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 max-w-4xl">
          <Shield className="size-7 text-emerald-300 shrink-0 mt-0.5" />
          <div>
            <div className="text-base sm:text-lg text-white font-semibold">
              Sabuezo conecta los dos puntos automáticamente.
            </div>
            <div className="mt-1 text-sm sm:text-base text-zinc-300">
              Cuando reenvías un phishing, te dice por qué te llegó: tu DMARC permite suplantación. Nadie más hace eso.
            </div>
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

// 6 — DEMO LIVE (placeholder con UI sugerida)
function Slide5() {
  return (
    <SlideShell accent="emerald">
      <div className="text-center">
        <div className="text-xs sm:text-sm uppercase tracking-[0.2em] text-emerald-300/80 mb-6">Demo en vivo</div>
        <h2 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight text-white leading-[1.05]">
          Vamos a verlo.
        </h2>
        <p className="mt-6 text-lg sm:text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto">
          1️⃣ Reenviar un phishing por WhatsApp → 2️⃣ Escanear sabuezo.com → 3️⃣ Verificar un correo filtrado
        </p>

        <div className="mt-14 flex flex-wrap justify-center gap-3 sm:gap-4">
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_WA_NUMBER || ""}?text=hola`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 transition text-black px-6 py-3 font-medium text-lg"
          >
            Abrir WhatsApp <ArrowRight className="size-4" />
          </a>
          <Link
            href="/escanear"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition px-6 py-3 text-amber-200 text-lg"
          >
            sabuezo.com/escanear →
          </Link>
          <Link
            href="/filtraciones"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition px-6 py-3 text-amber-200 text-lg"
          >
            sabuezo.com/filtraciones →
          </Link>
        </div>

        <p className="mt-16 text-sm sm:text-base text-zinc-500">
          (Avanza a la siguiente slide cuando termines la demo)
        </p>
      </div>
    </SlideShell>
  );
}

// 7 — MAPA + ALCANCE
function Slide6() {
  return (
    <SlideShell>
      <div className="grid lg:grid-cols-[1fr_500px] gap-10 items-center">
        <div>
          <div className="text-xs sm:text-sm uppercase tracking-[0.2em] text-zinc-500 mb-6">Alcance</div>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-semibold tracking-tight text-white leading-[1.05]">
            Cubrimos <span className="text-amber-400">10 países</span>
            <br />
            desde el día uno.
          </h2>
          <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-xl">
            Mismo bot, mismo número, mismo idioma. Sabuezo entiende patrones de fraude
            locales: SAT, AFIP, SUNAT, DIAN, SRI, bancos regionales.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3 max-w-md">
            {["🇲🇽","🇨🇴","🇦🇷","🇨🇱","🇵🇪","🇪🇨","🇺🇾","🇨🇷","🇵🇦","🇩🇴"].map((flag, idx) => (
              <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 flex items-center gap-2">
                <span className="text-2xl">{flag}</span>
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:block">
          <PitchMap />
        </div>
      </div>
    </SlideShell>
  );
}

// 8 — STACK + CTA
function Slide7() {
  return (
    <SlideShell accent="emerald">
      <div className="text-center">
        <div className="text-xs sm:text-sm uppercase tracking-[0.2em] text-emerald-300/80 mb-6">Probado en producción</div>
        <h2 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tighter text-white leading-[1.05]">
          Por <span className="text-amber-400">LATAM</span>. Para <span className="text-amber-400">LATAM</span>.
          <br />
          Funcionando <span className="text-emerald-400">ahora mismo</span>.
        </h2>

        <div className="mt-12 grid sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto text-left">
          <StackPill label="WhatsApp" value="Baileys" />
          <StackPill label="Backend" value="FastAPI + Claude" />
          <StackPill label="Frontend" value="Next.js 16" />
          <StackPill label="Persistencia" value="Supabase" />
          <StackPill label="Tunnel" value="Tailscale Funnel" />
          <StackPill label="Hosting" value="Vercel + VPS" />
        </div>

        <div className="mt-14 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://sabuezo.com"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 transition text-black px-6 py-3 font-medium text-lg"
          >
            sabuezo.com <ArrowRight className="size-4" />
          </a>
          <a
            href="https://github.com/Avzolem/sabuezo"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition px-6 py-3 text-zinc-200 text-lg"
          >
            github.com/Avzolem/sabuezo
          </a>
        </div>

        <p className="mt-16 text-2xl sm:text-3xl md:text-4xl text-white font-medium">
          Cuídate. <span className="text-amber-400">Tu negocio depende de eso.</span>
        </p>
      </div>
    </SlideShell>
  );
}

// ────────────────────────── Helpers ──────────────────────────

function FeatureBlock({ icon, title, desc, tag }: { icon: React.ReactNode; title: string; desc: string; tag: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-7">
      <div className="flex items-center justify-between mb-5">
        <div className="rounded-xl bg-amber-500/15 inline-flex p-3 text-amber-300">{icon}</div>
        <span className="text-3xl sm:text-4xl font-semibold text-zinc-700 tabular-nums">{tag}</span>
      </div>
      <h3 className="text-xl sm:text-2xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm sm:text-base text-zinc-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function StackPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 text-base sm:text-lg font-medium text-white">{value}</div>
    </div>
  );
}

const PITCH_CAPITALS = [
  { name: "CDMX", x: 112, y: 100, size: 6, isHQ: true },
  { name: "Guatemala", x: 164, y: 130 },
  { name: "San Salvador", x: 178, y: 138 },
  { name: "San José", x: 202, y: 160 },
  { name: "Panamá", x: 229, y: 167 },
  { name: "Sto. Domingo", x: 286, y: 105 },
  { name: "Caracas", x: 296, y: 158 },
  { name: "Bogotá", x: 262, y: 193 },
  { name: "Quito", x: 235, y: 223 },
  { name: "Lima", x: 244, y: 298 },
  { name: "La Paz", x: 285, y: 340 },
  { name: "Asunción", x: 322, y: 388 },
  { name: "Santiago", x: 282, y: 434 },
  { name: "Montevideo", x: 368, y: 443 },
  { name: "Buenos Aires", x: 355, y: 441 },
];

function PitchMap() {
  return (
    <div className="relative w-full">
      <svg viewBox="0 0 500 600" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="pitchDotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g fill="#f59e0b" fillOpacity="0.06" stroke="#f59e0b" strokeOpacity="0.35" strokeWidth="0.6" strokeLinejoin="round">
          {LATAM_PATHS.map((c) => (
            <path key={c.id} d={c.d} />
          ))}
        </g>
        {PITCH_CAPITALS.map((c, idx) => (
          <g key={idx}>
            <circle cx={c.x} cy={c.y} r={c.isHQ ? 18 : 14} fill="url(#pitchDotGlow)" />
            <circle cx={c.x} cy={c.y} r={c.size ?? 3.5} fill="#f59e0b" stroke={c.isHQ ? "#fff" : "none"} strokeWidth={c.isHQ ? 1 : 0}>
              <animate attributeName="opacity" values="0.55;1;0.55" dur={`${2 + (idx % 4) * 0.5}s`} repeatCount="indefinite" begin={`${(idx % 5) * 0.3}s`} />
            </circle>
            <circle cx={c.x} cy={c.y} r={c.size ?? 3.5} fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0">
              <animate attributeName="r" values={`${c.size ?? 3.5};${(c.size ?? 3.5) + 14}`} dur="2.5s" repeatCount="indefinite" begin={`${(idx % 5) * 0.4}s`} />
              <animate attributeName="opacity" values="0.7;0" dur="2.5s" repeatCount="indefinite" begin={`${(idx % 5) * 0.4}s`} />
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}
