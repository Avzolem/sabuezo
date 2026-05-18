# Sabuezo 🐕

> El sabueso que olfatea estafas por tu negocio.
>
> **Bot WhatsApp anti-fraude + diagnóstico de seguridad para PyMEs mexicanas.**

🌐 **Live demo**: <https://sabuezo.com>
📱 **Bot WhatsApp**: `+52 1 614 216 6179`
🎯 **Track**: DEF/ACC · hack@latam 2026 · indies.la

---

## ¿Qué resuelve?

México tiene **4.9 millones de PyMEs**. El 99.8% del tejido empresarial. Generan 7 de cada 10 empleos.
**Ninguna tiene equipo de ciberseguridad.** El 60% sufrirá un ciberataque este año.

Sabuezo le da a cada papelería, restaurante, taller y consultorio el mismo nivel de defensa
que una empresa Fortune 500 — por WhatsApp, sin contratar a nadie.

Combina **dos defensas que ningún otro producto en LATAM conecta entre sí**:

1. **Bot WhatsApp anti-phishing** — Reenvía mensajes sospechosos, screenshots o correos. Análisis con
   IA en segundos, entrenado contra estafas mexicanas reales (SAT, BBVA, Banamex, fraude del proveedor,
   secuestro virtual, CEO fraud, smishing).
2. **Diagnóstico de seguridad del sitio web** — Escaneo automático: SSL, headers, configuración de
   correo (SPF/DKIM/DMARC), CMS, archivos expuestos. Reporte ejecutivo en español plano.

### El insight cross-cutting

Si tu dominio tiene SPF/DMARC mal configurados, **cualquiera puede mandar correos pretendiendo ser
tu empresa**. Eso explica por qué tu equipo recibe tanto phishing falsificando direcciones de tu propia
organización. Sabuezo conecta los dos puntos: **el ataque entrando Y la puerta abierta saliendo**.

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│              Usuario final (PyME)                        │
└─────────┬───────────────────────────┬────────────────────┘
          │ WhatsApp                  │ Browser
          ▼                           ▼
┌──────────────────┐         ┌──────────────────┐
│  Bot Baileys     │         │  Next.js 16      │
│  FastAPI         │         │  sabuezo.vercel  │
│  Site Scanner    │         │  + /api/scan     │
│  (self-hosted)   │         │  + Cloudflared   │
└────────┬─────────┘         └────────┬─────────┘
         │ writes                     │ reads
         ▼                            ▼
       ┌─────────────────────────────────────┐
       │       Supabase Postgres             │
       │   pymes · scans · detections        │
       └─────────────────────────────────────┘
                    │
                    ▼
              ┌──────────────┐
              │  Anthropic   │
              │ Haiku+Sonnet │
              └──────────────┘
```

### Stack

- **Bot WhatsApp**: Node.js + [Baileys](https://github.com/WhiskeySockets/Baileys) (multi-device, sin
  navegador, self-hosted)
- **Backend**: Python + FastAPI · async pipelines
- **LLMs**: Claude **Haiku 4.5** (texto) + **Sonnet 4.6** (vision sobre screenshots)
- **DB**: Supabase Postgres con RLS · 3 tablas + 1 vista (`pyme_overview`)
- **Frontend**: Next.js 16 (App Router) + Tailwind v4 + lucide-react
- **Deploy**: Vercel (front) · self-host bot+backend · Cloudflared quick-tunnel para exponer API
- **Persistencia**: bot+backend escriben con `service_role`; frontend lee con `publishable` key

### Lo que el Site Scanner detecta

- 🔒 SSL/TLS: validez, expiración, emisor
- 🛡️ Security headers: HSTS, CSP, X-Frame, X-Content-Type-Options, Referrer-Policy
- 📧 Email auth: **SPF, DKIM, DMARC** (incluye política `p=`)
- 🧩 CMS fingerprinting: WordPress, Wix, Shopify, Drupal, Joomla, Squarespace, Next, Express
- 📂 Archivos expuestos: `.env`, `.git/HEAD`, `/wp-admin`, `/phpmyadmin`, backups, `.htaccess`
- 📅 Edad del dominio (WHOIS)
- 🏷️ Score 0-100 + reporte con cómo arreglar cada hallazgo

### Lo que el Bot detecta

- Suplantación SAT / CFDI / Buzón Tributario
- Suplantación de bancos MX (BBVA, Banamex, Santander, Banorte, HSBC, Banco Azteca, Inbursa)
- Fraude del proveedor (BEC — cambio de cuenta bancaria)
- CEO fraud / suplantación de dirección
- Robo de cuenta WhatsApp (OTP scams)
- Falsas paqueterías (Mercado Libre, DHL, FedEx, Estafeta)
- Falsos cobros de servicios (CFE, Telmex, Megacable)
- Secuestro virtual / extorsión empresarial
- Cripto-estafas, romance scams, falsas ofertas de trabajo
- Typosquatting en URLs

Análisis multimodal: **texto, URLs y screenshots** (imágenes).

---

## Estructura del repo

```
sabuezo/
├── README.md
├── .gitignore
├── .env.example          # template de variables
├── bot/                  # Bot WhatsApp (Node + Baileys)
│   ├── package.json
│   └── index.js
├── backend/              # API y análisis (Python + FastAPI)
│   ├── requirements.txt
│   ├── main.py
│   ├── db.py             # cliente Supabase
│   ├── analyzers/
│   │   ├── text.py       # Claude Haiku + heurísticas MX
│   │   ├── image.py      # Claude Sonnet vision
│   │   ├── url.py        # typosquatting + WHOIS + TLD
│   │   └── scanner.py    # site security scanner
│   └── data/
│       └── corpus.json   # corpus de estafas mexicanas
├── frontend/             # Next.js 16 (deployado en Vercel)
│   ├── app/
│   │   ├── page.tsx              # landing
│   │   ├── escanear/page.tsx     # escáner público
│   │   ├── p/[id]/page.tsx       # dashboard PyME
│   │   ├── api/scan/route.ts     # proxy server-only al backend
│   │   ├── icon.png              # favicon
│   │   ├── apple-icon.png
│   │   └── opengraph-image.png
│   └── lib/
└── scripts/              # Helpers (schema migration, tests)
    ├── 01_schema.sql
    └── apply_schema.py
```

---

## Cómo correrlo

### Prerequisitos

- Node 18+ y npm
- Python 3.11+
- Cuenta de Anthropic (API key)
- Proyecto en Supabase (URL + service key + publishable key)
- Un número de WhatsApp dedicado para el bot

### 1. Setup

```bash
git clone https://github.com/Avzolem/sabuezo.git
cd sabuezo
cp .env.example .env
# Edita .env con tus keys
```

### 2. Schema en Supabase

```bash
# Pega scripts/01_schema.sql en el SQL Editor de Supabase
# o usa:
SUPABASE_DB_PASSWORD="..." python3 scripts/apply_schema.py
```

### 3. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py          # corre en :8787
```

### 4. Bot WhatsApp

```bash
cd bot
npm install
npm start
# Escanea el QR con tu número de WhatsApp dedicado
```

### 5. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # rellena con NEXT_PUBLIC_* vars
npm install
npm run dev   # corre en :3000
```

### Deploy a producción

- **Bot + Backend**: corre en cualquier servidor Linux con `pm2`. Exponer backend vía Cloudflare Tunnel
  (`cloudflared tunnel --url http://localhost:8787`) o named tunnel para URL permanente.
- **Frontend**: deploy a Vercel (`vercel --prod`). Configura env vars en el dashboard de Vercel
  incluyendo `INTERNAL_API_URL` (tunnel URL) e `INTERNAL_API_TOKEN`.

---

## Por qué este enfoque

- **WhatsApp es donde vive la gente en LATAM**, no apps que tienen que instalar
- **Multimodal**: la gente reenvía screenshots, voice notes, capturas — no solo texto
- **Detección semántica** vs reglas: Claude lee patrones que regex no captan (acentos faltantes,
  ausencia de últimos 4 dígitos en alertas "BBVA", etc.)
- **Contexto mexicano**: SAT, CFDI, bancos locales, modismos. Los detectores genéricos en inglés
  no sirven aquí
- **Cross-cutting insight**: el primer producto de su tipo que enlaza phishing recibido con configuración
  de correo del dominio para explicar el origen

---

## Hackathon

Proyecto construido para [hack@latam 2026](https://hack.indies.la/) (15-17 mayo, indies.la), track
**DEF/ACC**. Construido por [Andrés Aguilar](https://github.com/Avzolem) en 24 horas.

## Licencia

MIT — úsalo, fórkalo, mejóralo.
