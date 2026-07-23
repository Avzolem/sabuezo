// Script de vinculación de WhatsApp para Sabuezo.
// Uso:  node link.js                -> muestra QR
//       node link.js 526141926973   -> pide código de vinculación de 8 dígitos
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const QRImage = require('qrcode');
const pino = require('pino');

const QR_PNG = '/tmp/sabuezo-qr.png';

const AUTH_DIR = './auth';
const PHONE = (process.argv[2] || '').replace(/[^0-9]/g, '');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: process.env.LOG_LEVEL || 'silent' }),
    printQRInTerminal: false,
    browser: ['Sabuezo', 'Chrome', '1.0'],
    markOnlineOnConnect: false,
    qrTimeout: 120000,
  });

  sock.ev.on('creds.update', saveCreds);

  if (PHONE && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE);
        console.log('\n=========================================');
        console.log('  CODIGO DE VINCULACION: ' + code);
        console.log('=========================================\n');
      } catch (e) {
        console.log('ERROR_PAIRING: ' + (e && e.message));
      }
    }, 4000);
  }

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr && !PHONE) {
      console.log('\nEscanea este QR:\n');
      qrcode.generate(qr, { small: true });
      QRImage.toFile(QR_PNG, qr, { width: 512, margin: 2 })
        .then(() => console.log('QR_PNG_LISTO ' + QR_PNG + ' ts=' + process.hrtime.bigint()))
        .catch((e) => console.log('QR_PNG_ERROR ' + e.message));
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('CONEXION_CERRADA code=' + code);
      if (code !== 401) process.exit(1);
      process.exit(2);
    }
    if (connection === 'open') {
      console.log('\nVINCULADO_OK id=' + sock.user?.id + ' name=' + sock.user?.name);
      setTimeout(() => process.exit(0), 3000);
    }
  });
}

start().catch((e) => {
  console.log('FATAL: ' + e.message);
  process.exit(1);
});
