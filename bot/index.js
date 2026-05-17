require('dotenv').config({ path: '../.env' });

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8787';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'dev-token';
const AUTH_DIR = './auth';

const logger = pino({ level: 'warn' });

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 60000,
  headers: { 'x-internal-token': INTERNAL_API_TOKEN },
});

function extractText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ''
  );
}

function messageKind(msg) {
  const m = msg.message;
  if (!m) return 'unknown';
  if (m.imageMessage) return 'image';
  if (m.audioMessage) return 'audio';
  if (m.videoMessage) return 'video';
  if (m.documentMessage) return 'document';
  if (m.extendedTextMessage || m.conversation) return 'text';
  return 'unknown';
}

// Estado simple en memoria — qué usuarios están a mitad de registro
const registrationState = new Map(); // jid → 'awaiting'

const SEV_EMOJI = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: 'ℹ️' };

function formatScanResult(scan) {
  const { score, summary, findings = [], domain, raw = {} } = scan;
  const scoreEmoji = score >= 85 ? '🟢' : score >= 65 ? '🟡' : score >= 40 ? '🟠' : '🔴';

  let out = `🐕 *Diagnóstico de Seguridad — ${domain}*\n\n`;
  out += `${scoreEmoji} *Score: ${score}/100*\n`;
  out += `_${summary}_\n\n`;

  const critical = findings.filter(f => f.severity === 'critical');
  const high = findings.filter(f => f.severity === 'high');
  const medium = findings.filter(f => f.severity === 'medium');

  const topShow = [...critical, ...high, ...medium].slice(0, 4);
  if (topShow.length === 0) {
    out += `✅ No detecté problemas importantes. Bien hecho.\n\n`;
  } else {
    out += `*Hallazgos principales:*\n\n`;
    for (const f of topShow) {
      const emoji = SEV_EMOJI[f.severity] || '•';
      out += `${emoji} *${f.title}*\n`;
      out += `${f.description}\n`;
      out += `💡 _Cómo arreglarlo (${f.fix_time_min} min):_\n${f.fix}\n\n`;
    }
  }

  const totalIssues = findings.length;
  if (totalIssues > topShow.length) {
    out += `_Y ${totalIssues - topShow.length} hallazgos más. Escribe *reporte* para verlos._\n\n`;
  }

  // Cross-cutting insight si aplica
  const noSpf = !raw?.email_auth?.spf_present;
  const noDmarc = !raw?.email_auth?.dmarc_present;
  if (noSpf || noDmarc) {
    out += `🪄 *Insight clave:* Tu dominio no protege tu correo (${noSpf ? 'SPF' : 'DMARC'} ausente). Esto explica por qué tus empleados reciben tanto phishing pretendiendo ser de tu empresa.\n\n`;
  }

  out += `_Soy Sabuezo 🐕 — protegiendo PyMEs mexicanas._`;
  return out;
}

function parseRegistration(text) {
  // Acepta:
  //   - 3 líneas (nombre / url / email)
  //   - "Empresa: X / Sitio: Y / Correo: Z"
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length);
  const result = { name: null, url: null, email: null };

  const labeled = {};
  for (const l of lines) {
    const m = l.match(/^(empresa|nombre|sitio|web|url|sitio web|correo|email|mail)\s*:\s*(.+)$/i);
    if (m) {
      const key = m[1].toLowerCase();
      if (['empresa', 'nombre'].includes(key)) labeled.name = m[2].trim();
      else if (['sitio', 'web', 'url', 'sitio web'].includes(key)) labeled.url = m[2].trim();
      else if (['correo', 'email', 'mail'].includes(key)) labeled.email = m[2].trim();
    }
  }

  if (labeled.name || labeled.url || labeled.email) {
    Object.assign(result, labeled);
  } else if (lines.length >= 3) {
    // Sin etiquetas: primera línea = nombre, segunda = url, tercera = email
    result.name = lines[0];
    result.url = lines[1];
    result.email = lines[2];
  } else {
    // Heurística: detecta url y email en el texto, lo demás es nombre
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    const urlMatch = text.match(/\b((?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,})(?:\/[^\s]*)?/i);
    if (emailMatch) result.email = emailMatch[0];
    if (urlMatch) result.url = urlMatch[1];
  }

  return result;
}

function formatReply(result) {
  if (!result) return '⚠️ No pude analizar el mensaje. Inténtalo de nuevo.';

  const { risk, category, explanation, red_flags = [], recommended_action } = result;
  const emoji = risk === 'rojo' ? '🔴' : risk === 'amarillo' ? '🟡' : '🟢';
  const label =
    risk === 'rojo'
      ? 'PELIGRO — Esto parece estafa'
      : risk === 'amarillo'
      ? 'SOSPECHOSO — Ten cuidado'
      : 'PARECE SEGURO';

  let out = `${emoji} *${label}*\n\n`;
  if (category) out += `*Categoría:* ${category}\n\n`;
  if (explanation) out += `${explanation}\n\n`;
  if (red_flags.length) {
    out += `*Señales detectadas:*\n`;
    for (const f of red_flags) out += `• ${f}\n`;
    out += `\n`;
  }
  if (recommended_action) out += `👉 *Qué hacer:* ${recommended_action}\n`;
  out += `\n_Soy Sabuezo 🐕 — protegiendo PyMEs mexicanas._`;
  return out;
}

async function sendSafe(sock, jid, payload, label = '') {
  try {
    const result = await sock.sendMessage(jid, payload);
    console.log(`  → SENT [${label}] to ${jid}: id=${result?.key?.id}`);
    return result;
  } catch (err) {
    console.error(`  ✗ sendMessage FAIL [${label}] to ${jid}:`, err.message);
    throw err;
  }
}

async function handleMessage(sock, msg) {
  const jid = msg.key.remoteJid;
  const kind = messageKind(msg);
  const text = extractText(msg);

  console.log(`[${new Date().toISOString()}] ← ${jid} (${kind}): ${text.slice(0, 80)}`);
  console.log(`  msg.key=${JSON.stringify(msg.key)}  pushName=${msg.pushName || ''}`);

  // Comandos básicos
  if (kind === 'text') {
    const lower = text.trim().toLowerCase();
    if (lower === 'hola' || lower === 'hi' || lower === 'start') {
      await sendSafe(sock, jid, {
        text:
          `🐕 *Hola, soy Sabuezo*\n\n` +
          `Soy el guardián anti-estafa de tu PyME. Reenvíame:\n\n` +
          `• Mensajes sospechosos (texto)\n` +
          `• Screenshots de WhatsApp o correos\n` +
          `• Links que te preocupen\n\n` +
          `Te diré en segundos si es estafa.\n\n` +
          `Escribe *registrar* para vincular tu empresa y escanear tu sitio web.`,
      }, 'welcome');
      return;
    }
    if (lower === 'registrar' || lower === 'registro') {
      registrationState.set(jid, 'awaiting');
      await sendSafe(sock, jid, {
        text:
          `🏢 *Registro de PyME*\n\n` +
          `Mándame en un solo mensaje:\n\n` +
          `1️⃣ Nombre de tu empresa\n` +
          `2️⃣ URL de tu sitio (ej: misitio.com)\n` +
          `3️⃣ Correo del dueño/admin\n\n` +
          `Ejemplo:\n` +
          `_Papelería Don Juan_\n` +
          `_donjuan.com.mx_\n` +
          `_juan@donjuan.com.mx_`,
      }, 'registro-prompt');
      return;
    }

    // Si está en flujo de registro, intenta parsear
    if (registrationState.get(jid) === 'awaiting') {
      const reg = parseRegistration(text);
      if (!reg.url) {
        await sendSafe(sock, jid, {
          text: `Hmm, no detecté la URL de tu sitio. Mándame al menos el sitio web (ej: \`donjuan.com.mx\`) y vuelve a intentar, o escribe *cancelar*.`,
        }, 'registro-missing-url');
        return;
      }
      registrationState.delete(jid);

      // 1. Registrar PyME en Supabase
      try {
        await api.post('/pyme/register', {
          owner_jid: jid,
          name: reg.name || msg.pushName || 'PyME sin nombre',
          website: reg.url,
          owner_email: reg.email || null,
          pushname: msg.pushName || null,
        });
      } catch (err) {
        console.error('PyME register error:', err?.response?.data || err.message);
      }

      await sendSafe(sock, jid, {
        text:
          `🔍 *Analizando ${reg.url}...*\n\n` +
          `Estoy revisando SSL, headers, configuración de correo (SPF/DKIM/DMARC), CMS y archivos expuestos.\n\n` +
          `Esto toma 20-40 segundos. Te aviso cuando termine.`,
      }, 'registro-scanning');

      // 2. Disparar scan
      try {
        const scanResp = await api.post('/scan', {
          url: reg.url,
          owner_email: reg.email || null,
          user_id: jid,
          pushname: msg.pushName || null,
        }, { timeout: 90000 });
        const reply = formatScanResult(scanResp.data);
        await sendSafe(sock, jid, { text: reply }, 'scan-result');
      } catch (err) {
        console.error('Scan error:', err?.response?.data || err.message);
        await sendSafe(sock, jid, {
          text: `⚠️ No pude completar el escaneo de \`${reg.url}\`. ¿Es el dominio correcto? Vuelve a escribir *registrar* para intentar de nuevo.`,
        }, 'scan-error');
      }
      return;
    }

    if (lower === 'cancelar') {
      registrationState.delete(jid);
      await sendSafe(sock, jid, { text: 'Listo, cancelado. Escribe *hola* para empezar de nuevo.' }, 'cancel');
      return;
    }
  }

  try {
    let response;

    if (kind === 'image') {
      const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger });
      const b64 = buffer.toString('base64');
      console.log(`  ⤴ POST /analyze/image (${Math.round(buffer.length / 1024)}KB)`);
      response = await api.post('/analyze/image', {
        user_id: jid,
        image_base64: b64,
        caption: text,
        pushname: msg.pushName || null,
      });
    } else if (kind === 'text') {
      console.log(`  ⤴ POST /analyze/text`);
      response = await api.post('/analyze/text', {
        user_id: jid,
        text,
        pushname: msg.pushName || null,
      });
    } else {
      await sendSafe(sock, jid, {
        text:
          `Por ahora solo entiendo *texto* e *imágenes*. ` +
          `Si recibiste una nota de voz sospechosa, transcríbela y reenvíamela como texto.`,
      }, 'unsupported');
      return;
    }

    console.log(`  ⤵ API risk=${response.data?.risk} category="${response.data?.category}"`);
    const reply = formatReply(response.data);
    await sendSafe(sock, jid, { text: reply }, `analysis-${response.data?.risk}`);
  } catch (err) {
    console.error('Error analyzing:', err?.response?.data || err.message);
    await sendSafe(sock, jid, {
      text: '⚠️ Tuve un problema analizando esto. Intenta de nuevo en un momento.',
    }, 'error').catch(() => {});
  }
}

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

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('\n📱 Escanea este QR con WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`⚠️  Conexión cerrada (code ${code}). Reconectar: ${shouldReconnect}`);
      if (shouldReconnect) start();
    } else if (connection === 'open') {
      console.log('✅ Sabuezo conectado a WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      handleMessage(sock, msg).catch((e) => console.error('handler error:', e));
    }
  });
}

start().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
