import { supabase } from "@/lib/supabase";
import { LATAM_PATHS } from "@/lib/latam-map";
import { Shield, MessageCircleWarning, Globe, ArrowRight, Sparkles, Database } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ─────────── Capitales para el mapa (viewBox 500x600) ───────────
const CAPITALS: { name: string; x: number; y: number; size?: number; flag: string }[] = [
  { name: "CDMX",          flag: "🇲🇽", x: 112, y: 100, size: 6 },
  { name: "Guatemala",     flag: "🇬🇹", x: 164, y: 130 },
  { name: "San Salvador",  flag: "🇸🇻", x: 178, y: 138 },
  { name: "San José",      flag: "🇨🇷", x: 202, y: 160 },
  { name: "Panamá",        flag: "🇵🇦", x: 229, y: 167 },
  { name: "Sto. Domingo",  flag: "🇩🇴", x: 286, y: 105 },
  { name: "Caracas",       flag: "🇻🇪", x: 296, y: 158 },
  { name: "Bogotá",        flag: "🇨🇴", x: 262, y: 193 },
  { name: "Quito",         flag: "🇪🇨", x: 235, y: 223 },
  { name: "Lima",          flag: "🇵🇪", x: 244, y: 298 },
  { name: "La Paz",        flag: "🇧🇴", x: 285, y: 340 },
  { name: "Asunción",      flag: "🇵🇾", x: 322, y: 388 },
  { name: "Santiago",      flag: "🇨🇱", x: 282, y: 434 },
  { name: "Montevideo",    flag: "🇺🇾", x: 368, y: 443 },
  { name: "Buenos Aires",  flag: "🇦🇷", x: 355, y: 441 },
];

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [4, 5], [4, 6],
  [4, 7], [7, 8], [8, 9],
  [9, 10], [10, 11],
  [10, 12],
  [11, 13], [12, 14], [13, 14],
  [6, 7],
];

const COUNTRY_GRID = [
  { flag: "🇲🇽", name: "México" },
  { flag: "🇨🇴", name: "Colombia" },
  { flag: "🇦🇷", name: "Argentina" },
  { flag: "🇨🇱", name: "Chile" },
  { flag: "🇵🇪", name: "Perú" },
  { flag: "🇪🇨", name: "Ecuador" },
  { flag: "🇺🇾", name: "Uruguay" },
  { flag: "🇨🇷", name: "Costa Rica" },
  { flag: "🇵🇦", name: "Panamá" },
  { flag: "🇩🇴", name: "Rep. Dom." },
];

async function getStats() {
  try {
    const [{ count: pymes }, { count: dets }, { count: rojos }] = await Promise.all([
      supabase.from("pymes").select("*", { count: "exact", head: true }),
      supabase.from("phishing_detections").select("*", { count: "exact", head: true }),
      supabase
        .from("phishing_detections")
        .select("*", { count: "exact", head: true })
        .eq("risk", "rojo"),
    ]);
    return { pymes: pymes ?? 0, dets: dets ?? 0, rojos: rojos ?? 0 };
  } catch {
    return { pymes: 0, dets: 0, rojos: 0 };
  }
}

export default async function HomePage() {
  const stats = await getStats();
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "";

  return (
    <main className="min-h-screen bg-[var(--color-background)] grain">
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(245,158,11,0.18) 0%, transparent 70%)",
          }}
        />

        <header className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Image src="/sabuezo-logo.webp" alt="Sabuezo" width={36} height={36} className="size-9" priority />
            <span>Sabuezo</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
              <Link href="/escanear" className="hover:text-white transition">Escanear</Link>
              <Link href="/filtraciones" className="hover:text-white transition">Filtraciones</Link>
              <a href="#como-funciona" className="hover:text-white transition">¿Cómo funciona?</a>
              <a href="#por-que" className="hover:text-white transition">¿Por qué?</a>
              <Link href="/pitch" className="hover:text-white transition">Pitch</Link>
            </nav>
            <a
              href={waNumber ? `https://wa.me/${waNumber}?text=hola` : "#"}
              className="rounded-full bg-amber-500 hover:bg-amber-400 transition text-black px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap"
            >
              Empezar
            </a>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 sm:pt-12 pb-16 sm:pb-24">
          <div className="grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300 mb-5 sm:mb-6">
                <Sparkles className="size-3" /> Democratizando la ciberseguridad para Latinoamérica
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tighter text-white leading-[1.05]">
                El <span className="text-amber-400">Sabuezo</span> que olfatea
                <br className="hidden sm:inline" />
                <span className="sm:hidden"> </span>
                estafas por tu negocio.
              </h1>
              <p className="mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl leading-relaxed">
                Reenvía cualquier mensaje sospechoso, correo de proveedor raro o screenshot
                de WhatsApp a Sabuezo. Te dice si es estafa en segundos. Mientras tanto,
                escanea tu sitio web por puertas abiertas que los criminales aprovechan.
              </p>

              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
                <a
                  href={waNumber ? `https://wa.me/${waNumber}?text=hola` : "#"}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 transition text-black px-6 py-3 font-medium"
                >
                  Empieza por WhatsApp
                  <ArrowRight className="size-4" />
                </a>
                <Link
                  href="/escanear"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition px-6 py-3 text-amber-200"
                >
                  Escanea tu sitio →
                </Link>
              </div>

              <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row flex-wrap gap-3">
                <Link
                  href="/filtraciones?tipo=correo"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition px-5 py-2.5 text-sm text-amber-200"
                >
                  📧 Revisa tu correo
                </Link>
                <Link
                  href="/filtraciones?tipo=numero"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition px-5 py-2.5 text-sm text-amber-200"
                >
                  📱 Revisa tu número
                </Link>
                <Link
                  href="/filtraciones?tipo=contraseña"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition px-5 py-2.5 text-sm text-amber-200"
                >
                  🔑 Revisa tu contraseña
                </Link>
              </div>

              {/* Stats */}
              <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-3 sm:gap-6 max-w-2xl">
                <Stat label="PyMEs protegidas" value={stats.pymes} />
                <Stat label="Mensajes analizados" value={stats.dets} />
                <Stat label="Estafas bloqueadas" value={stats.rojos} accent />
              </div>
            </div>

            {/* Hero mascot — solo en lg+ */}
            <div className="hidden lg:flex justify-center items-center">
              <Image
                src="/sabuezo-hero.webp"
                alt=""
                width={340}
                height={275}
                priority
                className="w-[340px] h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="border-t border-zinc-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
            Defensa 360° en menos de 1 minuto
          </h2>
          <p className="mt-3 text-zinc-400 max-w-2xl">
            Sabuezo combina tres vías de defensa que ningún otro producto en LATAM conecta
            entre sí.
          </p>

          <div className="mt-10 sm:mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <FeatureCard
              icon={<MessageCircleWarning className="size-6" />}
              title="Detector de phishing por WhatsApp"
              desc="Reenvíame textos, links, screenshots o correos. Analizo con IA entrenada en estafas latinoamericanas: SAT, AFIP, SUNAT, DIAN, SRI, bancos locales (BBVA, Bradesco, Itaú, Bancolombia), fraude de proveedor y secuestro virtual."
              points={[
                "Análisis multimodal: texto, URL e imagen",
                "Entrenado contra 30+ patrones de estafa en LATAM",
                "Score 🔴🟡🟢 con explicación y qué hacer",
              ]}
            />
            <FeatureCard
              icon={<Globe className="size-6" />}
              title="Diagnóstico de seguridad de tu sitio"
              desc="Escaneo automático: SSL, headers, configuración de correo (SPF/DKIM/DMARC), CMS y archivos expuestos. Reporte ejecutivo en español plano."
              points={[
                "Detecta puertas abiertas en tu web",
                "Plan de acción priorizado y con tiempos",
                "Score 0-100 que puedes mostrar a tu equipo",
              ]}
            />
            <FeatureCard
              icon={<Database className="size-6" />}
              title="¿Tu correo o número está filtrado?"
              desc="Te cruzo contra millones de filtraciones públicas (Yahoo, LinkedIn, Adobe, Instagram, fugas regionales en LATAM). Si tu dato está expuesto, te digo dónde y qué hacer."
              points={[
                "Chequeo de correos contra breaches conocidos",
                "Chequeo de números celulares en fugas públicas",
                "Plan de mitigación: 2FA, contraseñas, alertas",
              ]}
            />
          </div>

          {/* The magic insight */}
          <div className="mt-8 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-amber-500/20 p-3">
                <Shield className="size-6 text-amber-300" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  El insight que nadie más ve
                </h3>
                <p className="mt-2 text-zinc-300 leading-relaxed max-w-3xl">
                  Si tu dominio tiene SPF/DMARC mal configurados,{" "}
                  <span className="text-amber-300">cualquiera puede mandar correos pretendiendo ser tu empresa</span>.
                  Eso explica por qué tu equipo recibe tanto phishing falsificando direcciones de tu propia organización. Sabuezo conecta los dos puntos:
                  el ataque entrando Y la puerta abierta saliendo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROTEGEMOS PyMEs EN LATAM */}
      <section className="border-t border-zinc-900 bg-zinc-950/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
          <div className="grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400 mb-5">
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                10 países · expandiéndose
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                Protegemos PyMEs en toda <span className="text-amber-400">LATAM</span>
              </h2>
              <p className="mt-4 text-zinc-400 leading-relaxed max-w-xl">
                Mismo bot, mismo número, mismo idioma. Sabuezo entiende patrones de fraude
                locales en cada país: agencias tributarias, bancos, esquemas regionales,
                terminología de cada mercado.
              </p>

              {/* Grid de banderas */}
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3 max-w-xl">
                {COUNTRY_GRID.map((c) => (
                  <div
                    key={c.name}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-amber-500/40 hover:bg-zinc-900/70 transition px-3 py-2.5 flex items-center gap-3"
                  >
                    <span className="text-xl sm:text-2xl">{c.flag}</span>
                    <div>
                      <div className="text-sm font-medium text-white">{c.name}</div>
                      <div className="text-[10px] text-emerald-300/80 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Activo
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mapa LATAM — derecha en lg+ */}
            <div className="hidden lg:block w-[440px]">
              <LatamMap />
            </div>
          </div>

          {/* Mapa en mobile, debajo */}
          <div className="lg:hidden mt-12">
            <LatamMap small />
          </div>
        </div>
      </section>

      {/* POR QUE */}
      <section id="por-que" className="border-t border-zinc-900 bg-zinc-950/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-start">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                LATAM tiene <span className="text-amber-400">32M</span> PyMEs.
                <br />
                Ninguna tiene equipo de TI.
              </h2>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Las PyMEs son más del 99% del tejido empresarial latinoamericano y generan
                7 de cada 10 empleos en la región. Pero el 60% sufrirá un ciberataque este año,
                y el ataque promedio puede quebrar a un negocio pequeño.
              </p>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Sabuezo le da a cada papelería, restaurante, taller y consultorio — de Tijuana
                a Ushuaia — el mismo nivel de defensa que una empresa Fortune 500. Por WhatsApp,
                en español, sin contratar a nadie.
              </p>
            </div>
            <div className="space-y-4">
              <Quote text="Casi le hago el depósito al 'proveedor nuevo'. Lo reenvié a Sabuezo y me dijo en 3 segundos que era fraude de cambio de cuenta." author="Dueño de imprenta · CDMX, México 🇲🇽" />
              <Quote text="Llegó un correo del banco pidiéndome confirmar datos. Sabuezo me dijo que era phishing y por qué. Salvó mi negocio." author="Dueña de cafetería · Bogotá, Colombia 🇨🇴" />
              <Quote text="Mi DMARC estaba mal y yo ni sabía qué era eso. Sabuezo me lo arregló con 2 líneas." author="Dueño de estudio contable · Buenos Aires, Argentina 🇦🇷" />
            </div>
          </div>
        </div>
      </section>

      {/* MANIFIESTO — estructura 2-col estilo "32M PyMEs" */}
      <section id="manifiesto" className="border-t border-zinc-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300 mb-5">
                <Sparkles className="size-3" /> Manifiesto Sabuezo
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                <span className="text-amber-400">No es justo.</span>
                <br />
                En LATAM también merecemos defensa.
              </h2>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                En Estados Unidos un negocio chico contrata un MSSP por $2,000 USD al mes.
                En Latinoamérica, contrata al sobrino que sabe de computación. Mientras
                tanto, los criminales operan a escala industrial y a las PyMEs las atacan
                igual o más que a las grandes corporaciones.
              </p>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Sabuezo es la respuesta. No te vendemos un curso, ni un firewall, ni una
                consultoría. Te damos un bot que vive en tu WhatsApp y te dice qué es
                estafa y qué no — en español, sin tecnicismos, gratis para PyMEs.
              </p>
              <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-emerald-200 font-medium">
                  Democratizando la ciberseguridad para Latinoamérica
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <StatBlock big="32M" label="PyMEs en LATAM" sub="Más del 99% del tejido empresarial de la región." />
              <StatBlock big="7 de 10" label="empleos" sub="Las PyMEs sostienen la mayoría de los empleos de Latinoamérica." />
              <StatBlock big="$0" label="vs $2,000 USD/mes" sub="Lo que paga un negocio chico en EE.UU. por un MSSP. Sabuezo es gratis." accent />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
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

// ─────────── Helpers ───────────

function LatamMap({ small = false }: { small?: boolean }) {
  const size = small ? "w-full max-w-sm mx-auto" : "w-full";
  return (
    <div className={`relative ${size}`}>
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(245,158,11,0.10) 0%, transparent 70%)",
        }}
      />
      <svg
        viewBox="0 0 500 600"
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Silueta de LATAM — paths reales de los países */}
        <g fill="#f59e0b" fillOpacity="0.06" stroke="#f59e0b" strokeOpacity="0.35" strokeWidth="0.6" strokeLinejoin="round">
          {LATAM_PATHS.map((c) => (
            <path key={c.id} d={c.d} />
          ))}
        </g>

        <g stroke="#f59e0b" strokeWidth="0.7" opacity="0.30" strokeLinecap="round">
          {CONNECTIONS.map(([a, b], i) => {
            const A = CAPITALS[a];
            const B = CAPITALS[b];
            return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} />;
          })}
        </g>

        {CAPITALS.map((c, i) => (
          <circle key={`glow-${i}`} cx={c.x} cy={c.y} r={i === 0 ? 18 : 14} fill="url(#dotGlow)" />
        ))}

        {CAPITALS.map((c, i) => {
          const isMx = i === 0;
          const radius = c.size ?? 3.5;
          return (
            <g key={`dot-${i}`}>
              <circle cx={c.x} cy={c.y} r={radius} fill="#f59e0b" stroke={isMx ? "#fff" : "none"} strokeWidth={isMx ? 1 : 0}>
                <animate
                  attributeName="opacity"
                  values="0.55;1;0.55"
                  dur={`${2 + (i % 4) * 0.5}s`}
                  repeatCount="indefinite"
                  begin={`${(i % 5) * 0.3}s`}
                />
              </circle>
              <circle cx={c.x} cy={c.y} r={radius} fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0">
                <animate attributeName="r" values={`${radius};${radius + 12}`} dur="2.5s" repeatCount="indefinite" begin={`${(i % 5) * 0.4}s`} />
                <animate attributeName="opacity" values="0.7;0" dur="2.5s" repeatCount="indefinite" begin={`${(i % 5) * 0.4}s`} />
              </circle>
            </g>
          );
        })}

        {[0, 7, 9, 13].map((idx) => {
          const c = CAPITALS[idx];
          return (
            <text
              key={`lbl-${idx}`}
              x={c.x + 10}
              y={c.y + 3}
              fill="#a1a1aa"
              fontSize="11"
              fontFamily="sans-serif"
              fontWeight="500"
            >
              {c.name}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div className={`text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight tabular-nums ${accent ? "text-amber-400" : "text-white"}`}>
        {value.toLocaleString("es-MX")}
      </div>
      <div className="mt-1 text-[10px] sm:text-xs uppercase tracking-wider text-zinc-500 leading-tight">{label}</div>
    </div>
  );
}

function StatBlock({ big, label, sub, accent }: { big: string; label: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border ${accent ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent" : "border-zinc-800 bg-zinc-900/40"} p-6`}>
      <div className="flex items-baseline gap-3">
        <span className={`text-4xl sm:text-5xl font-semibold tracking-tight ${accent ? "text-amber-400" : "text-white"}`}>{big}</span>
        <span className="text-sm uppercase tracking-wider text-zinc-500">{label}</span>
      </div>
      <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{sub}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  points,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  points: string[];
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 hover:border-zinc-700 transition">
      <div className="rounded-xl bg-zinc-800/60 inline-flex p-3 text-amber-300">{icon}</div>
      <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 text-zinc-400 leading-relaxed">{desc}</p>
      <ul className="mt-4 space-y-2">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
            <span className="text-amber-400 mt-0.5">→</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Quote({ text, author }: { text: string; author: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <p className="text-zinc-200 leading-relaxed">&ldquo;{text}&rdquo;</p>
      <div className="mt-3 text-xs text-zinc-500 uppercase tracking-wider">— {author}</div>
    </div>
  );
}
