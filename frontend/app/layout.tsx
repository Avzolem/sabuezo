import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sabuezo — Democratizando la ciberseguridad para Latinoamérica",
  description:
    "Bot WhatsApp + escaneo de seguridad para las 32M de PyMEs de LATAM. Detecta phishing, suplantación de bancos y agencias tributarias, fraude del proveedor y vulnerabilidades web.",
  metadataBase: new URL("https://sabuezo.com"),
  openGraph: {
    title: "Sabuezo 🐕 — Anti-estafa para PyMEs de LATAM",
    description:
      "Democratizando la ciberseguridad para Latinoamérica. Bot WhatsApp + diagnóstico de seguridad para PyMEs.",
    url: "https://sabuezo.com",
    siteName: "Sabuezo",
    locale: "es",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sabuezo 🐕 — Anti-estafa para PyMEs de LATAM",
    description: "Democratizando la ciberseguridad para Latinoamérica.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
