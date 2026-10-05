// Pruebas del handler del bot sin WhatsApp ni backend reales: el socket y la
// API son dobles que registran lo que se les pide. Correr con `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createBot,
  messageKind,
  extractText,
  isIgnoredChat,
  senderPhoneJid,
  normalizeCommand,
  parseRegistration,
  formatReply,
  formatScanResult,
  formatFullReport,
  formatEmailBreach,
  formatPhoneBreach,
  gradeFor,
  REGISTRATION_TTL_MS,
  NEW_CONTACT_LIMIT,
} = require('../handler');

const LID = '48567658012903@lid';
const PHONE_JID = '5216141234567@s.whatsapp.net';

// ── Dobles ──────────────────────────────────────────────────

function fakeSock() {
  const sent = [];
  return {
    sent,
    readMessages: async () => {},
    sendPresenceUpdate: async () => {},
    sendMessage: async (jid, payload) => {
      sent.push({ jid, ...payload });
      return { key: { id: `id${sent.length}` } };
    },
  };
}

// routes: { 'POST /analyze/text': (body) => data | Error }
function fakeApi(routes = {}) {
  const calls = [];
  const handle = async (method, url, body) => {
    calls.push({ method, url, body });
    const key = `${method} ${url.replace(/\/pyme\/by-jid\/[^/]+/, '/pyme/by-jid/:jid')}`;
    const route = routes[key];
    if (!route) throw new Error(`ruta no simulada: ${key}`);
    const out = typeof route === 'function' ? await route(body) : route;
    if (out instanceof Error) throw out;
    return { data: out };
  };
  return {
    calls,
    get: (url) => handle('GET', url),
    post: (url, body) => handle('POST', url, body),
  };
}

const silentLog = { log: () => {}, error: () => {} };

function setup({ routes, now, download } = {}) {
  const api = fakeApi({ 'POST /lid-map': { ok: true }, ...routes });
  const sock = fakeSock();
  const bot = createBot({
    api,
    publicUrl: 'https://sabuezo.test',
    timing: { gapMinMs: 0, gapMaxMs: 0, humanDelays: false },
    now,
    download,
    log: silentLog,
  });
  const send = (message, key = {}) =>
    bot.handleMessage(sock, {
      key: { remoteJid: LID, remoteJidAlt: PHONE_JID, fromMe: false, id: 'X', ...key },
      pushName: 'Prueba',
      message,
    });
  const say = (text, key) => send({ conversation: text }, key);
  return { api, sock, bot, send, say };
}

const lastText = (sock) => sock.sent.at(-1)?.text || '';
const paths = (api) => api.calls.filter((c) => c.url !== '/lid-map').map((c) => `${c.method} ${c.url}`);

const ANALYSIS_ROJO = {
  risk: 'rojo',
  category: 'Suplantación SAT',
  explanation: 'Pide pagar por un link acortado.',
  red_flags: ['Link acortado', 'Urgencia'],
  recommended_action: 'No abras el link.',
};

// ── Clasificación de mensajes ───────────────────────────────

test('messageKind: texto simple y extendido', () => {
  assert.equal(messageKind({ message: { conversation: 'hola' } }), 'text');
  assert.equal(messageKind({ message: { extendedTextMessage: { text: 'mira esto' } } }), 'text');
});

test('messageKind: desenvuelve mensajes temporales y de una sola vista', () => {
  const eph = { message: { ephemeralMessage: { message: { extendedTextMessage: { text: 'hola' } } } } };
  assert.equal(messageKind(eph), 'text');
  assert.equal(extractText(eph), 'hola');
  const vo = { message: { viewOnceMessageV2: { message: { imageMessage: { caption: 'ojo' } } } } };
  assert.equal(messageKind(vo), 'image');
  assert.equal(extractText(vo), 'ojo');
});

test('messageKind: imagen mandada como documento cuenta como imagen', () => {
  assert.equal(messageKind({ message: { documentMessage: { mimetype: 'image/png' } } }), 'image');
  assert.equal(messageKind({ message: { documentMessage: { mimetype: 'application/pdf' } } }), 'document');
  const withCaption = {
    message: { documentWithCaptionMessage: { message: { documentMessage: { mimetype: 'image/jpeg', caption: 'raro' } } } },
  };
  assert.equal(messageKind(withCaption), 'image');
  assert.equal(extractText(withCaption), 'raro');
});

test('messageKind: reacciones, ediciones y protocolo se ignoran', () => {
  assert.equal(messageKind({ message: { reactionMessage: { text: '👍' } } }), 'ignore');
  assert.equal(messageKind({ message: { protocolMessage: { type: 0 } } }), 'ignore');
  assert.equal(messageKind({ message: { senderKeyDistributionMessage: {} } }), 'ignore');
  assert.equal(messageKind({ message: null }), 'ignore');
});

test('messageKind: audio, video, sticker, ubicación', () => {
  assert.equal(messageKind({ message: { audioMessage: {} } }), 'audio');
  assert.equal(messageKind({ message: { videoMessage: {} } }), 'video');
  assert.equal(messageKind({ message: { stickerMessage: {} } }), 'sticker');
  assert.equal(messageKind({ message: { locationMessage: {} } }), 'other');
});

test('isIgnoredChat: grupos, estados, difusión y canales', () => {
  assert.equal(isIgnoredChat('123@g.us'), true);
  assert.equal(isIgnoredChat('status@broadcast'), true);
  assert.equal(isIgnoredChat('123@broadcast'), true);
  assert.equal(isIgnoredChat('123@newsletter'), true);
  assert.equal(isIgnoredChat(LID), false);
  assert.equal(isIgnoredChat(PHONE_JID), false);
});

test('senderPhoneJid: Baileys 7 (remoteJidAlt), versión vieja (senderPn) y JID directo', () => {
  assert.equal(senderPhoneJid({ key: { remoteJid: LID, remoteJidAlt: PHONE_JID } }), PHONE_JID);
  assert.equal(senderPhoneJid({ key: { remoteJid: LID, senderPn: PHONE_JID } }), PHONE_JID);
  assert.equal(senderPhoneJid({ key: { remoteJid: PHONE_JID } }), PHONE_JID);
  assert.equal(senderPhoneJid({ key: { remoteJid: LID } }), null);
});

test('normalizeCommand: acentos, signos y mayúsculas', () => {
  assert.equal(normalizeCommand('¡Hola!'), 'hola');
  assert.equal(normalizeCommand('  Menú. '), 'menu');
  assert.equal(normalizeCommand('Buenos días'), 'buenos dias');
  assert.equal(normalizeCommand('CANCELAR'), 'cancelar');
});

// ── Parseo de registro ──────────────────────────────────────

test('parseRegistration: tres líneas', () => {
  assert.deepEqual(parseRegistration('Papelería Don Juan\ndonjuan.com.mx\njuan@donjuan.com.mx'), {
    name: 'Papelería Don Juan',
    url: 'donjuan.com.mx',
    email: 'juan@donjuan.com.mx',
  });
});

test('parseRegistration: con etiquetas', () => {
  const r = parseRegistration('Empresa: Taller Pérez\nSitio: https://tallerperez.mx\nCorreo: a@tallerperez.mx');
  assert.equal(r.name, 'Taller Pérez');
  assert.equal(r.url, 'https://tallerperez.mx');
  assert.equal(r.email, 'a@tallerperez.mx');
});

test('parseRegistration: una línea con url y correo', () => {
  const r = parseRegistration('mi sitio es tallerperez.mx y mi correo a@tallerperez.mx');
  assert.equal(r.email, 'a@tallerperez.mx');
  assert.equal(r.url, 'tallerperez.mx');
});

test('parseRegistration: sin url', () => {
  assert.equal(parseRegistration('cancelar').url, null);
});

// ── Formateo ────────────────────────────────────────────────

test('gradeFor: límites de cada letra', () => {
  assert.equal(gradeFor(90).letra, 'A');
  assert.equal(gradeFor(89).letra, 'B');
  assert.equal(gradeFor(65).letra, 'C');
  assert.equal(gradeFor(50).letra, 'D');
  assert.equal(gradeFor(49).letra, 'F');
});

test('formatReply: rojo incluye a dónde reportar; verde no', () => {
  const rojo = formatReply(ANALYSIS_ROJO);
  assert.match(rojo, /PELIGRO/);
  assert.match(rojo, /CONDUSEF/);
  assert.match(rojo, /• Link acortado/);
  const verde = formatReply({ risk: 'verde', explanation: 'Todo bien' });
  assert.match(verde, /PARECE SEGURO/);
  assert.doesNotMatch(verde, /CONDUSEF/);
  assert.match(formatReply(null), /No pude analizar/);
});

test('formatScanResult: sin summary no imprime "undefined"', () => {
  const out = formatScanResult({ score: 72, domain: 'x.mx', findings: [], raw: { email_auth: { spf_present: true, dmarc_present: true } } });
  assert.doesNotMatch(out, /undefined/);
  assert.match(out, /Calificación: C/);
  assert.match(out, /No detecté problemas importantes/);
});

test('formatScanResult: avisa cuando faltan SPF y DMARC a la vez', () => {
  const out = formatScanResult({ score: 40, domain: 'x.mx', summary: 's', findings: [], raw: { email_auth: {} } });
  assert.match(out, /SPF y DMARC ausentes/);
  const soloDmarc = formatScanResult({ score: 40, domain: 'x.mx', summary: 's', findings: [], raw: { email_auth: { spf_present: true } } });
  assert.match(soloDmarc, /\(DMARC ausente\)/);
});

test('formatScanResult: muestra máx. 4 hallazgos y cuenta el resto', () => {
  const f = (severity, i) => ({ severity, title: `T${i}`, description: 'd', fix: 'f', fix_time_min: 5 });
  const findings = [f('critical', 1), f('high', 2), f('high', 3), f('medium', 4), f('medium', 5), f('low', 6)];
  const out = formatScanResult({ score: 30, domain: 'x.mx', summary: 's', findings, raw: { email_auth: { spf_present: true, dmarc_present: true } } });
  assert.match(out, /T4/);
  assert.doesNotMatch(out, /T5/);
  assert.match(out, /Y 2 hallazgos más/);
  assert.doesNotMatch(formatFullReport({ score: 30, domain: 'x.mx', findings }), /undefined/);
});

test('formatEmailBreach / formatPhoneBreach: error, limpio y filtrado', () => {
  assert.match(formatEmailBreach('a@b.mx', { ok: false }), /No pude verificar/);
  assert.match(formatEmailBreach('a@b.mx', { ok: true, found: false }), /no aparece/);
  assert.match(formatEmailBreach('a@b.mx', { ok: true, found: true, count: 1, breaches: ['Canva'] }), /1 filtración\*/);
  assert.match(formatPhoneBreach('55', { ok: false, error: 'rate_limited' }), /Demasiadas consultas/);
  assert.match(
    formatPhoneBreach('55', { ok: true, found: true, count: 2, sources: [{ name: 'X', date: '2021' }], fields: ['nombre'] }),
    /2 fugas[\s\S]*X \(2021\)[\s\S]*nombre/
  );
});

// ── Handler: chats y mensajes que se ignoran ────────────────

test('no responde en grupos, estados, canales ni a sí mismo', async () => {
  const { sock, api, say } = setup();
  await say('hola', { remoteJid: '123@g.us' });
  await say('hola', { remoteJid: 'status@broadcast' });
  await say('hola', { remoteJid: '1@newsletter' });
  await say('hola', { fromMe: true });
  assert.equal(sock.sent.length, 0);
  assert.equal(api.calls.length, 0);
});

test('no responde a reacciones ni ediciones', async () => {
  const { sock, api, send } = setup();
  await send({ reactionMessage: { text: '👍' } });
  await send({ protocolMessage: { type: 14 } });
  assert.equal(sock.sent.length, 0);
  assert.equal(paths(api).length, 0);
});

// ── Handler: comandos ───────────────────────────────────────

test('saludos con signos y acentos reciben bienvenida sin gastar IA', async () => {
  for (const t of ['hola', '¡Hola!', 'Holaa', 'buenas tardes', 'Buenos días', 'hola sabuezo']) {
    const { sock, api, say } = setup();
    await say(t);
    assert.match(lastText(sock), /Sabuezo/, t);
    assert.deepEqual(paths(api), [], t);
  }
});

test('ayuda / menú', async () => {
  const { sock, say } = setup();
  await say('Menú');
  assert.match(lastText(sock), /Guía rápida/);
});

test('un saludo dentro de un mensaje largo sí se analiza', async () => {
  const { api, sock, say } = setup({ routes: { 'POST /analyze/text': ANALYSIS_ROJO } });
  await say('hola, me llegó esto: SAT factura vencida bit.ly/x');
  assert.deepEqual(paths(api), ['POST /analyze/text']);
  assert.match(lastText(sock), /PELIGRO/);
});

test('mensaje temporal (ephemeral) se analiza como texto', async () => {
  const { api, say, send } = setup({ routes: { 'POST /analyze/text': ANALYSIS_ROJO } });
  await send({ ephemeralMessage: { message: { extendedTextMessage: { text: 'Su cuenta BBVA fue bloqueada' } } } });
  assert.deepEqual(paths(api), ['POST /analyze/text']);
  assert.equal(api.calls.at(-1).body.text, 'Su cuenta BBVA fue bloqueada');
  void say;
});

test('reporte sin registro y con registro', async () => {
  const sin = setup({ routes: { 'GET /pyme/by-jid/:jid/last-scan': { ok: false, error: 'pyme_not_found' } } });
  await sin.say('reporte');
  assert.match(lastText(sin.sock), /Aún no tengo un escaneo/);

  const con = setup({
    routes: {
      'GET /pyme/by-jid/:jid/last-scan': {
        ok: true,
        pyme: { id: 'p1' },
        scan: { score: 95, domain: 'x.mx', summary: 'ok', findings: [] },
      },
    },
  });
  await con.say('Reporte');
  assert.match(con.sock.sent[0].text, /Reporte completo — x\.mx/);
  assert.equal(con.sock.sent[1].text, '📊 Panel ejecutivo: https://sabuezo.test/p/p1');
});

test('dashboard: error del backend da mensaje amable', async () => {
  const { sock, say } = setup({ routes: { 'GET /pyme/by-jid/:jid/last-scan': new Error('ECONNREFUSED') } });
  await say('panel');
  assert.match(lastText(sock), /No pude traer tu panel/);
});

// ── Handler: filtraciones ───────────────────────────────────

test('correo suelto se revisa en filtraciones', async () => {
  const { api, sock, say } = setup({ routes: { 'POST /check/email': { ok: true, found: false } } });
  await say('ana@empresa.mx');
  assert.deepEqual(paths(api), ['POST /check/email']);
  assert.equal(api.calls.at(-1).body.value, 'ana@empresa.mx');
  assert.match(lastText(sock), /no aparece/);
});

test('"numero 55 1234 5678" revisa ese número', async () => {
  const { api, say } = setup({ routes: { 'POST /check/phone': { ok: true, found: false } } });
  await say('numero 55 1234 5678');
  assert.equal(api.calls.at(-1).body.value, '55 1234 5678');
});

test('"número" a secas usa el teléfono real del remitente, no su @lid', async () => {
  const { api, say } = setup({ routes: { 'POST /check/phone': { ok: true, found: false } } });
  await say('Número');
  assert.equal(api.calls.at(-1).url, '/check/phone');
  assert.equal(api.calls.at(-1).body.value, '5216141234567');
});

test('"numero" a secas sin teléfono conocido pide el número', async () => {
  const { api, sock, say } = setup();
  await say('numero', { remoteJidAlt: undefined });
  assert.deepEqual(paths(api), []);
  assert.match(lastText(sock), /Mándame el número así/);
});

test('backend caído en filtraciones da mensaje amable', async () => {
  const { sock, say } = setup({ routes: { 'POST /check/email': new Error('timeout') } });
  await say('correo ana@empresa.mx');
  assert.match(lastText(sock), /No pude verificar el correo/);
});

// ── Handler: registro ───────────────────────────────────────

const REG_ROUTES = {
  'POST /pyme/register': { ok: true, pyme: { id: 'p9' } },
  'POST /scan': { score: 55, domain: 'donjuan.com.mx', summary: 's', findings: [], raw: { email_auth: {} } },
};

test('registro completo: registra, escanea y manda el panel', async () => {
  const { api, sock, say } = setup({ routes: REG_ROUTES });
  await say('registrar');
  await say('Papelería Don Juan\ndonjuan.com.mx\njuan@donjuan.com.mx');
  assert.deepEqual(paths(api), ['POST /pyme/register', 'POST /scan']);
  assert.equal(api.calls.at(-1).body.url, 'donjuan.com.mx');
  assert.match(sock.sent.at(-2).text, /Calificación: D/);
  assert.match(lastText(sock), /sabuezo\.test\/p\/p9/);
});

test('durante el registro el correo no se manda a filtraciones', async () => {
  const { api, say } = setup({ routes: REG_ROUTES });
  await say('registrar');
  await say('juan@donjuan.com.mx');
  assert.ok(!paths(api).includes('POST /check/email'));
});

test('"cancelar" sale del registro (antes quedaba atrapado)', async () => {
  const { api, sock, bot, say } = setup({ routes: { 'POST /analyze/text': ANALYSIS_ROJO } });
  await say('registrar');
  await say('Cancelar');
  assert.match(lastText(sock), /cancelado/);
  assert.equal(bot.isAwaitingRegistration(LID), false);
  await say('Te paso mi nueva CLABE para el depósito: proveedor-pagos.com');
  assert.deepEqual(paths(api), ['POST /analyze/text']);
});

test('el registro caduca: un link días después se analiza, no se escanea', async () => {
  let t = 1_000_000;
  const { api, say } = setup({ routes: { ...REG_ROUTES, 'POST /analyze/text': ANALYSIS_ROJO }, now: () => t });
  await say('registrar');
  t += REGISTRATION_TTL_MS + 1;
  await say('Tu paquete DHL está retenido, paga en dhl-mx-envios.com');
  assert.deepEqual(paths(api), ['POST /analyze/text']);
});

test('registro sin url pide la url y sigue esperando', async () => {
  const { sock, bot, say } = setup();
  await say('registrar');
  await say('Papelería Don Juan');
  assert.match(lastText(sock), /no detecté la URL/);
  assert.equal(bot.isAwaitingRegistration(LID), true);
});

// ── Handler: imágenes y no soportados ───────────────────────

test('imagen: descarga, manda base64 y caption', async () => {
  const download = async () => Buffer.from('png-bytes');
  const { api, sock, send } = setup({ routes: { 'POST /analyze/image': ANALYSIS_ROJO }, download });
  await send({ imageMessage: { caption: 'me llegó esto' } });
  const call = api.calls.at(-1);
  assert.equal(call.url, '/analyze/image');
  assert.equal(call.body.image_base64, Buffer.from('png-bytes').toString('base64'));
  assert.equal(call.body.caption, 'me llegó esto');
  assert.match(lastText(sock), /PELIGRO/);
});

test('imagen mandada como documento se analiza como imagen', async () => {
  const download = async () => Buffer.from('jpg');
  const { api, send } = setup({ routes: { 'POST /analyze/image': ANALYSIS_ROJO }, download });
  await send({ documentMessage: { mimetype: 'image/jpeg', fileName: 'captura.jpg' } });
  assert.deepEqual(paths(api), ['POST /analyze/image']);
});

test('falla al descargar la imagen da mensaje amable', async () => {
  const download = async () => { throw new Error('media expired'); };
  const { sock, send } = setup({ download });
  await send({ imageMessage: {} });
  assert.match(lastText(sock), /Tuve un problema analizando/);
});

test('audio, PDF y sticker reciben el aviso de no soportado', async () => {
  for (const m of [{ audioMessage: {} }, { documentMessage: { mimetype: 'application/pdf' } }, { stickerMessage: {} }]) {
    const { sock, api, send } = setup();
    await send(m);
    assert.match(lastText(sock), /solo entiendo \*texto\* e \*imágenes\*/);
    assert.deepEqual(paths(api), []);
  }
});

// ── Handler: lid-map y rate-limit ───────────────────────────

test('lid-map se manda una vez con el teléfono de remoteJidAlt', async () => {
  const { api, say } = setup();
  await say('hola');
  await say('hola');
  const lid = api.calls.filter((c) => c.url === '/lid-map');
  assert.equal(lid.length, 1);
  assert.deepEqual(lid[0].body, { lid: LID, phone_jid: PHONE_JID, pushname: 'Prueba' });
});

test('rate-limit: contacto nuevo tiene tope diario y un solo aviso', async () => {
  const { sock, say } = setup();
  for (let i = 0; i < NEW_CONTACT_LIMIT + 5; i++) await say('ayuda');
  assert.equal(sock.sent.length, NEW_CONTACT_LIMIT + 1);
  assert.match(lastText(sock), /límite de consultas/);
});

test('los envíos salen en orden aunque lleguen mensajes en paralelo', async () => {
  const { sock, say } = setup();
  await Promise.all([say('ayuda'), say('hola'), say('menu')]);
  assert.equal(sock.sent.length, 3);
});
