import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Shield, Database, Trash2, Mail, Code2, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacidad — Sabuezo",
  description:
    "Cómo Sabuezo recolecta, usa, almacena y protege tus datos. Política de privacidad clara para PyMEs de LATAM.",
};

const LAST_UPDATED = "24 de mayo de 2026";
const CONTACT_EMAIL = "andresaguilar.exe@gmail.com";

export default function PrivacidadPage() {
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
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/5 px-3 py-1 text-xs text-emerald-300/80">
          <Shield className="size-3.5" />
          Política de privacidad
        </div>

        <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">
          Tus datos son tuyos.
        </h1>
        <p className="mt-3 text-zinc-400 leading-relaxed">
          Sabuezo es un proyecto de ciberseguridad para PyMEs de Latinoamérica. Procesamos datos sensibles
          para detectar fraude — y tomamos eso en serio. Aquí está, en lenguaje claro, lo que hacemos con tu
          información.
        </p>
        <p className="mt-2 text-xs uppercase tracking-wider text-zinc-600">
          Última actualización: {LAST_UPDATED}
        </p>

        <div className="mt-10 space-y-12 text-zinc-300 leading-relaxed">

          <Section title="1. Quién es responsable">
            <p>
              Sabuezo es un proyecto open source mantenido por Andrés Aguilar desde México. El código está
              disponible en{" "}
              <a
                href="https://github.com/Avzolem/sabuezo"
                className="text-amber-400 hover:text-amber-300 underline underline-offset-4"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/Avzolem/sabuezo
              </a>
              . Cualquier duda sobre privacidad escríbenos a{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-amber-400 hover:text-amber-300 underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="2. Qué datos recolectamos">
            <p>Recolectamos únicamente lo necesario para que el servicio funcione:</p>
            <ul className="mt-4 space-y-3 list-none">
              <Item label="Bot WhatsApp">
                Tu número de teléfono, mensajes y screenshots que envíes para análisis, y los datos de tu
                PyME si decides registrarla (nombre del negocio, sector, sitio web). No leemos conversaciones
                que no nos envíes.
              </Item>
              <Item label="Chequeo de filtraciones">
                El correo o teléfono que envías para verificar si aparece en bases de datos filtradas. Lo
                consultamos contra XposedOrNot (correos) y LeakCheck (teléfonos), ambos servicios públicos, y
                guardamos un registro de la consulta (el valor consultado, si resultó filtrado y la fecha)
                para generar estadísticas internas del servicio. Estos registros no son públicos y solo
                nuestro backend puede leerlos.
              </Item>
              <Item label="Escáner web">
                La URL que decides escanear y los resultados técnicos del análisis (cabeceras, certificados,
                registros DNS públicos).
              </Item>
              <Item label="Datos técnicos">
                Dirección IP y user-agent del navegador para limitar abuso (rate-limiting). No usamos cookies
                de seguimiento ni publicidad.
              </Item>
              <Item label="Analítica anónima">
                Vercel Analytics registra visitas agregadas (página, país, dispositivo) sin cookies y sin
                identificarte personalmente.
              </Item>
            </ul>
          </Section>

          <Section title="3. Para qué los usamos">
            <ul className="mt-2 space-y-2 list-disc list-inside marker:text-amber-500/60">
              <li>Detectar phishing, suplantación y fraude en lo que nos envías.</li>
              <li>Generar reportes y recomendaciones de seguridad para tu PyME.</li>
              <li>Mejorar la precisión del detector con datos agregados y anonimizados.</li>
              <li>Limitar abuso del servicio (rate-limiting por IP).</li>
            </ul>
            <p className="mt-4 text-sm text-zinc-400">
              <strong className="text-white">No vendemos, alquilamos ni compartimos</strong> tus datos con
              terceros con fines comerciales. Punto.
            </p>
          </Section>

          <Section title="4. Quién procesa tus datos">
            <p>Para que el servicio funcione, algunos datos pasan por proveedores especializados:</p>
            <ul className="mt-4 space-y-3">
              <ProviderItem
                name="Anthropic (Claude)"
                purpose="Análisis del contenido que envías (screenshots, mensajes) para detectar fraude."
              />
              <ProviderItem
                name="Supabase"
                purpose="Base de datos donde se guarda el registro de tu PyME y el historial de detecciones."
              />
              <ProviderItem
                name="XposedOrNot · LeakCheck"
                purpose="APIs públicas para verificar si tu correo o teléfono aparece en filtraciones conocidas."
              />
              <ProviderItem
                name="Vercel"
                purpose="Hospedaje del sitio web y analítica agregada anónima."
              />
              <ProviderItem
                name="WhatsApp (Meta)"
                purpose="Canal de mensajería del bot. Aplican sus propios términos."
              />
            </ul>
          </Section>

          <Section title="5. Cuánto tiempo guardamos tus datos">
            <ul className="mt-2 space-y-2 list-disc list-inside marker:text-amber-500/60">
              <li>Registro de PyME y detecciones: mientras uses el servicio o hasta que pidas borrarlo.</li>
              <li>Chequeos de filtraciones: se conservan mientras uses el servicio o hasta que pidas borrarlos.</li>
              <li>Logs técnicos (IP, rate-limiting): hasta 30 días.</li>
            </ul>
          </Section>

          <Section title="6. Tus derechos">
            <p>
              Tienes derecho a acceder, rectificar, oponerte al tratamiento y borrar tus datos en cualquier
              momento. Como Sabuezo opera desde México, aplican los derechos ARCO de la{" "}
              <span className="text-zinc-200">LFPDPPP</span>. Si estás en otro país de LATAM, también
              respetamos los derechos equivalentes de tu jurisdicción.
            </p>
          </Section>

          <Section title="7. Cómo borrar tus datos">
            <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
              <div className="flex items-start gap-3">
                <Trash2 className="size-5 text-amber-400 mt-0.5 shrink-0" />
                <div className="space-y-3 text-sm">
                  <p>
                    Desde el bot escribe <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-amber-300">borrar mis datos</code>{" "}
                    y eliminamos todo lo asociado a tu número en menos de 7 días.
                  </p>
                  <p>
                    O escríbenos a{" "}
                    <a
                      href={`mailto:${CONTACT_EMAIL}?subject=Borrar%20mis%20datos`}
                      className="text-amber-400 hover:text-amber-300 underline underline-offset-4"
                    >
                      {CONTACT_EMAIL}
                    </a>{" "}
                    con el asunto &quot;Borrar mis datos&quot;.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          <Section title="8. Seguridad">
            <p>
              Usamos HTTPS en toda la plataforma, RLS (Row-Level Security) en la base de datos, y limitamos
              quién accede a los datos. Aun así, ningún sistema es 100% impenetrable — si detectas algo
              raro, repórtalo a{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-amber-400 hover:text-amber-300 underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="9. Cambios a esta política">
            <p>
              Si actualizamos esta política, cambiamos la fecha de arriba y, si es un cambio importante, lo
              avisaremos por el bot o en el sitio. Seguir usando Sabuezo después de un cambio significa que
              aceptas la nueva versión.
            </p>
          </Section>

          <Section title="10. Contacto">
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

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
      <div className="text-sm font-semibold text-amber-300">{label}</div>
      <p className="mt-1.5 text-sm text-zinc-400">{children}</p>
    </li>
  );
}

function ProviderItem({ name, purpose }: { name: string; purpose: string }) {
  return (
    <li className="flex items-start gap-3">
      <Database className="size-4 text-zinc-500 mt-1 shrink-0" />
      <div>
        <div className="text-sm font-medium text-zinc-100">{name}</div>
        <div className="text-sm text-zinc-400">{purpose}</div>
      </div>
    </li>
  );
}
