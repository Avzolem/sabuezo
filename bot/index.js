require('dotenv').config({ path: '../.env' });

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const axios = require('axios');
const { createBot } = require('./handler');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8787';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'dev-token';
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://sabuezo.com';
const AUTH_DIR = './auth';

const logger = pino({ level: 'warn' });

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 60000,
  headers: { 'x-internal-token': INTERNAL_API_TOKEN },
});

const bot = createBot({ api, publicUrl: PUBLIC_URL, logger });

// Reconexión con backoff exponencial. Sin esto, una sesión caída dispara
// miles de intentos contra WhatsApp y provoca que bloqueen el emparejamiento.
// Dos contadores distintos:
//  - failuresWithoutOpen: cierres seguidos sin llegar a conectar; al pasar
//    del máximo, el bot se detiene (PM2 no lo reinicia con código 0).
//  - backoffLevel: define la espera antes de reconectar y solo vuelve a 0 si
//    la conexión aguanta STABLE_CONNECTION_MS abierta. Antes se reiniciaba
//    en cuanto abría, y una conexión que abre y cae por timeout (408) a los
//    pocos segundos reconectaba cada 2-4 s indefinidamente.
const MAX_RECONNECT_ATTEMPTS = 10;
const STABLE_CONNECTION_MS = 2 * 60 * 1000;
let failuresWithoutOpen = 0;
let backoffLevel = 0;
let stableTimer = null;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['Sabuezo', 'Chrome', '1.0'],
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  let closed = false;
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('\n📱 Escanea este QR con WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      // Un socket solo programa una reconexión, aunque emita 'close' de nuevo.
      if (closed) return;
      closed = true;
      clearTimeout(stableTimer);
      const code = lastDisconnect?.error?.output?.statusCode;

      // Caso terminal: WhatsApp cerró la sesión. Reintentar es inútil y abusivo.
      if (code === DisconnectReason.loggedOut) {
        console.error('❌ Sesión cerrada desde WhatsApp (401). Se requiere revincular:');
        console.error('   cd bot && node link.js   (luego: pm2 restart sabuezo-bot)');
        console.error('   El bot se detiene para no saturar a WhatsApp.');
        process.exit(0);
      }

      failuresWithoutOpen += 1;
      if (failuresWithoutOpen > MAX_RECONNECT_ATTEMPTS) {
        console.error(`❌ ${MAX_RECONNECT_ATTEMPTS} reconexiones fallidas seguidas. Me detengo.`);
        process.exit(0);
      }

      backoffLevel += 1;
      const delayMs = Math.min(60000, 2000 * 2 ** (backoffLevel - 1));
      console.log(
        `⚠️  Conexión cerrada (code ${code}). Reintento ${failuresWithoutOpen}/${MAX_RECONNECT_ATTEMPTS} en ${delayMs / 1000}s`
      );
      setTimeout(() => {
        start().catch((e) => console.error('Fallo al reconectar:', e));
      }, delayMs);
    } else if (connection === 'open') {
      console.log('✅ Sabuezo conectado a WhatsApp');
      failuresWithoutOpen = 0;
      clearTimeout(stableTimer);
      stableTimer = setTimeout(() => {
        backoffLevel = 0;
      }, STABLE_CONNECTION_MS);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      bot.handleMessage(sock, msg).catch((e) => console.error('handler error:', e));
    }
  });
}

start().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
