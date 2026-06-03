import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, FileText, AlertTriangle, Code2, Mail, Heart, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Términos — Sabuezo",
  description:
    "Términos de uso de Sabuezo. Servicio gratuito de ciberseguridad para PyMEs de LATAM. Open source, sin garantías comerciales.",
};

const LAST_UPDATED = "24 de mayo de 2026";
const CONTACT_EMAIL = "andresaguilar.exe@gmail.com";

export default function TerminosPage() {
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "";

  return (
    <main className="min-h-screen bg-[var(--color-background)] grain">
      {/* HEADER */}
      <header className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Image src="/sabuezo-logo.webp" alt="Sabuezo" width={36} height={36} className="size-9" priority />
          <span>Sabuezo</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </header>

      {/* CONTENT */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 pt-6 pb-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/5 px-3 py-1 text-xs text-amber-300/90">
          <FileText className="size-3.5" />
          Términos de uso
        </div>

        <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">
          Las reglas, en claro.
        </h1>
        <p className="mt-3 text-zinc-400 leading-relaxed">
          Sabuezo es gratis, open source y está hecho para ayudar a PyMEs de LATAM a defenderse del fraude
          digital. Estos términos describen qué ofrecemos, qué esperamos de ti, y los límites del servicio.
        </p>
        <p className="mt-2 text-xs uppercase tracking-wider text-zinc-600">
          Última actualización: {LAST_UPDATED}
        </p>

        <div className="mt-10 space-y-12 text-zinc-300 leading-relaxed">

          <Section title="1. Qué es Sabuezo">
            <p>
              Sabuezo es un servicio de ciberseguridad para PyMEs que combina un bot de WhatsApp, un escáner
              de seguridad web y un verificador de filtraciones de datos. El servicio es{" "}
              <strong className="text-white">gratuito</strong>, está en{" "}
              <strong className="text-white">beta</strong>, y su código fuente es público en{" "}
              <a
                href="https://github.com/Avzolem/sabuezo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-4"
              >
                github.com/Avzolem/sabuezo
              </a>
              .
            </p>
          </Section>

          <Section title="2. Aceptación">
            <p>
              Al usar el bot de WhatsApp, el sitio web o cualquier funcionalidad de Sabuezo, aceptas estos
              términos y la{" "}
              <Link href="/privacidad" className="text-amber-400 hover:text-amber-300 underline underline-offset-4">
                política de privacidad
              </Link>
              . Si no estás de acuerdo con algo, no uses el servicio.
            </p>
          </Section>

          <Section title="3. Qué puedes esperar">
            <ul className="mt-2 space-y-2 list-disc list-inside marker:text-amber-500/60">
              <li>Análisis de phishing en screenshots y mensajes que envíes al bot.</li>
              <li>Escaneo de seguridad de sitios web públicos (cabeceras, certificados, DNS público).</li>
              <li>Verificación de si tu correo o teléfono aparece en filtraciones públicas conocidas.</li>
              <li>Reportes y recomendaciones generadas con IA.</li>
            </ul>
          </Section>

          <Section title="4. Uso responsable">
            <p>Al usar Sabuezo te comprometes a NO:</p>
            <ul className="mt-3 space-y-2 list-disc list-inside marker:text-amber-500/60 text-zinc-400">
              <li>Escanear sitios sin autorización del propietario cuando esto vaya más allá de información pública.</li>
              <li>Verificar correos o teléfonos que no sean tuyos o de tu organización sin consentimiento.</li>
              <li>Usar el servicio para hostigar, defraudar o atacar a terceros.</li>
              <li>Automatizar el servicio para evadir rate-limits o saturar la infraestructura.</li>
              <li>Hacer ingeniería inversa con la intención de comprometer la seguridad del sistema (las contribuciones open source legítimas son bienvenidas).</li>
            </ul>
            <p className="mt-4 text-sm text-zinc-400">
              Nos reservamos el derecho de bloquear cuentas o números que abusen del servicio.
            </p>
          </Section>

          <Section title="5. El servicio es orientativo, no una auditoría profesional">
            <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="text-amber-200/90 font-medium">
                    Sabuezo es una herramienta de detección automatizada.
                  </p>
                  <p className="text-zinc-300">
                    Los resultados son <strong className="text-white">orientativos</strong> y no sustituyen
                    una auditoría profesional, una opinión legal ni un análisis forense. La IA puede
                    equivocarse: puede dar falsos positivos (marcar algo legítimo como fraude) o falsos
                    negativos (no detectar un fraude real).
                  </p>
                  <p className="text-zinc-400">
                    Para decisiones críticas — pagos grandes, datos sensibles, incidentes activos —
                    contrasta con un profesional de ciberseguridad o tu institución financiera.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          <Section title="6. Sin garantías">
            <p>
              El servicio se ofrece <strong className="text-white">&quot;tal cual&quot;</strong>, sin
              garantías expresas ni implícitas de funcionamiento continuo, exactitud, disponibilidad o
              ausencia de errores. Sabuezo puede estar caído, fallar o no detectar amenazas reales — usa tu
              juicio.
            </p>
          </Section>

          <Section title="7. Limitación de responsabilidad">
            <p>
              En la medida que la ley aplicable lo permita, Sabuezo y sus mantenedores no son responsables
              por daños directos, indirectos, incidentales o consecuentes derivados del uso o la
              imposibilidad de usar el servicio — incluyendo pérdida de datos, lucro cesante o cualquier
              perjuicio económico.
            </p>
            <p className="mt-3 text-sm text-zinc-400">
              Tú decides qué información compartes y qué decisiones tomas con base en los resultados.
            </p>
          </Section>

          <Section title="8. Propiedad intelectual y código abierto">
            <p>
              El código fuente de Sabuezo se publica bajo una licencia de código abierto en{" "}
              <a
                href="https://github.com/Avzolem/sabuezo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-4"
              >
                GitHub
              </a>
              . El nombre &quot;Sabuezo&quot;, el logotipo y los textos del sitio pertenecen al autor. Las
              marcas de terceros mencionadas (WhatsApp, SAT, AFIP, etc.) pertenecen a sus respectivos
              dueños.
            </p>
          </Section>

          <Section title="9. Servicios de terceros">
            <p>
              Sabuezo se apoya en servicios de terceros (Anthropic, Supabase, Vercel, WhatsApp/Meta,
              XposedOrNot, LeakCheck). Su disponibilidad y términos están fuera de nuestro control. Si uno
              de ellos cambia o se cae, Sabuezo puede verse afectado.
            </p>
          </Section>

          <Section title="10. Cambios al servicio y a los términos">
            <p>
              Podemos modificar, suspender o descontinuar funciones de Sabuezo en cualquier momento. Si
              cambian estos términos, actualizamos la fecha de arriba; los cambios importantes se anunciarán
              por el bot o en el sitio.
            </p>
          </Section>

          <Section title="11. Ley aplicable">
            <p>
              Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia
              se intentará resolver de buena fe antes de recurrir a tribunales competentes en Ciudad de
              México.
            </p>
          </Section>

          <Section title="12. Contacto">
            <div className="mt-2 flex flex-col sm:flex-row gap-3">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 transition text-black px-4 py-2 text-sm font-medium"
              >
                <Mail className="size-4" />
                {CONTACT_EMAIL}
              </a>
              <a
                href="https://github.com/Avzolem/sabuezo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900 transition text-zinc-200 px-4 py-2 text-sm font-medium"
              >
                <Code2 className="size-4" />
                Ver código en GitHub
              </a>
              <a
                href="https://avsolem.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900 transition text-zinc-200 px-4 py-2 text-sm font-medium"
              >
                <ExternalLink className="size-4" />
                avsolem.com
              </a>
              {waNumber && (
                <a
                  href={`https://wa.me/${waNumber}?text=hola`}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900 transition text-zinc-200 px-4 py-2 text-sm font-medium"
                >
                  WhatsApp
                </a>
              )}
            </div>

            <p className="mt-10 inline-flex items-center gap-2 text-sm text-zinc-500">
              <Heart className="size-4 text-amber-400" />
              Gracias por confiar en Sabuezo. Cuídate, cuida a tu negocio.
            </p>
          </Section>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
