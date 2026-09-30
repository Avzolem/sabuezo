import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sabuezo — ¿Tus datos andan sueltos por internet?",
  description:
    "Revisa gratis si tu correo, número o contraseña aparecen en filtraciones públicas. Sin registrarte. Sabuezo también escanea la seguridad de tu sitio web y detecta estafas por WhatsApp.",
  metadataBase: new URL("https://sabuezo.com"),
  openGraph: {
    title: "Sabuezo — ¿Tus datos andan sueltos por internet?",
    description:
      "Revisa gratis si tu correo, número o contraseña aparecen en filtraciones públicas. Sin registrarte.",
    url: "https://sabuezo.com",
    siteName: "Sabuezo",
    locale: "es",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sabuezo — ¿Tus datos andan sueltos por internet?",
    description: "Revisa gratis si tu correo, número o contraseña aparecen en filtraciones públicas.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={geist.variable}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
