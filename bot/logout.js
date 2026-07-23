// Cierra la sesión actual de WhatsApp de forma limpia (la elimina también del
// teléfono, en Dispositivos vinculados) y borra las credenciales locales.
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');

const AUTH_DIR = './auth';

async function main() {
  if (!fs.existsSync(AUTH_DIR)) {
    console.log('No hay sesión local que cerrar.');
    return;
  }
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  console.log('Cerrando sesión de:', state.creds.me?.id || '(desconocida)');

  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Sabuezo', 'Chrome', '1.0'],
    markOnlineOnConnect: false,
  });
  sock.ev.on('creds.update', saveCreds);

  const done = new Promise((resolve) => {
    sock.ev.on('connection.update', async (u) => {
      if (u.connection === 'open') {
        try {
          await sock.logout();
          console.log('LOGOUT_OK: sesión cerrada en WhatsApp.');
        } catch (e) {
          console.log('LOGOUT_ERROR: ' + e.message);
        }
        resolve();
      }
      if (u.connection === 'close') resolve();
    });
  });

  await Promise.race([done, new Promise((r) => setTimeout(r, 30000))]);
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  console.log('Credenciales locales borradas.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Fallo:', e.message);
  process.exit(1);
});
