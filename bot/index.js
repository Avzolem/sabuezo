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
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://sabuezo.com';
const AUTH_DIR = './auth';

const logger = pino({ level: 'warn' });

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 60000,
  headers: { 'x-internal-token': INTERNAL_API_TOKEN },
});

// ─────────────────────────────────────────────────────────────
// Comportamiento "humano" para evitar la detección de automatización
// de WhatsApp: lecturas, "escribiendo…", delays y throttle global.
// ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.floor(min + Math.random() * (max - min));
const pick = (arr) => arr[rand(0, arr.length)];

// Gap mínimo entre dos envíos cualesquiera, con jitter: un período fijo
// (p. ej. siempre 2.5 s) es en sí mismo un patrón detectable.
const GAP_MIN_MS = 2200;
const GAP_MAX_MS = 4800;
let _lastSendAt = 0;
let _sendChain = Promise.resolve(); // serializa todos los envíos (anti-ráfaga)

// ─────────────────────────────────────────────────────────────
// Rate-limit por destinatario: evita que un mismo número — sobre todo
// uno nuevo — nos haga emitir un volumen anómalo de mensajes en un día,
// que es justo el patrón que dispara restricciones de WhatsApp.
// (Estado en memoria; se reinicia si se reinicia el proceso.)
// ─────────────────────────────────────────────────────────────
const DAILY_SEND_LIMIT = 40;   // máx. respuestas a un contacto establecido / día
const NEW_CONTACT_LIMIT = 20;  // límite más estricto para contactos de su primer día
const _sendCounters = new Map(); // jid → { day, count, firstSeenDay }
const _limitNotified = new Set(); // jids ya avisados de su límite hoy

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Registra un envío hacia jid y devuelve true si todavía estamos por debajo
// del límite diario. Contactos vistos por primera vez hoy tienen un tope menor.
function canSendTo(jid) {
  const day = todayKey();
  let rec = _sendCounters.get(jid);
  if (!rec || rec.day !== day) {
    const firstSeenDay = rec?.firstSeenDay || day; // preserva el primer día visto
    rec = { day, count: 0, firstSeenDay };
    _sendCounters.set(jid, rec);
    _limitNotified.delete(jid);
  }
  const isNewContact = rec.firstSeenDay === day;
  const limit = isNewContact ? NEW_CONTACT_LIMIT : DAILY_SEND_LIMIT;
  if (rec.count >= limit) return false;
  rec.count += 1;
  return true;
}

async function markReadSafe(sock, msg) {
  try {
    await sock.readMessages([msg.key]);
  } catch {
    /* no crítico */
  }
}

async function humanTyping(sock, jid, textLen = 0) {
  // muestra "escribiendo…" un tiempo variable, no proporcional fijo
  try {
    await sock.sendPresenceUpdate('composing', jid);
  } catch {
    /* no crítico */
  }
  const think = rand(900, 3400); // pausa de "lectura/pensar" antes de teclear
  const write = Math.min(textLen * rand(14, 26), rand(3500, 5500)); // velocidad de tecleo variable
  const distracted = Math.random() < 0.15 ? rand(1500, 4500) : 0; // de vez en cuando se "distrae"
  await sleep(think + write + distracted);
  try {
    await sock.sendPresenceUpdate('paused', jid);
  } catch {
    /* no crítico */
  }
}

// Mensaje de bienvenida con saludo variado: evita mandar texto idéntico
// a muchos usuarios (señal típica de bot).
const WELCOME_GREETINGS = [
  '🐕 *Hola, soy Sabuezo*',
  '🐕 *¡Hey! Soy Sabuezo*',
  '🐕 *Qué tal, soy Sabuezo*',
  '🐕 *Hola 👋 soy Sabuezo*',
  '🐕 *Buenas, soy Sabuezo*',
];

// Spintax del cuerpo del saludo. El mensaje de bienvenida es lo que más se
// envía: si el bloque entero sale idéntico cada vez, es una huella de bot.
// Rotamos intro, subtítulos, ejemplos (subconjunto barajado) y cierre.
const WELCOME_INTROS = [
  'Soy el guardián anti-estafa de las PyMEs de LATAM. *No soy un chat* — soy un detector. Reenvíame solo cosas sospechosas.',
  'Soy tu detector anti-fraude para PyMEs de LATAM. *No platico* — analizo. Mándame solo lo que te huela raro.',
  'Cuido a las PyMEs de LATAM contra las estafas. *No soy un asistente de chat*, soy un radar de fraudes. Reenvíame lo sospechoso.',
  'Mi trabajo es olfatear estafas para las PyMEs de LATAM. *No converso* — investigo. Pásame solo lo que te parezca raro.',
];

const WELCOME_EXAMPLE_HEADERS = [
  '*📩 Ejemplos de lo que detecto:*',
  '*📩 Esto es lo que cazo:*',
  '*📩 Cosas que puedo revisar por ti:*',
  '*📩 Algunas trampas que reconozco:*',
];

const WELCOME_EXAMPLES_POOL = [
  '🏛️ _"Su factura del SAT está vencida, pague aquí: bit.ly/sat-pago..."_',
  '🏦 _"BBVA: detectamos actividad sospechosa, verifica tu cuenta..."_',
  '📦 _"Soy el nuevo proveedor, te paso mi nueva CLABE para el depósito..."_',
  '📞 _"Tu hijo está secuestrado, deposita ya o..."_',
  '💼 _"Felicidades, fuiste seleccionado para una vacante, solo deposita..."_',
];

const WELCOME_CLOSERS = ['*Comandos rápidos:*', '*Atajos:*', '*También puedo:*'];

// Devuelve n elementos al azar de un arreglo (Fisher-Yates parcial).
const sample = (arr, n) => {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = rand(0, i + 1);
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c.slice(0, n);
};

// Firma variada: el mismo pie de página idéntico en cada respuesta es,
// por sí solo, una huella de bot. Rotamos entre varias redacciones.
const SIGNATURES = [
  '_Soy Sabuezo 🐕 — democratizando la ciberseguridad para LATAM._',
  '_Sabuezo 🐕 — ciberseguridad al alcance de toda PyME._',
  '_Soy Sabuezo 🐕, tu guardián anti-estafa en LATAM._',
  '_Sabuezo 🐕 — protegiendo a las PyMEs de LATAM, una estafa menos._',
  '_Cuídate 🐕 — Sabuezo, ciberseguridad para LATAM._',
];
const signature = () => pick(SIGNATURES);

// Mensaje "estoy buscando…" variado para no repetir texto idéntico.
function searchingMsg(target) {
  return pick([
    `🔍 Buscando *${target}* en filtraciones públicas…`,
    `🔎 Déjame revisar *${target}* en las bases de datos filtradas…`,
    `🐕 Rastreando *${target}*… dame unos segundos.`,
    `🔍 Reviso si *${target}* aparece en alguna fuga de datos…`,
  ]);
}

function welcomeMessage() {
  const greeting = pick(WELCOME_GREETINGS);
  const intro = pick(WELCOME_INTROS);
  const exHeader = pick(WELCOME_EXAMPLE_HEADERS);
  // 3 ejemplos barajados del pool + la línea de screenshots siempre al final.
  const examples = sample(WELCOME_EXAMPLES_POOL, 3);
  const closer = pick(WELCOME_CLOSERS);
  return (
    `${greeting}\n\n` +
    `${intro}\n\n` +
    `${exHeader}\n\n` +
    examples.join('\n\n') +
    `\n\n🖼️ Screenshots de mensajes o correos raros que recibiste.\n\n` +
    `${closer}\n` +
    `• *registrar* — Vincula tu PyME y escanea tu sitio\n` +
    `• *correo tucorreo@dominio.com* — Revisa si está filtrado\n` +
    `• *numero 5512345678* — Revisa si tu número fue filtrado\n` +
    `• *ayuda* — Ver todos mis comandos`
  );
}

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

// Convierte el score 0-100 en una "boleta" A-F (estilo Mozilla Observatory),
// legible para una PyME sin jerga técnica.
function gradeFor(score) {
  if (score >= 90) return { letra: 'A', emoji: '🟢', frase: 'Excelente — tu sitio está bien protegido' };
  if (score >= 80) return { letra: 'B', emoji: '🟢', frase: 'Bien — solo un par de detalles por pulir' };
  if (score >= 65) return { letra: 'C', emoji: '🟡', frase: 'Regular — hay huecos que conviene cerrar' };
  if (score >= 50) return { letra: 'D', emoji: '🟠', frase: 'Deficiente — tu sitio tiene riesgos serios' };
  return { letra: 'F', emoji: '🔴', frase: 'Reprobado — necesita atención urgente' };
}

function formatScanResult(scan) {
  const { score, summary, findings = [], domain, raw = {} } = scan;
  const g = gradeFor(score);

  let out = `🐕 *Diagnóstico de Seguridad — ${domain}*\n\n`;
  out += `${g.emoji} *Calificación: ${g.letra}*  ·  ${score}/100\n`;
  out += `_${g.frase}._\n`;
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

  out += signature();
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

  const { risk, category, explanation, red_flags = [], recommended_action, cross_insight } = result;
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
  if (risk === 'rojo') {
    out += `\n📢 *Repórtalo — proteges a otros:*\n`;
    out += `• *CONDUSEF:* 55 53 400 999 · condusef.gob.mx\n`;
    out += `• *Policía Cibernética* (Guardia Nacional): 088 · CERT-MX\n`;
  }
  if (cross_insight?.message) {
    out += `\n🪄 *Insight de tu dominio:*\n${cross_insight.message}\n`;
    out += `Escribe *reporte* para ver tu diagnóstico de seguridad.\n`;
  }
  out += `\n${signature()}`;
  return out;
}

function formatFullReport(scan) {
  const { score, summary, findings = [], domain } = scan;
  const g = gradeFor(score);

  let out = `🐕 *Reporte completo — ${domain}*\n\n`;
  out += `${g.emoji} *Calificación: ${g.letra}*  ·  ${score}/100\n_${g.frase}._\n_${summary}_\n\n`;

  if (findings.length === 0) {
    out += `✅ Sin hallazgos. Tu sitio está bien protegido.\n`;
    return out;
  }

  const order = ['critical', 'high', 'medium', 'low', 'info'];
  const labels = { critical: 'Crítico', high: 'Alto', medium: 'Medio', low: 'Bajo', info: 'Informativo' };

  for (const sev of order) {
    const items = findings.filter(f => f.severity === sev);
    if (items.length === 0) continue;
    out += `*${SEV_EMOJI[sev]} ${labels[sev]} (${items.length})*\n\n`;
    for (const f of items) {
      out += `• *${f.title}*\n${f.description}\n💡 _Cómo arreglarlo (${f.fix_time_min} min):_\n${f.fix}\n\n`;
    }
  }
  return out;
}

function helpMessage() {
  return (
    `🐕 *Sabuezo — Guía rápida*\n\n` +
    `Cosas que puedo hacer:\n\n` +
    `🔍 *Análisis anti-estafa*\n` +
    `Reenvíame cualquier mensaje, link o screenshot sospechoso. ` +
    `Te digo en segundos si es phishing.\n\n` +
    `🏢 *registrar* — Vincula tu PyME y escaneo tu sitio web.\n` +
    `📋 *reporte* — Reporte completo de seguridad de tu sitio.\n` +
    `📊 *dashboard* — Link a tu panel ejecutivo.\n` +
    `📧 *correo <email>* — ¿Tu correo está en una filtración?\n` +
    `📱 *numero <tel>* — ¿Tu número está en una filtración?\n` +
    `❌ *cancelar* — Cancela el flujo actual.\n` +
    `❓ *ayuda* — Vuelve a mostrar esta guía.\n\n` +
    `_Tip: también puedes mandarme directamente un correo o número y lo reviso._`
  );
}

function formatEmailBreach(email, data) {
  if (!data.ok) {
    return `⚠️ No pude verificar *${email}* ahora mismo. Intenta en un momento.`;
  }
  if (!data.found) {
    return (
      `🟢 *${email}*\n\n` +
      `Buenas noticias: no aparece en filtraciones públicas conocidas.\n\n` +
      `Esto _no_ garantiza que esté 100% seguro — los criminales también usan listas privadas. ` +
      `Pero si tu correo no está en breaches públicos, tienes mucho menos spam y phishing dirigido.\n\n` +
      `👉 Mantén tu contraseña única para este correo y activa 2FA donde puedas.`
    );
  }
  const top = (data.breaches || []).slice(0, 6);
  let out = `🔴 *${email} está en ${data.count} filtración${data.count === 1 ? '' : 'es'}*\n\n`;
  out += `Aparece en estos breaches públicos:\n`;
  for (const b of top) out += `• ${b}\n`;
  if (data.count > top.length) out += `_…y ${data.count - top.length} más._\n`;
  out += `\n*Qué hacer ahora mismo:*\n`;
  out += `1️⃣ Cambia la contraseña de este correo y de cualquier servicio donde uses la misma.\n`;
  out += `2️⃣ Activa autenticación de dos pasos (2FA) en tu correo.\n`;
  out += `3️⃣ Espera más phishing dirigido — los criminales ya tienen tu dirección.\n`;
  out += `4️⃣ Si reciben "factura de proveedor" desde un correo parecido al tuyo, asume estafa.\n`;
  return out;
}

function formatPhoneBreach(phone, data) {
  if (!data.ok) {
    if (data.error === 'rate_limited') {
      return `⏳ Demasiadas consultas a la base de filtraciones. Inténtalo en 1-2 minutos.`;
    }
    return `⚠️ No pude verificar *${phone}* ahora mismo. Intenta en un momento.`;
  }
  if (!data.found) {
    return (
      `🟢 *${phone}*\n\n` +
      `No aparece en filtraciones públicas conocidas.\n\n` +
      `Mantente atento a llamadas y SMS desconocidos. Si alguien se hace pasar por banco/SAT, ` +
      `cuelga y márcale tú al número oficial — nunca al que te llamó.`
    );
  }
  const top = (data.sources || []).slice(0, 6);
  const fields = (data.fields || []).slice(0, 8).join(', ');
  let out = `🔴 *${phone} está en ${data.count} fuga${data.count === 1 ? '' : 's'} de datos*\n\n`;
  if (top.length) {
    out += `Fuentes (las primeras):\n`;
    for (const s of top) {
      const dateStr = s.date ? ` (${s.date})` : '';
      out += `• ${s.name}${dateStr}\n`;
    }
    if (data.count > top.length) out += `_…y ${data.count - top.length} más._\n`;
  }
  if (fields) out += `\n*Datos expuestos junto a tu número:* ${fields}\n`;
  out += `\n*Qué hacer ahora:*\n`;
  out += `1️⃣ Asume que cualquier llamada o SMS de "tu banco" o "el SAT" puede ser estafa dirigida.\n`;
  out += `2️⃣ Nunca des códigos de WhatsApp/SMS por teléfono, _nunca_.\n`;
  out += `3️⃣ Activa 2FA en tu correo y banca (de preferencia con app, no SMS).\n`;
  out += `4️⃣ Si recibes mensajes de "secuestro virtual", cuelga y verifica directamente.\n`;
  return out;
}

async function sendSafe(sock, jid, payload, label = '') {
  // Rate-limit por destinatario: si este jid ya superó su tope diario,
  // no respondemos más (salvo un único aviso). El propio aviso se exime.
  if (label !== 'rate-limit' && !canSendTo(jid)) {
    if (!_limitNotified.has(jid)) {
      _limitNotified.add(jid);
      return sendSafe(sock, jid, {
        text:
          `🐕 Por hoy llegamos al límite de consultas para este chat. ` +
          `Vuelve mañana y seguimos — es una medida para mantener el servicio sano para todos.`,
      }, 'rate-limit');
    }
    console.log(`  ⏸ rate-limited [${label}] to ${jid} (sin enviar)`);
    return null;
  }

  // Serializa todos los envíos en una cadena global: nunca salen en ráfaga.
  // Cada envío respeta un gap mínimo (con jitter) y simula "escribiendo…".
  const run = async () => {
    const gap = rand(GAP_MIN_MS, GAP_MAX_MS);
    const wait = gap - (Date.now() - _lastSendAt);
    if (wait > 0) await sleep(wait);

    const textLen = (payload?.text || payload?.caption || '').length;
    await humanTyping(sock, jid, textLen);

    try {
      const result = await sock.sendMessage(jid, payload);
      _lastSendAt = Date.now();
      console.log(`  → SENT [${label}] to ${jid}: id=${result?.key?.id}`);
      return result;
    } catch (err) {
      _lastSendAt = Date.now();
      console.error(`  ✗ sendMessage FAIL [${label}] to ${jid}:`, err.message);
      throw err;
    }
  };

  // encadena (recuperándose de errores previos para no romper la cola)
  _sendChain = _sendChain.then(run, run);
  return _sendChain;
}

// Captura el mapeo @lid → teléfono real cuando WhatsApp expone sender_pn.
// WhatsApp solo lo incluye en algunos mensajes (típicamente primer contacto o
// cuando no estás guardado). Es fire-and-forget: nunca bloquea ni rompe el flujo.
const _lidSeen = new Set(); // evita reenviar el mismo lid en la misma sesión
function captureLidMapping(msg) {
  try {
    const k = msg.key || {};
    const remote = k.remoteJid || '';
    const phoneJid = k.senderPn; // '...@s.whatsapp.net' cuando está disponible
    if (!remote.endsWith('@lid') || !phoneJid) return;
    if (_lidSeen.has(remote)) return;
    _lidSeen.add(remote);
    api
      .post('/lid-map', {
        lid: remote,
        phone_jid: phoneJid,
        pushname: msg.pushName || null,
      })
      .then(() => console.log(`  🔗 lid-map ${remote} → ${phoneJid}`))
      .catch((err) => {
        _lidSeen.delete(remote); // permite reintentar en el próximo mensaje
        console.error('  lid-map error:', err?.response?.data || err.message);
      });
  } catch (err) {
    console.error('  captureLidMapping error:', err.message);
  }
}

async function handleMessage(sock, msg) {
  const jid = msg.key.remoteJid;
  const kind = messageKind(msg);
  const text = extractText(msg);

  console.log(`[${new Date().toISOString()}] ← ${jid} (${kind}): ${text.slice(0, 80)}`);
  console.log(`  msg.key=${JSON.stringify(msg.key)}  pushName=${msg.pushName || ''}`);

  // Captura el teléfono real detrás del @lid si WhatsApp lo expone (no bloquea).
  captureLidMapping(msg);

  // Marca el mensaje entrante como leído (palomita azul), como haría un humano.
  await markReadSafe(sock, msg);

  // Comandos básicos
  if (kind === 'text') {
    const lower = text.trim().toLowerCase();
    if (lower === 'hola' || lower === 'hi' || lower === 'start') {
      await sendSafe(sock, jid, { text: welcomeMessage() }, 'welcome');
      return;
    }
    if (lower === 'ayuda' || lower === 'help' || lower === 'menu' || lower === 'menú') {
      await sendSafe(sock, jid, { text: helpMessage() }, 'help');
      return;
    }
    if (lower === 'reporte' || lower === 'report') {
      try {
        const r = await api.get(`/pyme/by-jid/${encodeURIComponent(jid)}/last-scan`);
        if (!r.data.ok || !r.data.scan) {
          await sendSafe(sock, jid, {
            text:
              `Aún no tengo un escaneo de tu sitio. Escribe *registrar* para vincular tu PyME y escanear tu web.`,
          }, 'report-empty');
          return;
        }
        const reply = formatFullReport(r.data.scan);
        await sendSafe(sock, jid, { text: reply }, 'report-full');
        const pymeId = r.data.pyme?.id;
        if (pymeId) {
          await sendSafe(sock, jid, {
            text: `📊 Panel ejecutivo: ${PUBLIC_URL}/p/${pymeId}`,
          }, 'report-dashboard');
        }
      } catch (err) {
        console.error('Report error:', err?.response?.data || err.message);
        await sendSafe(sock, jid, {
          text: `⚠️ No pude traer tu reporte. Intenta de nuevo en un momento.`,
        }, 'report-error');
      }
      return;
    }
    if (lower === 'dashboard' || lower === 'panel') {
      try {
        const r = await api.get(`/pyme/by-jid/${encodeURIComponent(jid)}/last-scan`);
        const pymeId = r.data.ok ? r.data.pyme?.id : null;
        if (!pymeId) {
          await sendSafe(sock, jid, {
            text: `Aún no estás registrado. Escribe *registrar* para crear tu panel.`,
          }, 'dashboard-empty');
          return;
        }
        await sendSafe(sock, jid, {
          text: `📊 *Tu panel ejecutivo*\n\n${PUBLIC_URL}/p/${pymeId}\n\nAhí puedes ver tus escaneos, hallazgos y el histórico.`,
        }, 'dashboard-link');
      } catch (err) {
        console.error('Dashboard error:', err?.response?.data || err.message);
        await sendSafe(sock, jid, {
          text: `⚠️ No pude traer tu panel. Intenta de nuevo en un momento.`,
        }, 'dashboard-error');
      }
      return;
    }
    // ─────────────── Chequeo de filtraciones ───────────────
    // Si el usuario está en flujo de registro, saltamos esto para no desviar
    // su email/teléfono al chequeo de breaches.
    const inRegistration = registrationState.get(jid) === 'awaiting';
    const emailInText = inRegistration ? null : text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    const phoneInText = inRegistration ? null : text.match(/(?:\+?\d[\d\s().-]{8,16}\d)/);
    const textIsOnlyEmail = !!emailInText && text.trim() === emailInText[0];
    const textIsOnlyPhone =
      !!phoneInText && text.trim() === phoneInText[0] && /\d{8,}/.test(text.replace(/\D/g, ''));

    const correoCmd = inRegistration ? null : lower.match(/^(?:correo|email|mail)\s+(.+)$/i);
    const numeroCmd = inRegistration ? null : lower.match(/^(?:numero|número|tel|telefono|teléfono|celular)\s+(.+)$/i);
    const bareCorreo = !inRegistration && (lower === 'correo' || lower === 'email' || lower === 'mail');
    const bareNumero = !inRegistration && (
      lower === 'numero' || lower === 'número' || lower === 'tel' ||
      lower === 'telefono' || lower === 'teléfono' || lower === 'celular');

    async function ownerEmailFromPyme() {
      try {
        const r = await api.get(`/pyme/by-jid/${encodeURIComponent(jid)}/last-scan`);
        return r.data.ok ? (r.data.pyme?.owner_email || null) : null;
      } catch { return null; }
    }

    if (correoCmd || (bareCorreo) || textIsOnlyEmail) {
      let target = correoCmd ? correoCmd[1].trim() : (textIsOnlyEmail ? emailInText[0] : null);
      if (!target && bareCorreo) target = await ownerEmailFromPyme();
      if (!target) {
        await sendSafe(sock, jid, {
          text: `Mándame el correo así: *correo tucorreo@ejemplo.com* — o regístrate primero con *registrar* y lo recuerdo.`,
        }, 'breach-email-missing');
        return;
      }
      await sendSafe(sock, jid, { text: searchingMsg(target) }, 'breach-email-start');
      try {
        const r = await api.post('/check/email', { user_id: jid, value: target });
        await sendSafe(sock, jid, { text: formatEmailBreach(target, r.data) }, 'breach-email-result');
      } catch (err) {
        console.error('Email check error:', err?.response?.data || err.message);
        await sendSafe(sock, jid, { text: `⚠️ No pude verificar el correo. Intenta de nuevo en un momento.` }, 'breach-email-error');
      }
      return;
    }

    if (numeroCmd || bareNumero || textIsOnlyPhone) {
      let target = numeroCmd ? numeroCmd[1].trim() : (textIsOnlyPhone ? phoneInText[0] : null);
      if (!target && bareNumero) {
        // Si no dio número, usamos el JID (WhatsApp ya es un número)
        target = jid.replace(/@.*$/, '').replace(/[^0-9]/g, '');
      }
      if (!target) {
        await sendSafe(sock, jid, {
          text: `Mándame el número así: *numero 5512345678* — incluye lada internacional si no es México (+52, +57, +54, +56, +51, +593…).`,
        }, 'breach-phone-missing');
        return;
      }
      await sendSafe(sock, jid, { text: searchingMsg(target) }, 'breach-phone-start');
      try {
        const r = await api.post('/check/phone', { user_id: jid, value: target });
        await sendSafe(sock, jid, { text: formatPhoneBreach(target, r.data) }, 'breach-phone-result');
      } catch (err) {
        console.error('Phone check error:', err?.response?.data || err.message);
        await sendSafe(sock, jid, { text: `⚠️ No pude verificar el número. Intenta de nuevo en un momento.` }, 'breach-phone-error');
      }
      return;
    }
    // ─────────────── fin chequeo de filtraciones ───────────────

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
      let pymeId = null;
      try {
        const regResp = await api.post('/pyme/register', {
          owner_jid: jid,
          name: reg.name || msg.pushName || 'PyME sin nombre',
          website: reg.url,
          owner_email: reg.email || null,
          pushname: msg.pushName || null,
        });
        pymeId = regResp.data?.pyme?.id || null;
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
        if (pymeId) {
          await sendSafe(sock, jid, {
            text:
              `📊 *Tu panel ejecutivo está listo*\n\n${PUBLIC_URL}/p/${pymeId}\n\n` +
              `Guarda este link. Ahí verás tu histórico de escaneos, hallazgos y detecciones de phishing. ` +
              `Escribe *reporte* en cualquier momento para ver el detalle completo, o *ayuda* para ver mis comandos.`,
          }, 'scan-dashboard');
        }
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
