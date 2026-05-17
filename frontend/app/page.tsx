import { supabase } from "@/lib/supabase";
import { Shield, MessageCircleWarning, Globe, ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

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
            <Image src="/sabuezo-logo.png" alt="Sabuezo" width={36} height={36} className="size-9" priority />
            <span>Sabuezo</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
              <Link href="/escanear" className="hover:text-white transition">Escanear</Link>
              <a href="#como-funciona" className="hover:text-white transition">¿Cómo funciona?</a>
              <a href="#por-que" className="hover:text-white transition">¿Por qué?</a>
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
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 mb-5 sm:mb-6">
              <Sparkles className="size-3" /> Hecho en México para PyMEs mexicanas
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tighter text-white leading-[1.05]">
              El <span className="text-amber-400">sabueso</span> que olfatea
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
                Escanea tu sitio gratis →
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-3 sm:gap-6 max-w-2xl">
              <Stat label="PyMEs protegidas" value={stats.pymes} />
              <Stat label="Mensajes analizados" value={stats.dets} />
              <Stat label="Estafas bloqueadas" value={stats.rojos} accent />
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
            Sabuezo combina dos vías de defensa que ningún otro producto en LATAM conecta
            entre sí.
          </p>

          <div className="mt-10 sm:mt-12 grid md:grid-cols-2 gap-4 sm:gap-6">
            <FeatureCard
              icon={<MessageCircleWarning className="size-6" />}
              title="Detector de phishing por WhatsApp"
              desc="Reenvíame textos, links, screenshots o correos. Analizo con IA entrenada en estafas mexicanas (SAT, BBVA, Banamex, fraude de proveedor, secuestro virtual)."
              points={[
                "Análisis multimodal: texto, URL e imagen",
                "Entrenado contra 30+ patrones de estafa MX",
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

      {/* POR QUE */}
      <section id="por-que" className="border-t border-zinc-900 bg-zinc-950/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-start">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
                México tiene <span className="text-amber-400">4.9M</span> PyMEs.
                <br />
                Ninguna tiene equipo de TI.
              </h2>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Las PyMEs son el 99.8% del tejido empresarial mexicano. Generan 7 de cada
                10 empleos. Pero el 60% sufrirá un ciberataque este año, y el ataque promedio
                puede quebrar a un negocio pequeño.
              </p>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Sabuezo le da a cada papelería, restaurante, taller y consultorio el mismo nivel
                de defensa que una empresa Fortune 500 — por WhatsApp, sin contratar a nadie.
              </p>
            </div>
            <div className="space-y-4">
              <Quote text="Casi le hago el depósito al 'proveedor nuevo'. Lo reenvié a Sabuezo y me dijo en 3 segundos que era fraude de cambio de cuenta." author="Dueño de imprenta, CDMX" />
              <Quote text="Mi DMARC estaba mal y yo ni sabía qué era eso. Sabuezo me lo arregló con 2 líneas." author="Dueña de consultorio dental, GDL" />
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Image src="/sabuezo-logo.png" alt="Sabuezo" width={24} height={24} className="size-6" />
            <span>Sabuezo · Hecho con cariño en México</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-zinc-300 transition">Términos</a>
            <a href="#" className="hover:text-zinc-300 transition">Privacidad</a>
          </div>
        </div>
      </footer>
    </main>
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
