import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sabuezo — Protección anti-estafa para PyMEs mexicanas",
  description:
    "Bot WhatsApp + escaneo de seguridad de tu sitio para PyMEs. Detecta phishing, suplantación SAT, fraude del proveedor y vulnerabilidades web.",
  metadataBase: new URL("https://sabuezo.vercel.app"),
  openGraph: {
    title: "Sabuezo 🐕 — Anti-estafa para PyMEs",
    description:
      "Bot WhatsApp + escaneo de seguridad de tu sitio. Detecta phishing, suplantación SAT, fraude del proveedor y vulnerabilidades web.",
    url: "https://sabuezo.vercel.app",
    siteName: "Sabuezo",
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sabuezo 🐕 — Anti-estafa para PyMEs",
    description: "Protección anti-estafa por WhatsApp + diagnóstico de seguridad para PyMEs mexicanas.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
