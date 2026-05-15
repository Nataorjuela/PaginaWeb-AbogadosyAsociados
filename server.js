const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.resolve(__dirname, 'data', 'orjuela.db');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_REGISTRATION_CODE = process.env.ADMIN_REGISTRATION_CODE || ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const APP_ENV = process.env.APP_ENV || 'development';
const QA_DEMO_DATA = process.env.QA_DEMO_DATA === 'true' || APP_ENV === 'qa';
const SEED_ACCESS_USERS = process.env.SEED_ACCESS_USERS === 'true';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const ALLY_TYPES = ['persona_natural', 'empresa', 'inmobiliaria', 'contador', 'asesor_comercial', 'cliente', 'independiente', 'otro'];
const ALLY_STATUSES = ['pending', 'active', 'inactive'];
const LEGAL_AREAS = ['derecho_civil', 'derecho_laboral', 'derecho_comercial', 'derecho_inmobiliario', 'derecho_familia', 'cobranza', 'contratos', 'sucesiones', 'otro'];
const REFERRAL_STATUSES = ['new', 'contacted', 'in_progress', 'proposal_sent', 'won', 'commission_approved', 'commission_paid', 'rejected'];
const AUTH_ROLES = ['admin', 'abogado', 'asistente', 'ally', 'client'];
const NETWORK_REFERRAL_STATUSES = ['Nuevo referido', 'En revision', 'Contactado', 'En negociacion', 'Cliente vinculado', 'Caso rechazado', 'Comision aprobada', 'Comision pagada'];
const COMMISSION_STATUSES = ['pending', 'approved', 'paid', 'rejected'];
const COMMISSION_TYPES = ['direct', 'indirect_level_1', 'indirect_level_2'];

const app = express();
app.use(cors());
app.use(express.json({ limit: '50kb' }));

function ensureDataDirectory() {
  const folder = path.dirname(DB_FILE);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
}

function createDatabase() {
  ensureDataDirectory();
  const db = new sqlite3.Database(DB_FILE);
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS allies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      document_number TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      city TEXT NOT NULL,
      ally_type TEXT NOT NULL,
      how_known TEXT,
      bank_name TEXT,
      account_type TEXT,
      account_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER NOT NULL,
      referred_full_name TEXT NOT NULL,
      client_identification TEXT,
      referred_phone TEXT NOT NULL,
      referred_email TEXT,
      referred_city TEXT NOT NULL,
      legal_area TEXT NOT NULL,
      case_description TEXT NOT NULL,
      referral_channel TEXT,
      urgency TEXT,
      file_notes TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (ally_id) REFERENCES allies(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      case_type TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Nuevo',
      assigned_to TEXT,
      notes TEXT,
      referrer_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      document_id TEXT,
      phone TEXT,
      email TEXT,
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      case_type TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'Recibido',
      assigned_lawyer TEXT,
      next_action TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS case_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      related_type TEXT NOT NULL,
      related_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      payment_date TEXT,
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS admin_agenda (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client_name TEXT,
      related_type TEXT,
      related_id INTEGER,
      assigned_to TEXT,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Programada',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      actor_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      summary TEXT,
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      document_id TEXT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      auth_provider TEXT DEFAULT 'password',
      google_sub TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      reset_token_hash TEXT,
      reset_token_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS partners (
      user_id INTEGER PRIMARY KEY,
      document_id TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      partner_type TEXT NOT NULL,
      company TEXT,
      how_known TEXT,
      occupation TEXT,
      bank_name TEXT,
      account_type TEXT,
      account_number TEXT,
      referral_code TEXT UNIQUE,
      invited_by_partner_id INTEGER,
      commission_balance REAL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER NOT NULL,
      referral_id INTEGER NOT NULL,
      source_ally_id INTEGER NOT NULL,
      commission_type TEXT NOT NULL,
      percentage REAL NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      paid_at TEXT,
      FOREIGN KEY (ally_id) REFERENCES partners(user_id),
      FOREIGN KEY (source_ally_id) REFERENCES partners(user_id),
      FOREIGN KEY (referral_id) REFERENCES referrals(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS commission_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direct_percentage REAL NOT NULL DEFAULT 10,
      level_1_percentage REAL NOT NULL DEFAULT 3,
      level_2_percentage REAL NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS referral_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referral_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      visible_to_ally INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (referral_id) REFERENCES referrals(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT,
      status TEXT,
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      description TEXT,
      url TEXT,
      content TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      min_converted_referrals INTEGER NOT NULL,
      min_commissions REAL NOT NULL,
      min_active_allies INTEGER NOT NULL,
      benefits TEXT,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER,
      month TEXT NOT NULL,
      referral_goal INTEGER NOT NULL DEFAULT 5,
      converted_goal INTEGER NOT NULL DEFAULT 1,
      commission_goal REAL NOT NULL DEFAULT 500000,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER NOT NULL,
      notification_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_legal_acceptances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      accepted_at TEXT,
      ip_address TEXT,
      version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_kyc_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER NOT NULL UNIQUE,
      front_document_url TEXT,
      back_document_url TEXT,
      selfie_url TEXT,
      bank_name TEXT,
      account_type TEXT,
      account_number TEXT,
      phone_validated INTEGER NOT NULL DEFAULT 0,
      email_validated INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Sin verificar',
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_electronic_signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      full_name TEXT NOT NULL,
      document_number TEXT NOT NULL,
      version TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'accepted'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_fraud_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER,
      referral_id INTEGER,
      risk_level TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_academy_modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      content TEXT,
      video_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ally_academy_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER NOT NULL,
      module_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendiente',
      progress INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(ally_id, module_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS auth_clients (
      user_id INTEGER PRIMARY KEY,
      document_id TEXT UNIQUE,
      assigned_lawyer TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    [
      `ALTER TABLE allies ADD COLUMN how_known TEXT`,
      `ALTER TABLE allies ADD COLUMN bank_name TEXT`,
      `ALTER TABLE allies ADD COLUMN account_type TEXT`,
      `ALTER TABLE allies ADD COLUMN account_number TEXT`,
      `ALTER TABLE referrals ADD COLUMN urgency TEXT`,
      `ALTER TABLE referrals ADD COLUMN file_notes TEXT`,
      `ALTER TABLE referrals ADD COLUMN client_identification TEXT`,
      `ALTER TABLE referrals ADD COLUMN referral_channel TEXT`,
      `ALTER TABLE partners ADD COLUMN occupation TEXT`,
      `ALTER TABLE partners ADD COLUMN bank_name TEXT`,
      `ALTER TABLE partners ADD COLUMN account_type TEXT`,
      `ALTER TABLE partners ADD COLUMN account_number TEXT`,
      `ALTER TABLE partners ADD COLUMN referral_code TEXT`,
      `ALTER TABLE partners ADD COLUMN invited_by_partner_id INTEGER`,
      `ALTER TABLE partners ADD COLUMN created_at TEXT`,
      `ALTER TABLE partners ADD COLUMN updated_at TEXT`,
      `ALTER TABLE users ADD COLUMN document_id TEXT`,
      `ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'password'`,
      `ALTER TABLE users ADD COLUMN google_sub TEXT`,
      `ALTER TABLE users ADD COLUMN avatar_url TEXT`,
      `ALTER TABLE clients ADD COLUMN city TEXT`,
      `ALTER TABLE clients ADD COLUMN address TEXT`,
      `ALTER TABLE clients ADD COLUMN updated_at TEXT`,
      `ALTER TABLE clients ADD COLUMN verified INTEGER DEFAULT 0`,
      `ALTER TABLE clients ADD COLUMN status TEXT DEFAULT 'Activo'`,
      `ALTER TABLE leads ADD COLUMN priority TEXT DEFAULT 'Media'`,
      `ALTER TABLE leads ADD COLUMN next_action TEXT`,
      `ALTER TABLE cases ADD COLUMN updated_at TEXT`,
      `ALTER TABLE cases ADD COLUMN archived_at TEXT`,
      `ALTER TABLE case_documents ADD COLUMN document_type TEXT`,
      `ALTER TABLE case_documents ADD COLUMN status TEXT DEFAULT 'Recibido'`,
      `ALTER TABLE case_documents ADD COLUMN observations TEXT`,
      `ALTER TABLE payments ADD COLUMN concept TEXT`,
      `ALTER TABLE payments ADD COLUMN support_url TEXT`,
      `ALTER TABLE payments ADD COLUMN updated_at TEXT`,
    ].forEach((sql) => db.run(sql, () => {}));

    db.run(`INSERT INTO commission_settings (direct_percentage, level_1_percentage, level_2_percentage, is_active, created_at, updated_at)
      SELECT 10, 3, 1, 1, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM commission_settings WHERE is_active = 1)`, [new Date().toISOString(), new Date().toISOString()]);

    const seedNow = new Date().toISOString();
    [
      ['Bronce', 0, 0, 0, 'Acceso a recursos base, portal de seguimiento y soporte comercial.', 1],
      ['Plata', 3, 500000, 1, 'Prioridad en soporte, plantillas avanzadas y revisión mensual de desempeño.', 2],
      ['Oro', 8, 1500000, 3, 'Acompañamiento comercial dedicado y materiales personalizados.', 3],
      ['Elite', 15, 3500000, 5, 'Beneficios preferenciales, sesiones estratégicas y reconocimiento destacado.', 4]
    ].forEach((item) => {
      db.run(`INSERT OR IGNORE INTO ally_levels (name, min_converted_referrals, min_commissions, min_active_allies, benefits, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)`, item);
    });

    [
      ['Mensaje para cliente', 'whatsapp', 'Texto base para recomendar servicios legales.', '', 'Hola, quiero recomendarte a Orjuela Abogados. Pueden ayudarte con asesoría jurídica personalizada.'],
      ['Mensaje para invitar aliado', 'whatsapp', 'Texto base para invitar aliados.', '', 'Hola, quiero invitarte al programa de aliados de Orjuela Abogados.'],
      ['Texto para redes sociales', 'social', 'Copy breve para publicar en redes.', '', 'Acompañamiento legal claro, profesional y personalizado con Orjuela Abogados.'],
      ['Flyer servicios legales', 'flyer', 'Pieza descargable para compartir.', '/assets/logoCompleto.jpg', ''],
      ['PDF portafolio de servicios', 'pdf', 'Documento comercial editable.', '/assets/logoCompleto.jpg', ''],
      ['Logo autorizado', 'logo', 'Uso de marca aprobado para aliados.', '/assets/logoCompleto.jpg', '']
    ].forEach((item) => {
      db.run(`INSERT INTO ally_resources (title, resource_type, description, url, content, created_at)
        SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM ally_resources WHERE title = ?)`, [...item, seedNow, item[0]]);
    });

    [
      ['Cómo funciona el programa', 'Conoce reglas, estados y buenas prácticas.', 'El programa funciona por referidos efectivos y comisiones sujetas a validación.'],
      ['Cómo referir correctamente', 'Aprende a registrar información clara y autorizada.', 'Registra datos completos, necesidad legal y autorización de contacto.'],
      ['Cómo hablar de los servicios legales', 'Guía para explicar servicios sin promesas indebidas.', 'Comunica claridad, respaldo y acompañamiento profesional.'],
      ['Protección de datos personales', 'Tratamiento responsable de datos en Colombia.', 'Solicita autorización previa y evita compartir datos sensibles por canales no seguros.'],
      ['Ética en la captación de clientes', 'Buenas prácticas para recomendaciones legales.', 'Evita presiones, promesas de resultado y mensajes engañosos.'],
      ['Uso correcto de la marca Orjuela Abogados', 'Lineamientos de marca para aliados.', 'Usa solo piezas autorizadas desde el portal.'],
      ['Preguntas frecuentes', 'Respuestas para situaciones comunes.', 'Consulta estados, comisiones, pagos y políticas.'],
      ['Scripts de venta', 'Guiones profesionales para conversaciones.', 'Mantén un tono claro, honesto y consultivo.'],
      ['Buenas prácticas', 'Recomendaciones para mejorar vinculación.', 'Prioriza calidad de información y seguimiento oportuno.']
    ].forEach((item, index) => {
      db.run(`INSERT INTO ally_academy_modules (title, description, content, sort_order)
        SELECT ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM ally_academy_modules WHERE title = ?)`, [item[0], item[1], item[2], index + 1, item[0]]);
    });
  });
  return db;
}

function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return null;
}

const transporter = createTransporter();
const db = createDatabase();

function sendNotificationEmail(subject, html) {
  if (!ADMIN_EMAIL || !transporter) {
    console.log('[mail] Notification skipped. Configure ADMIN_EMAIL and SMTP_* variables.', subject);
    return;
  }

  transporter.sendMail({
    from: process.env.SMTP_FROM || ADMIN_EMAIL,
    to: ADMIN_EMAIL,
    subject,
    html
  }).catch((error) => {
    console.error('[mail] Error sending notification:', error);
  });
}

function getTimestamp() {
  return new Date().toISOString();
}

function cleanText(value, maxLength = 180) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function normalizeDocument(value) {
  return cleanText(value, 40).replace(/[^\dA-Za-z-]/g, '');
}

function normalizeEmail(value) {
  return cleanText(value, 180).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getJsonFromUrl(url, headers, callback) {
  https.get(url, { headers }, (response) => {
    let raw = '';
    response.on('data', (chunk) => raw += chunk);
    response.on('end', () => {
      try {
        callback(null, { statusCode: response.statusCode, body: JSON.parse(raw || '{}') });
      } catch (err) {
        callback(err);
      }
    });
  }).on('error', callback);
}

function generatedDocumentId(prefix, email) {
  const hash = crypto.createHash('sha1').update(String(email || '').toLowerCase()).digest('hex').slice(0, 12).toUpperCase();
  return `${prefix}-${hash}`;
}

function ensureClientProfile(user, callback) {
  const documentId = normalizeDocument(user.document_id) || generatedDocumentId('CLIENTE', user.email);
  db.run(`INSERT OR IGNORE INTO auth_clients (user_id, document_id, assigned_lawyer) VALUES (?, ?, 'Equipo Orjuela')`, [user.id, documentId], (authErr) => {
    if (authErr) return callback(authErr);
    db.get(`SELECT id FROM clients WHERE email = ? OR document_id = ?`, [user.email, documentId], (clientErr, client) => {
      if (clientErr) return callback(clientErr);
      if (client) return callback();
      db.run(`INSERT INTO clients (name, document_id, phone, email, created_at) VALUES (?, ?, '', ?, ?)`, [user.full_name, documentId, user.email, getTimestamp()], callback);
    });
  });
}

function ensurePartnerProfile(user, callback) {
  const documentId = normalizeDocument(user.document_id) || generatedDocumentId('ALIADO', user.email);
  const referralCode = generateReferralCode(user.full_name || user.email, documentId);
  db.run(`INSERT OR IGNORE INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, referral_code, commission_balance, created_at, updated_at)
    VALUES (?, ?, '', '', 'Independiente', '', 'Registro web', 'Aliado referidor', ?, 0, ?, ?)`,
    [user.id, documentId, referralCode, getTimestamp(), getTimestamp()], callback);
}

function ensureRoleProfile(user, callback = () => {}) {
  if (user.role === 'client') return ensureClientProfile(user, callback);
  if (user.role === 'ally') return ensurePartnerProfile(user, callback);
  return callback();
}

function verifyGoogleCredential(credential, callback) {
  if (!credential) return callback(new Error('missing_credential'));
  if (!credential.includes('.')) return verifyGoogleAccessToken(credential, callback);
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  getJsonFromUrl(url, {}, (err, result) => {
    if (err) return callback(err);
    const profile = result.body;
    if (result.statusCode !== 200 || profile.error) return callback(new Error('invalid_credential'));
    if (GOOGLE_CLIENT_ID && profile.aud !== GOOGLE_CLIENT_ID) return callback(new Error('invalid_audience'));
    if (profile.email_verified !== true && profile.email_verified !== 'true') return callback(new Error('email_not_verified'));
    callback(null, {
      google_sub: cleanText(profile.sub, 120),
      email: normalizeEmail(profile.email),
      full_name: cleanText(profile.name || profile.email, 140),
      avatar_url: cleanText(profile.picture, 500)
    });
  });
}

function verifyGoogleAccessToken(accessToken, callback) {
  const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`;
  getJsonFromUrl(tokenInfoUrl, {}, (tokenErr, tokenResult) => {
    if (tokenErr) return callback(tokenErr);
    const tokenInfo = tokenResult.body;
    if (tokenResult.statusCode !== 200 || tokenInfo.error) return callback(new Error('invalid_credential'));
    if (GOOGLE_CLIENT_ID && tokenInfo.aud !== GOOGLE_CLIENT_ID) return callback(new Error('invalid_audience'));

    getJsonFromUrl('https://www.googleapis.com/oauth2/v3/userinfo', { Authorization: `Bearer ${accessToken}` }, (profileErr, profileResult) => {
      if (profileErr) return callback(profileErr);
      const profile = profileResult.body;
      if (profileResult.statusCode !== 200 || profile.error) return callback(new Error('invalid_credential'));
      if (profile.email_verified !== true && profile.email_verified !== 'true') return callback(new Error('email_not_verified'));
      callback(null, {
        google_sub: cleanText(profile.sub || tokenInfo.sub || tokenInfo.user_id, 120),
        email: normalizeEmail(profile.email || tokenInfo.email),
        full_name: cleanText(profile.name || profile.email || tokenInfo.email, 140),
        avatar_url: cleanText(profile.picture, 500)
      });
    });
  });
}

function validatePasswordStrength(password) {
  const value = String(password || '');
  if (value.length < 8) return 'La contraseña debe tener mínimo 8 caracteres.';
  if (!/[A-Z]/.test(value)) return 'La contraseña debe incluir al menos una letra mayúscula.';
  if (!/[a-z]/.test(value)) return 'La contraseña debe incluir al menos una letra minúscula.';
  if (!/\d/.test(value)) return 'La contraseña debe incluir al menos un número.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'La contraseña debe incluir al menos un símbolo.';
  return '';
}

function isOneOf(value, allowed) {
  return allowed.includes(value);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const candidate = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
}

function signToken(payload) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 }));
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  const [header, body, signature] = String(token || '').split('.');
  if (!header || !body || !signature) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function requireAuth(roles = []) {
  return (req, res, next) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Sesión inválida o expirada.' });
    if (roles.length && !roles.includes(payload.role)) return res.status(403).json({ error: 'No tienes permisos para acceder a este recurso.' });
    req.user = payload;
    next();
  };
}

function publicUser(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    document_id: row.document_id,
    email: row.email,
    avatar_url: row.avatar_url,
    auth_provider: row.auth_provider,
    role: row.role,
    status: row.status
  };
}

function createAuthResponse(user) {
  const safeUser = publicUser(user);
  return {
    user: safeUser,
    token: signToken(safeUser)
  };
}

function upsertSeedUser({ fullName, documentId, email, password, role }, callback) {
  const now = getTimestamp();
  const passwordHash = hashPassword(password);

  db.get(`SELECT id FROM users WHERE email = ?`, [email], (selectErr, existingUser) => {
    if (selectErr) return callback(selectErr);

    if (existingUser) {
      return db.run(`UPDATE users
        SET full_name = ?, document_id = ?, password_hash = ?, role = ?, status = 'active', updated_at = ?
        WHERE id = ?`, [fullName, documentId, passwordHash, role, now, existingUser.id], (updateErr) => {
        callback(updateErr, existingUser.id);
      });
    }

    return db.run(`INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`, [fullName, documentId, email, passwordHash, role, now, now], function insertUser(insertErr) {
      callback(insertErr, this?.lastID);
    });
  });
}

function seedProductionAccessUsers() {
  const now = getTimestamp();
  const sharedProfile = {
    fullName: 'Usuario Prueba',
    documentId: '12345678'
  };
  const accessUsers = [
    { ...sharedProfile, email: 'cliente@orjuela.com', password: 'Cliente123!', role: 'client' },
    { ...sharedProfile, email: 'aliado@orjuela.com', password: 'Aliado123!', role: 'ally' },
    { ...sharedProfile, email: 'admin@orjuela.com', password: 'Admin123!', role: 'admin' }
  ];

  accessUsers.forEach((user) => {
    upsertSeedUser(user, (userErr, userId) => {
      if (userErr || !userId) {
        console.error('[seed] Error creating access user:', user.email, userErr);
        return;
      }

      if (user.role === 'client') {
        db.run(`INSERT INTO auth_clients (user_id, document_id, assigned_lawyer)
          VALUES (?, ?, 'Equipo Orjuela')
          ON CONFLICT(user_id) DO UPDATE SET
            document_id = excluded.document_id,
            assigned_lawyer = excluded.assigned_lawyer`, [userId, user.documentId]);

        db.run(`INSERT INTO clients (name, document_id, phone, email, created_at)
          SELECT ?, ?, '3000000000', ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM clients WHERE email = ?)`,
          [user.fullName, user.documentId, user.email, now, user.email]);
      }

      if (user.role === 'ally') {
        db.run(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, bank_name, account_type, account_number, referral_code, commission_balance, created_at, updated_at)
          VALUES (?, ?, '3001234567', 'Bogotá', 'Independiente', 'Orjuela Abogados', 'Usuario de prueba para producción', 'Asesor comercial aliado', 'Bancolombia', 'Ahorros', '****6789', 'ORJUELAPRUEBA', 1190000, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            document_id = excluded.document_id,
            phone = excluded.phone,
            city = excluded.city,
            partner_type = excluded.partner_type,
            company = excluded.company,
            how_known = excluded.how_known,
            occupation = excluded.occupation,
            bank_name = excluded.bank_name,
            account_type = excluded.account_type,
            account_number = excluded.account_number,
            referral_code = excluded.referral_code,
            updated_at = excluded.updated_at`, [userId, user.documentId, now, now], (partnerErr) => {
          if (partnerErr) {
            console.error('[seed] Error creating partner access profile:', partnerErr);
            return;
          }
          seedProductionAllyDemoData(userId);
        });
      }
    });
  });

  console.log('[seed] Production access users enabled. Users: cliente@orjuela.com, aliado@orjuela.com, admin@orjuela.com');
}

function seedProductionAllyDemoData(allyUserId) {
  const now = getTimestamp();
  const month = currentMonthKey();
  const networkUsers = [
    { fullName: 'Camila Red Aliada', documentId: '900333111', email: 'camila.red@orjuela.com', password: 'Aliado123!', role: 'ally', phone: '3003331111', city: 'Medellín', code: 'CAMILAQA', referrals: 3, commissions: 270000 },
    { fullName: 'Andrés Red Aliado', documentId: '900333222', email: 'andres.red@orjuela.com', password: 'Aliado123!', role: 'ally', phone: '3003332222', city: 'Cali', code: 'ANDRESQA', referrals: 1, commissions: 60000 }
  ];

  const networkIds = {};
  let pendingUsers = networkUsers.length;
  const finishNetworkUsers = () => {
    pendingUsers -= 1;
    if (pendingUsers > 0) return;

    const directReferrals = [
      [3001, allyUserId, 'María Rodríguez', '1020304051', '3014447788', 'maria.rodriguez@example.com', 'Bogotá', 'Inmobiliario', 'Revisión de promesa de compraventa y documentos del inmueble.', 'WhatsApp', 'Media', 'Contactado', '2026-05-08T09:00:00.000Z'],
      [3002, allyUserId, 'Carlos Pérez', '1020304052', '3124568899', 'carlos.perez@example.com', 'Medellín', 'Civil', 'Asesoría para cobro de obligación civil documentada.', 'Llamada', 'Alta', 'Nuevo', '2026-05-04T10:15:00.000Z'],
      [3003, allyUserId, 'Empresa Andina SAS', '900123456', '3109876543', 'legal@andina.test', 'Cali', 'Contratos', 'Revisión de contrato de suministro y cláusulas de incumplimiento.', 'Correo', 'Baja', 'Cliente activo', '2026-04-29T14:20:00.000Z'],
      [3004, allyUserId, 'Laura Méndez', '1020304054', '3004567890', 'laura@example.com', 'Bogotá', 'Familia', 'Consulta sobre acuerdo de alimentos y custodia.', 'Referido directo', 'Media', 'En revision', '2026-05-12T08:40:00.000Z'],
      [3005, allyUserId, 'Jorge Salinas', '1020304055', '3159871122', 'jorge@example.com', 'Ibagué', 'Cobro de cartera', 'Revisión de pagaré y estrategia de cobro prejurídico.', 'WhatsApp', 'Alta', 'Caso cerrado', '2026-05-10T11:10:00.000Z']
    ];

    const networkReferrals = [
      [3006, networkIds['camila.red@orjuela.com'], 'Juliana Martínez', '1020304056', '3015551199', 'juliana@example.com', 'Medellín', 'Familia', 'Asesoría para proceso de divorcio de mutuo acuerdo.', 'Red de aliado', 'Media', 'En revision', '2026-05-11T15:00:00.000Z'],
      [3007, networkIds['camila.red@orjuela.com'], 'Inmobiliaria Norte SAS', '900777111', '3112223344', 'contacto@inmobiliaria.test', 'Bogotá', 'Contratos', 'Revisión de contratos de corretaje inmobiliario.', 'Red de aliado', 'Media', 'Cliente activo', '2026-05-09T16:25:00.000Z'],
      [3008, networkIds['andres.red@orjuela.com'], 'Daniel Rojas', '1020304058', '3029998877', 'daniel@example.com', 'Cali', 'Laboral', 'Consulta por terminación de contrato laboral.', 'Red de aliado', 'Alta', 'Comision pagada', '2026-04-25T13:30:00.000Z'],
      [3009, networkIds['camila.red@orjuela.com'], 'Sofía Parra', '1020304059', '3002221144', 'sofia@example.com', 'Barranquilla', 'Comercial', 'Acompañamiento en constitución y contratos comerciales.', 'Red de aliado', 'Baja', 'Nuevo referido', '2026-05-13T09:45:00.000Z']
    ];

    const referralStmt = db.prepare(`INSERT OR REPLACE INTO referrals
      (id, ally_id, referred_full_name, client_identification, referred_phone, referred_email, referred_city, legal_area, case_description, referral_channel, urgency, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    [...directReferrals, ...networkReferrals].forEach((item) => referralStmt.run(...item, item[12]));
    referralStmt.finalize();

    const commissionRows = [
      [4001, allyUserId, 3001, allyUserId, 'direct', 10, 180000, 'approved', '2026-05-08T09:05:00.000Z', null],
      [4002, allyUserId, 3002, allyUserId, 'direct', 10, 120000, 'pending', '2026-05-04T10:20:00.000Z', null],
      [4003, allyUserId, 3003, allyUserId, 'direct', 10, 320000, 'paid', '2026-04-29T14:30:00.000Z', '2026-05-06T10:00:00.000Z'],
      [4004, allyUserId, 3004, allyUserId, 'direct', 10, 240000, 'approved', '2026-05-12T08:45:00.000Z', null],
      [4005, allyUserId, 3006, networkIds['camila.red@orjuela.com'], 'indirect_level_1', 3, 90000, 'pending', '2026-05-11T15:05:00.000Z', null],
      [4006, allyUserId, 3007, networkIds['camila.red@orjuela.com'], 'indirect_level_1', 3, 135000, 'approved', '2026-05-09T16:30:00.000Z', null],
      [4007, allyUserId, 3008, networkIds['andres.red@orjuela.com'], 'indirect_level_1', 3, 60000, 'paid', '2026-04-25T13:35:00.000Z', '2026-05-02T10:00:00.000Z'],
      [4008, allyUserId, 3009, networkIds['camila.red@orjuela.com'], 'indirect_level_1', 3, 45000, 'pending', '2026-05-13T09:50:00.000Z', null]
    ];
    const commissionStmt = db.prepare(`INSERT OR REPLACE INTO commissions
      (id, ally_id, referral_id, source_ally_id, commission_type, percentage, amount, status, created_at, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    commissionRows.forEach((item) => commissionStmt.run(...item));
    commissionStmt.finalize();

    db.run(`INSERT OR REPLACE INTO ally_goals (id, ally_id, month, referral_goal, converted_goal, commission_goal, is_active, updated_at)
      VALUES (2001, ?, ?, 8, 2, 700000, 1, ?)`, [allyUserId, month, now]);

    db.run(`DELETE FROM ally_notifications WHERE ally_id = ?`, [allyUserId], () => {
      const notificationStmt = db.prepare(`INSERT INTO ally_notifications (ally_id, notification_type, title, description, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`);
      [
        ['Comision aprobada', 'Comisión aprobada', 'Tu comisión por María Rodríguez fue aprobada para pago.', 0, '2026-05-13T08:00:00.000Z'],
        ['Nuevo aliado registrado', 'Nuevo aliado en tu red', 'Camila Red Aliada ya aparece activa dentro de tu red.', 0, '2026-05-12T12:00:00.000Z'],
        ['Cambio de estado', 'Referido actualizado', 'Empresa Andina SAS pasó a Cliente activo.', 1, '2026-05-10T09:00:00.000Z']
      ].forEach((item) => notificationStmt.run(allyUserId, ...item));
      notificationStmt.finalize();
    });

    db.all(`SELECT id, title FROM ally_academy_modules ORDER BY sort_order LIMIT 4`, (moduleErr, modules) => {
      if (moduleErr) return;
      const progressStmt = db.prepare(`INSERT OR REPLACE INTO ally_academy_progress (ally_id, module_id, status, progress, updated_at)
        VALUES (?, ?, ?, ?, ?)`);
      modules.forEach((module, index) => {
        const progress = index < 2 ? 100 : index === 2 ? 65 : 25;
        progressStmt.run(allyUserId, module.id, progress === 100 ? 'completado' : 'pendiente', progress, now);
      });
      progressStmt.finalize();
    });
  };

  networkUsers.forEach((user) => {
    upsertSeedUser(user, (userErr, userId) => {
      if (userErr || !userId) {
        console.error('[seed] Error creating production network ally:', user.email, userErr);
        finishNetworkUsers();
        return;
      }
      networkIds[user.email] = userId;
      db.run(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, referral_code, invited_by_partner_id, commission_balance, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Independiente', 'Red de aliados Orjuela', 'Invitado por usuario de prueba', 'Referidor aliado', ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          document_id = excluded.document_id,
          phone = excluded.phone,
          city = excluded.city,
          referral_code = excluded.referral_code,
          invited_by_partner_id = excluded.invited_by_partner_id,
          commission_balance = excluded.commission_balance,
          updated_at = excluded.updated_at`,
        [userId, user.documentId, user.phone, user.city, user.code, allyUserId, user.commissions, now, now], (partnerErr) => {
          if (partnerErr) console.error('[seed] Error creating production network partner:', user.email, partnerErr);
          finishNetworkUsers();
        });
    });
  });
}

function generateReferralCode(fullName = 'ALIADO', documentId = '') {
  const prefix = cleanText(fullName, 40)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase() || 'OA';
  const documentPart = normalizeDocument(documentId).slice(-4) || crypto.randomInt(1000, 9999).toString();
  const specialNumber = crypto.randomInt(10, 99).toString();
  return `${prefix}${documentPart}-${specialNumber}`;
}

function ensurePartnerReferralCode(userId, fullName, callback) {
  db.get(`SELECT referral_code, document_id FROM partners WHERE user_id = ?`, [userId], (err, partner) => {
    if (err || !partner) return callback(err || new Error('Partner not found'));
    if (partner.referral_code) return callback(null, partner.referral_code);

    const attempt = () => {
      const code = generateReferralCode(fullName, partner.document_id);
      db.run(`UPDATE partners SET referral_code = ? WHERE user_id = ? AND (referral_code IS NULL OR referral_code = '')`, [code, userId], (updateErr) => {
        if (updateErr) {
          if (String(updateErr.message).includes('UNIQUE')) return attempt();
          return callback(updateErr);
        }
        callback(null, code);
      });
    };
    attempt();
  });
}

function getActiveCommissionSettings(callback) {
  db.get(`SELECT direct_percentage, level_1_percentage, level_2_percentage FROM commission_settings WHERE is_active = 1 ORDER BY id DESC LIMIT 1`, (err, row) => {
    callback(err, row || { direct_percentage: 10, level_1_percentage: 3, level_2_percentage: 1 });
  });
}

function getPartnerProfile(userId, callback) {
  db.get(`SELECT p.*, u.full_name, u.email, u.status
    FROM partners p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ?`, [userId], callback);
}

function money(value) {
  return Number(value || 0);
}

function maskName(value) {
  const parts = cleanText(value, 120).split(' ').filter(Boolean);
  if (!parts.length) return 'Referido';
  const first = parts[0];
  const second = parts[1] ? `${parts[1].charAt(0)}.` : '';
  return `${first} ${second}`.trim();
}

function publicReferral(row) {
  return {
    id: row.id,
    masked_name: maskName(row.referred_full_name),
    legal_area: row.legal_area,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    commission_amount: row.commission_amount || row.amount || 0,
    commission_status: row.commission_status,
    public_note: 'Seguimiento limitado por protección de datos. La firma confirmará novedades comerciales relevantes.'
  };
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function progressPercent(value, target) {
  const total = Number(target || 0);
  if (!total) return 0;
  return Math.min(100, Math.round((Number(value || 0) / total) * 100));
}

function getBaseUrl(req) {
  const frontendUrl = cleanText(process.env.FRONTEND_URL || '', 250).replace(/\/+$/, '');
  return frontendUrl || `${req.protocol}://${req.get('host')}`;
}

function createCommissionRows(referralId, sourceAllyId, callback) {
  getActiveCommissionSettings((settingsErr, settings) => {
    if (settingsErr) return callback(settingsErr);
    const createdAt = getTimestamp();
    const rows = [{
      allyId: sourceAllyId,
      sourceAllyId,
      type: 'direct',
      percentage: settings.direct_percentage
    }];

    getPartnerProfile(sourceAllyId, (profileErr, partner) => {
      if (profileErr) return callback(profileErr);
      const finish = () => {
        const stmt = db.prepare(`INSERT INTO commissions (ally_id, referral_id, source_ally_id, commission_type, percentage, amount, status, created_at)
          VALUES (?, ?, ?, ?, ?, 0, 'pending', ?)`);
        rows.forEach((row) => stmt.run(row.allyId, referralId, row.sourceAllyId, row.type, row.percentage, createdAt));
        stmt.finalize(callback);
      };

      if (!partner?.invited_by_partner_id) return finish();
      rows.push({
        allyId: partner.invited_by_partner_id,
        sourceAllyId,
        type: 'indirect_level_1',
        percentage: settings.level_1_percentage
      });

      getPartnerProfile(partner.invited_by_partner_id, (parentErr, parentPartner) => {
        if (!parentErr && parentPartner?.invited_by_partner_id && settings.level_2_percentage > 0) {
          rows.push({
            allyId: parentPartner.invited_by_partner_id,
            sourceAllyId,
            type: 'indirect_level_2',
            percentage: settings.level_2_percentage
          });
        }
        finish();
      });
    });
  });
}

function seedQaData() {
  const now = getTimestamp();
  const demoUsers = [
    { fullName: 'Aliado Demo Orjuela', email: 'aliado@orjuela.demo', password: 'Aliado123!', role: 'ally' },
    { fullName: 'Cliente Demo Orjuela', email: 'cliente@orjuela.demo', password: 'Cliente123!', role: 'client' },
    { fullName: 'Admin Demo Orjuela', email: 'admin@orjuela.demo', password: 'Admin123!', role: 'admin' }
  ];

  db.serialize(() => {
    const userStmt = db.prepare(`INSERT OR IGNORE INTO users (full_name, email, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)`);
    demoUsers.forEach((user) => {
      userStmt.run(user.fullName, user.email, hashPassword(user.password), user.role, now, now);
    });
    userStmt.finalize();

    db.get(`SELECT id FROM users WHERE email = ?`, ['aliado@orjuela.demo'], (err, partnerUser) => {
      if (!err && partnerUser) {
        db.run(`INSERT OR IGNORE INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, commission_balance)
          VALUES (?, '900111222', '300 111 2233', 'Bogota', 'Independiente', 'Orjuela QA', 'Ambiente QA', 320000)`, [partnerUser.id]);
        db.run(`UPDATE partners SET referral_code = COALESCE(referral_code, 'ORJUELAQA'), occupation = COALESCE(occupation, 'Asesor comercial') WHERE user_id = ?`, [partnerUser.id]);
        db.run(`UPDATE partners SET invited_by_partner_id = ? WHERE user_id IN (9101, 9102)`, [partnerUser.id]);
      }
    });

    const networkUsers = [
      { id: 9101, fullName: 'Camila Red Aliada', email: 'camila.red@orjuela.demo', password: 'Aliado123!', document: '900333111', phone: '300 333 1111', city: 'Medellin', code: 'CAMILAQA' },
      { id: 9102, fullName: 'Andres Red Aliado', email: 'andres.red@orjuela.demo', password: 'Aliado123!', document: '900333222', phone: '300 333 2222', city: 'Cali', code: 'ANDRESQA' }
    ];

    networkUsers.forEach((item) => {
      db.run(`INSERT OR IGNORE INTO users (id, full_name, email, password_hash, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'ally', 'active', ?, ?)`, [item.id, item.fullName, item.email, hashPassword(item.password), now, now]);
      db.run(`INSERT OR IGNORE INTO partners (user_id, document_id, phone, city, partner_type, occupation, referral_code, invited_by_partner_id, commission_balance)
        VALUES (?, ?, ?, ?, 'Independiente', 'Aliado comercial', ?, 1, 0)`, [item.id, item.document, item.phone, item.city, item.code]);
    });

    db.get(`SELECT id FROM users WHERE email = ?`, ['cliente@orjuela.demo'], (err, clientUser) => {
      if (!err && clientUser) {
        db.run(`INSERT OR IGNORE INTO auth_clients (user_id, document_id, assigned_lawyer)
          VALUES (?, '1020304050', 'Equipo inmobiliario')`, [clientUser.id]);
      }
    });

    db.run(`INSERT OR IGNORE INTO allies (full_name, document_number, phone, email, city, ally_type, how_known, status, created_at, updated_at)
      VALUES ('Aliado Demo Orjuela', '900111222', '300 111 2233', 'aliado@orjuela.demo', 'Bogota', 'independiente', 'Ambiente QA', 'active', ?, ?)`, [now, now]);

    db.run(`INSERT OR IGNORE INTO clients (id, name, document_id, phone, email, created_at)
      VALUES (1, 'Cliente Demo Orjuela', '1020304050', '310 222 3344', 'cliente@orjuela.demo', ?)`, [now]);

    const leadStmt = db.prepare(`INSERT OR IGNORE INTO leads (id, name, phone, email, case_type, source, status, assigned_to, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    [
      [1, 'Laura Mendez', '300 456 7890', 'laura@example.com', 'Derecho civil', 'Web', 'Nuevo', 'Comercial', 'Llamar hoy antes de las 5:00 p. m.'],
      [2, 'Inmobiliaria Norte', '311 222 3344', 'contacto@inmobiliaria.test', 'Contratos', 'Aliado', 'Contactado', 'Asistente', 'Enviar propuesta de revision contractual'],
      [3, 'Jorge Salinas', '315 987 1122', 'jorge@example.com', 'Cobro de cartera', 'WhatsApp', 'Agendado', 'Abogado civil', 'Preparar cita y documentos requeridos'],
      [4, 'Maria Fernanda Ruiz', '302 555 8844', 'maria@example.com', 'Derecho inmobiliario', 'Organico', 'Propuesta enviada', 'Equipo inmobiliario', 'Hacer seguimiento a aceptacion de propuesta']
    ].forEach((lead) => leadStmt.run(...lead, now, now));
    leadStmt.finalize();

    const caseStmt = db.prepare(`INSERT OR IGNORE INTO cases (id, client_id, case_type, description, status, assigned_lawyer, next_action, created_at)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?)`);
    [
      [1, 'Contrato de compraventa', 'Revision de documentos para compra de inmueble.', 'En revision', 'Equipo inmobiliario', 'Enviar certificado actualizado'],
      [2, 'Sucesion', 'Organizacion documental de sucesion familiar.', 'Documentos solicitados', 'Area civil y familia', 'Cargar registros civiles']
    ].forEach((caseItem) => caseStmt.run(...caseItem, now));
    caseStmt.finalize();

    db.get(`SELECT id FROM allies WHERE document_number = '900111222'`, (err, ally) => {
      if (!err && ally) {
        const referralStmt = db.prepare(`INSERT OR IGNORE INTO referrals (id, ally_id, referred_full_name, referred_phone, referred_email, referred_city, legal_area, case_description, urgency, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        [
          [1, ally.id, 'Maria Rodriguez', '301 444 7788', 'maria.rodriguez@example.com', 'Bogota', 'derecho_inmobiliario', 'Revision de promesa de compraventa.', 'Media', 'in_progress'],
          [2, ally.id, 'Carlos Perez', '312 456 8899', 'carlos.perez@example.com', 'Medellin', 'cobranza', 'Cobro de cartera comercial.', 'Alta', 'contacted'],
          [3, ally.id, 'Empresa Andina', '310 987 6543', 'legal@andina.test', 'Cali', 'contratos', 'Revision de contrato de suministro.', 'Baja', 'commission_approved']
        ].forEach((referral) => referralStmt.run(...referral, now, now));
        referralStmt.finalize();
      }
    });

    db.run(`INSERT OR IGNORE INTO commissions (id, ally_id, referral_id, source_ally_id, commission_type, percentage, amount, status, created_at)
      VALUES (1, 1, 1, 1, 'direct', 10, 180000, 'approved', ?)`, [now]);
    db.run(`INSERT OR IGNORE INTO commissions (id, ally_id, referral_id, source_ally_id, commission_type, percentage, amount, status, created_at, paid_at)
      VALUES (2, 1, 2, 1, 'direct', 10, 120000, 'paid', ?, ?)`, [now, now]);
    db.run(`INSERT OR IGNORE INTO commissions (id, ally_id, referral_id, source_ally_id, commission_type, percentage, amount, status, created_at)
      VALUES (3, 1, 3, 9101, 'indirect_level_1', 3, 90000, 'pending', ?)`, [now]);

    console.log('[qa] Demo data enabled. Users: aliado@orjuela.demo, cliente@orjuela.demo, admin@orjuela.demo');
  });
}

if (QA_DEMO_DATA) {
  seedQaData();
}

if (SEED_ACCESS_USERS || APP_ENV === 'production') {
  seedProductionAccessUsers();
}

function authorizeAdmin(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const payload = verifyToken(token);
  if (payload && ['admin', 'abogado', 'asistente'].includes(payload.role)) {
    req.user = payload;
    return next();
  }
  const password = (req.headers['x-admin-password'] || '').toString();
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function auditAdminAction(req, action, entityType, entityId, summary = '') {
  const actor = req.user || {};
  db.run(`INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    actor.id || null,
    actor.full_name || actor.email || 'Administrador',
    action,
    entityType,
    entityId || null,
    cleanText(summary, 500),
    getTimestamp()
  ], () => {});
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: APP_ENV, demoData: QA_DEMO_DATA });
});

app.post('/api/auth/register-client', (req, res) => {
  const createdAt = getTimestamp();
  const payload = {
    full_name: cleanText(req.body.full_name, 140),
    document_id: cleanText(req.body.document_id, 40),
    phone: cleanText(req.body.phone, 30),
    email: normalizeEmail(req.body.email),
    city: cleanText(req.body.city, 80),
    password: String(req.body.password || ''),
    terms: req.body.terms === true,
    data_auth: req.body.data_auth === true
  };

  if (!payload.full_name || !payload.email || !payload.password || !payload.terms) {
    return res.status(400).json({ error: 'Completa todos los campos obligatorios.' });
  }
  if (!isValidEmail(payload.email)) {
    return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
  }
  const passwordError = validatePasswordStrength(payload.password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (payload.document_id && !normalizeDocument(payload.document_id)) {
    return res.status(400).json({ error: 'Ingresa una cédula válida.' });
  }
  const documentId = normalizeDocument(payload.document_id) || generatedDocumentId('CLIENTE', payload.email);

  db.get(`SELECT id FROM users WHERE email = ? OR document_id = ?`, [payload.email, documentId], (existingErr, existing) => {
    if (existingErr) return res.status(500).json({ error: 'Error validando usuario.' });
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo o cédula.' });

    db.run(`INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'client', 'active', ?, ?)`,
      [payload.full_name, documentId, payload.email, hashPassword(payload.password), createdAt, createdAt], function insertUser(err) {
        if (err) return res.status(500).json({ error: 'No fue posible crear la cuenta de cliente.' });
        const userId = this.lastID;
        db.run(`INSERT INTO auth_clients (user_id, document_id, assigned_lawyer) VALUES (?, ?, 'Equipo Orjuela')`, [userId, documentId]);
        db.run(`INSERT INTO clients (name, document_id, phone, email, created_at) VALUES (?, ?, ?, ?, ?)`, [payload.full_name, documentId, payload.phone, payload.email, createdAt]);
        res.status(201).json(createAuthResponse({ id: userId, full_name: payload.full_name, document_id: documentId, email: payload.email, role: 'client', status: 'active', auth_provider: 'password' }));
      });
  });
});

app.post('/api/auth/register-admin', (req, res) => {
  const createdAt = getTimestamp();
  const payload = {
    full_name: cleanText(req.body.full_name, 140),
    document_id: cleanText(req.body.document_id, 40),
    email: normalizeEmail(req.body.email),
    password: String(req.body.password || ''),
    admin_registration_code: String(req.body.admin_registration_code || ''),
    terms: req.body.terms === true
  };

  if (!payload.full_name || !payload.email || !payload.password || !payload.admin_registration_code || !payload.terms) {
    return res.status(400).json({ error: 'Completa todos los campos obligatorios.' });
  }
  if (payload.admin_registration_code !== ADMIN_REGISTRATION_CODE) {
    return res.status(403).json({ error: 'Código interno no válido para crear administradores.' });
  }
  if (!isValidEmail(payload.email)) {
    return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
  }
  const passwordError = validatePasswordStrength(payload.password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (payload.document_id && !normalizeDocument(payload.document_id)) {
    return res.status(400).json({ error: 'Ingresa una cédula válida.' });
  }
  const documentId = normalizeDocument(payload.document_id) || generatedDocumentId('ADMIN', payload.email);

  db.get(`SELECT id FROM users WHERE email = ? OR document_id = ?`, [payload.email, documentId], (existingErr, existing) => {
    if (existingErr) return res.status(500).json({ error: 'Error validando usuario.' });
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo o cédula.' });

    db.run(`INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?)`,
      [payload.full_name, documentId, payload.email, hashPassword(payload.password), createdAt, createdAt], function insertUser(err) {
        if (err) return res.status(500).json({ error: 'No fue posible crear la cuenta administrativa.' });
        res.status(201).json(createAuthResponse({ id: this.lastID, full_name: payload.full_name, document_id: documentId, email: payload.email, role: 'admin', status: 'active', auth_provider: 'password' }));
      });
  });
});

app.post('/api/auth/register-partner', (req, res) => {
  const payload = {
    full_name: cleanText(req.body.full_name),
    document_id: normalizeDocument(req.body.document_id),
    phone: cleanText(req.body.phone, 60),
    email: normalizeEmail(req.body.email),
    city: cleanText(req.body.city, 100),
    partner_type: cleanText(req.body.partner_type, 60) || 'Independiente',
    company: cleanText(req.body.company, 120),
    how_known: cleanText(req.body.how_known, 180) || 'Registro web',
    occupation: cleanText(req.body.occupation, 120) || 'Aliado referidor',
    ref: cleanText(req.query.ref || req.body.ref || req.body.referral_code, 40).toUpperCase(),
    password: String(req.body.password || ''),
    terms: req.body.terms,
    data_auth: req.body.data_auth
  };

  if (!payload.full_name || !payload.email || !payload.password || payload.terms !== true || payload.data_auth !== true) {
    return res.status(400).json({ error: 'Completa los campos obligatorios y acepta las políticas.' });
  }
  if (!isValidEmail(payload.email)) {
    return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
  }
  const passwordError = validatePasswordStrength(payload.password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  payload.document_id = payload.document_id || generatedDocumentId('ALIADO', payload.email);

  const createdAt = getTimestamp();
  db.get(`SELECT user_id FROM partners WHERE referral_code = ?`, [payload.ref], (refErr, referrer) => {
    if (refErr) {
      console.error(refErr);
      return res.status(500).json({ error: 'Error al validar el codigo de invitacion.' });
    }
    db.get(`SELECT u.id FROM users u
      LEFT JOIN partners p ON p.user_id = u.id
      WHERE u.email = ? OR p.document_id = ? OR (? <> '' AND p.phone = ?)`, [payload.email, payload.document_id, payload.phone, payload.phone], (dupErr, duplicate) => {
      if (dupErr) {
        console.error(dupErr);
        return res.status(500).json({ error: 'Error al validar duplicados.' });
      }
      if (duplicate) {
        return res.status(409).json({ error: 'Ya existe un aliado registrado con ese correo, cedula o telefono.' });
      }

      db.serialize(() => {
    const stmt = db.prepare(`INSERT INTO users (full_name, email, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, 'ally', 'active', ?, ?)`);
    stmt.run(payload.full_name, payload.email, hashPassword(payload.password), createdAt, createdAt, function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe una cuenta con este correo.' });
        console.error(err);
        return res.status(500).json({ error: 'Error al crear usuario.' });
      }

      const userId = this.lastID;
      const referralCode = generateReferralCode(payload.full_name, payload.document_id);
      db.run(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, referral_code, invited_by_partner_id, commission_balance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`, [userId, payload.document_id, payload.phone, payload.city, payload.partner_type, payload.company, payload.how_known, payload.occupation, referralCode, referrer?.user_id || null], (partnerErr) => {
        if (partnerErr) {
          console.error(partnerErr);
          return res.status(500).json({ error: 'Error al crear perfil de aliado.' });
        }

        const user = { id: userId, full_name: payload.full_name, email: payload.email, role: 'ally', status: 'active' };
        res.status(201).json({ message: 'Tu cuenta de aliado fue creada exitosamente.', token: signToken(user), user });
      });
    });
    stmt.finalize();
      });
    });
  });
});

app.post('/api/auth/google', (req, res) => {
  const requestedRole = cleanText(req.body.role, 20);
  if (!['ally', 'client', 'admin'].includes(requestedRole)) {
    return res.status(400).json({ error: 'Selecciona un tipo de acceso válido.' });
  }

  verifyGoogleCredential(String(req.body.credential || req.body.access_token || ''), (verifyErr, googleProfile) => {
    if (verifyErr || !googleProfile?.email) {
      return res.status(401).json({ error: 'No fue posible validar tu cuenta de Google.' });
    }

    db.get(`SELECT id, full_name, document_id, email, password_hash, auth_provider, google_sub, avatar_url, role, status FROM users WHERE email = ?`, [googleProfile.email], (selectErr, existingUser) => {
      if (selectErr) return res.status(500).json({ error: 'Error validando usuario.' });

      if (existingUser) {
        if (existingUser.status !== 'active') return res.status(403).json({ error: 'Esta cuenta no está activa.' });
        if (requestedRole === 'admin' && !['admin', 'abogado', 'asistente'].includes(existingUser.role)) {
          return res.status(403).json({ error: 'Acceso exclusivo para personal autorizado.' });
        }
        if (requestedRole === 'ally' && existingUser.role !== 'ally') {
          return res.status(403).json({ error: 'Esta cuenta no pertenece al portal de aliados.' });
        }
        if (requestedRole === 'client' && existingUser.role !== 'client') {
          return res.status(403).json({ error: 'Esta cuenta no pertenece al portal de clientes.' });
        }

        const updatedUser = {
          ...existingUser,
          full_name: existingUser.full_name || googleProfile.full_name,
          google_sub: existingUser.google_sub || googleProfile.google_sub,
          avatar_url: googleProfile.avatar_url || existingUser.avatar_url,
          auth_provider: existingUser.auth_provider === 'password' ? 'password,google' : (existingUser.auth_provider || 'google')
        };
        db.run(`UPDATE users SET full_name = ?, google_sub = COALESCE(google_sub, ?), avatar_url = ?, auth_provider = ?, updated_at = ? WHERE id = ?`,
          [updatedUser.full_name, googleProfile.google_sub, updatedUser.avatar_url, updatedUser.auth_provider, getTimestamp(), existingUser.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'No fue posible actualizar la cuenta.' });
            ensureRoleProfile(updatedUser, (profileErr) => {
              if (profileErr) return res.status(500).json({ error: 'No fue posible preparar tu perfil.' });
              res.json(createAuthResponse(updatedUser));
            });
          });
        return;
      }

      if (requestedRole === 'admin') {
        return res.status(403).json({ error: 'El acceso con Google al panel interno requiere una cuenta previamente autorizada.' });
      }

      const now = getTimestamp();
      const documentId = generatedDocumentId(requestedRole === 'ally' ? 'ALIADO' : 'CLIENTE', googleProfile.email);
      const passwordHash = hashPassword(crypto.randomBytes(24).toString('hex'));
      db.run(`INSERT INTO users (full_name, document_id, email, password_hash, auth_provider, google_sub, avatar_url, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'google', ?, ?, ?, 'active', ?, ?)`,
        [googleProfile.full_name, documentId, googleProfile.email, passwordHash, googleProfile.google_sub, googleProfile.avatar_url, requestedRole, now, now], function insertGoogleUser(insertErr) {
          if (insertErr) return res.status(500).json({ error: 'No fue posible crear la cuenta con Google.' });
          const user = {
            id: this.lastID,
            full_name: googleProfile.full_name,
            document_id: documentId,
            email: googleProfile.email,
            avatar_url: googleProfile.avatar_url,
            auth_provider: 'google',
            role: requestedRole,
            status: 'active'
          };
          ensureRoleProfile(user, (profileErr) => {
            if (profileErr) return res.status(500).json({ error: 'No fue posible preparar tu perfil.' });
            res.status(201).json(createAuthResponse(user));
          });
        });
    });
  });
});

app.post('/api/auth/login', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const requestedRole = cleanText(req.body.role, 20);

  if (!email || !password || !requestedRole) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
  }

  db.get(`SELECT id, full_name, document_id, email, password_hash, auth_provider, avatar_url, role, status FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al validar credenciales.' });
    }

    if (!user && requestedRole === 'admin' && password === ADMIN_PASSWORD) {
      const adminUser = { id: 0, full_name: 'Equipo Orjuela', email, role: 'admin', status: 'active' };
      return res.json({ token: signToken(adminUser), user: adminUser });
    }

    if (!user || user.status !== 'active' || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
    if (requestedRole === 'admin' && !['admin', 'abogado', 'asistente'].includes(user.role)) {
      return res.status(403).json({ error: 'Acceso exclusivo para personal autorizado.' });
    }
    if (requestedRole === 'ally' && user.role !== 'ally') {
      return res.status(403).json({ error: 'Esta cuenta no pertenece al portal de aliados.' });
    }
    if (requestedRole === 'client' && user.role !== 'client') {
      return res.status(403).json({ error: 'Esta cuenta no pertenece al portal de clientes.' });
    }

    const safeUser = publicUser(user);
    res.json({ token: signToken(safeUser), user: safeUser });
  });
});

app.get('/api/auth/me', requireAuth(AUTH_ROLES), (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/admin/dashboard', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const reports = {};
  db.get(`SELECT COUNT(*) AS total FROM leads`, (leadErr, leadCount) => {
    if (leadErr) return res.status(500).json({ error: 'No fue posible cargar dashboard.' });
    db.get(`SELECT COUNT(*) AS total FROM cases`, (caseErr, caseCount) => {
      if (caseErr) return res.status(500).json({ error: 'No fue posible cargar casos.' });
      db.get(`SELECT COUNT(*) AS total FROM clients`, (clientErr, clientCount) => {
        if (clientErr) return res.status(500).json({ error: 'No fue posible cargar clientes.' });
        db.get(`SELECT COUNT(*) AS total FROM referrals`, (refErr, refCount) => {
          if (refErr) return res.status(500).json({ error: 'No fue posible cargar referidos.' });
          db.get(`SELECT COALESCE(SUM(amount), 0) AS total FROM commissions WHERE status = 'pending'`, (commErr, comm) => {
            if (commErr) return res.status(500).json({ error: 'No fue posible cargar comisiones.' });
            db.get(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status <> 'Pagado'`, (payErr, pendingPayments) => {
              if (payErr) return res.status(500).json({ error: 'No fue posible cargar pagos.' });
              db.all(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 8`, (recentErr, recentLeads) => {
                if (recentErr) return res.status(500).json({ error: 'No fue posible cargar leads.' });
                reports.leads = leadCount.total || 0;
                reports.cases = caseCount.total || 0;
                reports.clients = clientCount.total || 0;
                reports.referrals = refCount.total || 0;
                reports.pending_commissions = comm.total || 0;
                reports.pending_payments = pendingPayments.total || 0;
                reports.conversion_rate = reports.leads ? Math.round((reports.cases / reports.leads) * 100) : 0;
                res.json({
                  reports,
                  recentLeads,
                  deadlines: [],
                  appointments: [],
                  metrics: [
                    { label: 'Nuevos leads', value: String(reports.leads) },
                    { label: 'Casos activos', value: String(reports.cases) },
                    { label: 'Referidos del mes', value: String(reports.referrals) },
                    { label: 'Clientes activos', value: String(reports.clients) },
                    { label: 'Comisiones pendientes', value: formatMoney(reports.pending_commissions) },
                    { label: 'Pagos pendientes', value: formatMoney(reports.pending_payments) }
                  ]
                });
              });
            });
          });
        });
      });
    });
  });
});

app.get('/api/admin/leads', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  db.all(`SELECT * FROM leads ORDER BY updated_at DESC, created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'No fue posible cargar leads.' });
    res.json(rows);
  });
});

app.post('/api/admin/leads', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const payload = {
    name: cleanText(req.body.name, 140),
    phone: cleanText(req.body.phone, 60),
    email: normalizeEmail(req.body.email),
    case_type: cleanText(req.body.case_type, 80),
    source: cleanText(req.body.source || 'Web', 40),
    assigned_to: cleanText(req.body.assigned_to || req.user.full_name, 100),
    priority: cleanText(req.body.priority || 'Media', 20),
    next_action: cleanText(req.body.next_action || 'Contactar al lead', 180),
    notes: cleanText(req.body.notes, 1000)
  };
  if (!payload.name || !payload.phone || !payload.case_type) return res.status(400).json({ error: 'Nombre, teléfono y tipo de caso son obligatorios.' });
  if (payload.email && !isValidEmail(payload.email)) return res.status(400).json({ error: 'Correo inválido.' });
  const now = getTimestamp();
  db.run(`INSERT INTO leads (name, phone, email, case_type, source, status, assigned_to, notes, priority, next_action, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'Nuevo', ?, ?, ?, ?, ?, ?)`,
    [payload.name, payload.phone, payload.email, payload.case_type, payload.source, payload.assigned_to, payload.notes, payload.priority, payload.next_action, now, now], function (err) {
      if (err) return res.status(500).json({ error: 'No fue posible crear el lead.' });
      res.status(201).json({ id: this.lastID, ...payload, status: 'Nuevo', created_at: now, updated_at: now });
    });
});

app.patch('/api/admin/leads/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = cleanText(req.body.status, 40);
  const assignedTo = cleanText(req.body.assigned_to, 100);
  const nextAction = cleanText(req.body.next_action, 180);
  if (!id) return res.status(400).json({ error: 'Lead inválido.' });
  db.run(`UPDATE leads SET
      status = COALESCE(NULLIF(?, ''), status),
      assigned_to = COALESCE(NULLIF(?, ''), assigned_to),
      next_action = COALESCE(NULLIF(?, ''), next_action),
      updated_at = ?
    WHERE id = ?`, [status, assignedTo, nextAction, getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar el lead.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Lead no encontrado.' });
    res.json({ message: 'Lead actualizado.' });
  });
});

app.post('/api/admin/leads/:id/convert', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Lead inválido.' });
  db.get(`SELECT * FROM leads WHERE id = ?`, [id], (leadErr, lead) => {
    if (leadErr) return res.status(500).json({ error: 'No fue posible cargar el lead.' });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado.' });
    const now = getTimestamp();
    db.get(`SELECT id FROM clients WHERE email = ? OR phone = ?`, [lead.email, lead.phone], (clientErr, existingClient) => {
      if (clientErr) return res.status(500).json({ error: 'No fue posible validar cliente.' });
      const createCase = (clientId) => {
        db.run(`INSERT INTO cases (client_id, case_type, description, status, assigned_lawyer, next_action, created_at, updated_at)
          VALUES (?, ?, ?, 'Recibido', ?, ?, ?, ?)`,
          [clientId, lead.case_type, lead.notes || '', lead.assigned_to || 'Equipo Orjuela', lead.next_action || 'Revisar documentación inicial', now, now], function (caseErr) {
            if (caseErr) return res.status(500).json({ error: 'No fue posible crear el caso.' });
            db.run(`UPDATE leads SET status = 'Convertido en caso', updated_at = ? WHERE id = ?`, [now, id]);
            res.status(201).json({ message: 'Lead convertido en caso.', case_id: this.lastID, client_id: clientId });
          });
      };
      if (existingClient) return createCase(existingClient.id);
      db.run(`INSERT INTO clients (name, phone, email, city, created_at, updated_at, verified)
        VALUES (?, ?, ?, '', ?, ?, 0)`, [lead.name, lead.phone, lead.email, now, now], function (insertErr) {
        if (insertErr) return res.status(500).json({ error: 'No fue posible crear el cliente.' });
        createCase(this.lastID);
      });
    });
  });
});

app.get('/api/admin/clients', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  db.all(`SELECT * FROM clients WHERE COALESCE(status, 'Activo') <> 'Archivado' ORDER BY created_at DESC`, (err, rows) => err ? res.status(500).json({ error: 'No fue posible cargar clientes.' }) : res.json(rows));
});

app.post('/api/admin/clients', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const payload = {
    name: cleanText(req.body.name, 140),
    document_id: cleanText(req.body.document_id, 40),
    phone: cleanText(req.body.phone, 60),
    email: normalizeEmail(req.body.email),
    city: cleanText(req.body.city, 80),
    address: cleanText(req.body.address, 160),
    verified: req.body.verified ? 1 : 0
  };
  if (!payload.name || !payload.phone) return res.status(400).json({ error: 'Nombre y teléfono son obligatorios.' });
  if (payload.email && !isValidEmail(payload.email)) return res.status(400).json({ error: 'Correo inválido.' });
  const now = getTimestamp();
  db.run(`INSERT INTO clients (name, document_id, phone, email, city, address, verified, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Activo', ?, ?)`, [payload.name, payload.document_id, payload.phone, payload.email, payload.city, payload.address, payload.verified, now, now], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear cliente.' });
    auditAdminAction(req, 'crear', 'cliente', this.lastID, payload.name);
    res.status(201).json({ id: this.lastID, ...payload, status: 'Activo', created_at: now, updated_at: now });
  });
});

app.patch('/api/admin/clients/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const payload = {
    name: cleanText(req.body.name, 140),
    document_id: cleanText(req.body.document_id, 40),
    phone: cleanText(req.body.phone, 60),
    email: normalizeEmail(req.body.email),
    city: cleanText(req.body.city, 80),
    address: cleanText(req.body.address, 160),
    status: cleanText(req.body.status, 30),
    verified: req.body.verified === undefined ? null : req.body.verified ? 1 : 0
  };
  if (!id) return res.status(400).json({ error: 'Cliente inválido.' });
  db.run(`UPDATE clients SET
      name = COALESCE(NULLIF(?, ''), name),
      document_id = COALESCE(NULLIF(?, ''), document_id),
      phone = COALESCE(NULLIF(?, ''), phone),
      email = COALESCE(NULLIF(?, ''), email),
      city = COALESCE(NULLIF(?, ''), city),
      address = COALESCE(NULLIF(?, ''), address),
      status = COALESCE(NULLIF(?, ''), status),
      verified = COALESCE(?, verified),
      updated_at = ?
    WHERE id = ?`, [payload.name, payload.document_id, payload.phone, payload.email, payload.city, payload.address, payload.status, payload.verified, getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar cliente.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    auditAdminAction(req, 'actualizar', 'cliente', id, payload.name || 'Cliente actualizado');
    res.json({ message: 'Cliente actualizado.' });
  });
});

app.delete('/api/admin/clients/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Cliente inválido.' });
  db.run(`UPDATE clients SET status = 'Archivado', updated_at = ? WHERE id = ?`, [getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar cliente.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    auditAdminAction(req, 'archivar', 'cliente', id, 'Cliente archivado');
    res.json({ message: 'Cliente archivado.' });
  });
});

app.get('/api/admin/cases', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  db.all(`SELECT ca.*, cl.name AS client_name, cl.email AS client_email, cl.phone AS client_phone
    FROM cases ca JOIN clients cl ON cl.id = ca.client_id
    WHERE ca.archived_at IS NULL
    ORDER BY COALESCE(ca.updated_at, ca.created_at) DESC`, (err, rows) => err ? res.status(500).json({ error: 'No fue posible cargar casos.' }) : res.json(rows));
});

app.post('/api/admin/cases', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const payload = {
    client_name: cleanText(req.body.client_name, 140),
    client_phone: cleanText(req.body.client_phone, 60),
    client_email: normalizeEmail(req.body.client_email),
    case_type: cleanText(req.body.case_type, 80),
    description: cleanText(req.body.description, 1000),
    status: cleanText(req.body.status || 'Recibido', 40),
    assigned_lawyer: cleanText(req.body.assigned_lawyer || req.user.full_name, 100),
    next_action: cleanText(req.body.next_action || 'Revisar documentación inicial', 180)
  };
  if (!payload.client_name || !payload.client_phone || !payload.case_type) return res.status(400).json({ error: 'Cliente, teléfono y tipo de caso son obligatorios.' });
  const now = getTimestamp();
  db.run(`INSERT INTO clients (name, phone, email, city, created_at, updated_at, verified) VALUES (?, ?, ?, '', ?, ?, 0)`,
    [payload.client_name, payload.client_phone, payload.client_email, now, now], function (clientErr) {
      if (clientErr) return res.status(500).json({ error: 'No fue posible crear cliente.' });
      db.run(`INSERT INTO cases (client_id, case_type, description, status, assigned_lawyer, next_action, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.lastID, payload.case_type, payload.description, payload.status, payload.assigned_lawyer, payload.next_action, now, now], function (caseErr) {
          if (caseErr) return res.status(500).json({ error: 'No fue posible crear caso.' });
          res.status(201).json({ message: 'Caso creado.', id: this.lastID });
        });
    });
});

app.patch('/api/admin/cases/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const payload = {
    case_type: cleanText(req.body.case_type, 80),
    description: cleanText(req.body.description, 1000),
    status: cleanText(req.body.status, 40),
    assigned_lawyer: cleanText(req.body.assigned_lawyer, 100),
    next_action: cleanText(req.body.next_action, 180)
  };
  if (!id) return res.status(400).json({ error: 'Caso inválido.' });
  db.run(`UPDATE cases SET
      case_type = COALESCE(NULLIF(?, ''), case_type),
      description = COALESCE(NULLIF(?, ''), description),
      status = COALESCE(NULLIF(?, ''), status),
      assigned_lawyer = COALESCE(NULLIF(?, ''), assigned_lawyer),
      next_action = COALESCE(NULLIF(?, ''), next_action),
      updated_at = ?
    WHERE id = ?`, [payload.case_type, payload.description, payload.status, payload.assigned_lawyer, payload.next_action, getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar caso.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Caso no encontrado.' });
    auditAdminAction(req, 'actualizar', 'caso', id, payload.case_type || payload.status || 'Caso actualizado');
    res.json({ message: 'Caso actualizado.' });
  });
});

app.delete('/api/admin/cases/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Caso inválido.' });
  db.run(`UPDATE cases SET archived_at = ?, status = 'Archivado', updated_at = ? WHERE id = ?`, [getTimestamp(), getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar caso.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Caso no encontrado.' });
    auditAdminAction(req, 'archivar', 'caso', id, 'Caso archivado');
    res.json({ message: 'Caso archivado.' });
  });
});

app.get('/api/admin/payments', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  db.all(`SELECT * FROM payments ORDER BY created_at DESC`, (err, rows) => err ? res.status(500).json({ error: 'No fue posible cargar pagos.' }) : res.json(rows));
});

app.post('/api/admin/payments', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const payload = {
    related_type: cleanText(req.body.related_type || 'case', 40),
    related_id: parseInt(req.body.related_id, 10),
    concept: cleanText(req.body.concept, 140),
    amount: Number(req.body.amount),
    status: cleanText(req.body.status || 'Pendiente', 40),
    payment_date: cleanText(req.body.payment_date, 40),
    support_url: cleanText(req.body.support_url, 220)
  };
  if (!payload.related_id || Number.isNaN(payload.amount) || payload.amount < 0) return res.status(400).json({ error: 'Relacionado y monto son obligatorios.' });
  const now = getTimestamp();
  db.run(`INSERT INTO payments (related_type, related_id, concept, amount, status, payment_date, support_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [payload.related_type, payload.related_id, payload.concept, payload.amount, payload.status, payload.payment_date, payload.support_url, now, now], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear pago.' });
    auditAdminAction(req, 'crear', 'pago', this.lastID, payload.concept || String(payload.amount));
    res.status(201).json({ id: this.lastID, ...payload, created_at: now, updated_at: now });
  });
});

app.patch('/api/admin/payments/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const amount = req.body.amount === undefined ? null : Number(req.body.amount);
  if (!id) return res.status(400).json({ error: 'Pago inválido.' });
  db.run(`UPDATE payments SET
      concept = COALESCE(NULLIF(?, ''), concept),
      amount = COALESCE(?, amount),
      status = COALESCE(NULLIF(?, ''), status),
      payment_date = COALESCE(NULLIF(?, ''), payment_date),
      support_url = COALESCE(NULLIF(?, ''), support_url),
      updated_at = ?
    WHERE id = ?`, [
    cleanText(req.body.concept, 140),
    amount !== null && !Number.isNaN(amount) ? amount : null,
    cleanText(req.body.status, 40),
    cleanText(req.body.payment_date, 40),
    cleanText(req.body.support_url, 220),
    getTimestamp(),
    id
  ], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar pago.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Pago no encontrado.' });
    auditAdminAction(req, 'actualizar', 'pago', id, 'Pago actualizado');
    res.json({ message: 'Pago actualizado.' });
  });
});

app.delete('/api/admin/payments/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Pago inválido.' });
  db.run(`UPDATE payments SET status = 'Archivado', updated_at = ? WHERE id = ?`, [getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar pago.' });
    auditAdminAction(req, 'archivar', 'pago', id, 'Pago archivado');
    res.json({ message: 'Pago archivado.' });
  });
});

app.get('/api/admin/documents', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  db.all(`SELECT d.*, ca.case_type, cl.name AS client_name
    FROM case_documents d
    JOIN cases ca ON ca.id = d.case_id
    JOIN clients cl ON cl.id = ca.client_id
    ORDER BY d.uploaded_at DESC`, (err, rows) => err ? res.status(500).json({ error: 'No fue posible cargar documentos.' }) : res.json(rows));
});

app.post('/api/admin/documents', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const caseId = parseInt(req.body.case_id, 10);
  const payload = {
    file_name: cleanText(req.body.file_name, 180),
    file_url: cleanText(req.body.file_url || '#', 220),
    document_type: cleanText(req.body.document_type || 'General', 80),
    status: cleanText(req.body.status || 'Recibido', 40),
    observations: cleanText(req.body.observations, 500)
  };
  if (!caseId || !payload.file_name) return res.status(400).json({ error: 'Caso y nombre de documento son obligatorios.' });
  db.run(`INSERT INTO case_documents (case_id, file_name, file_url, document_type, status, observations, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`, [caseId, payload.file_name, payload.file_url, payload.document_type, payload.status, payload.observations, getTimestamp()], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear documento.' });
    auditAdminAction(req, 'crear', 'documento', this.lastID, payload.file_name);
    res.status(201).json({ id: this.lastID, case_id: caseId, ...payload });
  });
});

app.patch('/api/admin/documents/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Documento inválido.' });
  db.run(`UPDATE case_documents SET
      file_name = COALESCE(NULLIF(?, ''), file_name),
      document_type = COALESCE(NULLIF(?, ''), document_type),
      status = COALESCE(NULLIF(?, ''), status),
      observations = COALESCE(NULLIF(?, ''), observations)
    WHERE id = ?`, [cleanText(req.body.file_name, 180), cleanText(req.body.document_type, 80), cleanText(req.body.status, 40), cleanText(req.body.observations, 500), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar documento.' });
    auditAdminAction(req, 'actualizar', 'documento', id, 'Documento actualizado');
    res.json({ message: 'Documento actualizado.' });
  });
});

app.delete('/api/admin/documents/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Documento inválido.' });
  db.run(`UPDATE case_documents SET status = 'Archivado' WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar documento.' });
    auditAdminAction(req, 'archivar', 'documento', id, 'Documento archivado');
    res.json({ message: 'Documento archivado.' });
  });
});

app.get('/api/admin/agenda', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  db.all(`SELECT id, title, client_name, related_type, related_id, assigned_to, scheduled_at AS date, status, notes
    FROM admin_agenda
    WHERE status <> 'Archivado'
    ORDER BY scheduled_at DESC LIMIT 40`, (agendaErr, agendaRows) => {
    if (agendaErr) return res.status(500).json({ error: 'No fue posible cargar agenda.' });
    if (agendaRows.length) return res.json(agendaRows);
    db.all(`SELECT ca.id, cl.name AS client_name, ca.next_action AS title, 'case' AS related_type, ca.id AS related_id,
        ca.assigned_lawyer AS assigned_to, ca.status, COALESCE(ca.updated_at, ca.created_at) AS date
      FROM cases ca JOIN clients cl ON cl.id = ca.client_id
      WHERE ca.status <> 'Finalizado' AND ca.archived_at IS NULL
      ORDER BY date DESC LIMIT 20`, (err, rows) => err ? res.status(500).json({ error: 'No fue posible cargar agenda.' }) : res.json(rows));
  });
});

app.post('/api/admin/agenda', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const payload = {
    title: cleanText(req.body.title, 160),
    client_name: cleanText(req.body.client_name, 140),
    related_type: cleanText(req.body.related_type || 'case', 40),
    related_id: req.body.related_id ? parseInt(req.body.related_id, 10) : null,
    assigned_to: cleanText(req.body.assigned_to || req.user.full_name, 100),
    scheduled_at: cleanText(req.body.scheduled_at, 60),
    status: cleanText(req.body.status || 'Programada', 40),
    notes: cleanText(req.body.notes, 500)
  };
  if (!payload.title || !payload.scheduled_at) return res.status(400).json({ error: 'Título y fecha son obligatorios.' });
  const now = getTimestamp();
  db.run(`INSERT INTO admin_agenda (title, client_name, related_type, related_id, assigned_to, scheduled_at, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [payload.title, payload.client_name, payload.related_type, payload.related_id, payload.assigned_to, payload.scheduled_at, payload.status, payload.notes, now, now], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear agenda.' });
    auditAdminAction(req, 'crear', 'agenda', this.lastID, payload.title);
    res.status(201).json({ id: this.lastID, ...payload });
  });
});

app.patch('/api/admin/agenda/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Agenda inválida.' });
  db.run(`UPDATE admin_agenda SET
      title = COALESCE(NULLIF(?, ''), title),
      client_name = COALESCE(NULLIF(?, ''), client_name),
      assigned_to = COALESCE(NULLIF(?, ''), assigned_to),
      scheduled_at = COALESCE(NULLIF(?, ''), scheduled_at),
      status = COALESCE(NULLIF(?, ''), status),
      notes = COALESCE(NULLIF(?, ''), notes),
      updated_at = ?
    WHERE id = ?`, [cleanText(req.body.title, 160), cleanText(req.body.client_name, 140), cleanText(req.body.assigned_to, 100), cleanText(req.body.scheduled_at, 60), cleanText(req.body.status, 40), cleanText(req.body.notes, 500), getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar agenda.' });
    auditAdminAction(req, 'actualizar', 'agenda', id, 'Agenda actualizada');
    res.json({ message: 'Agenda actualizada.' });
  });
});

app.delete('/api/admin/agenda/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Agenda inválida.' });
  db.run(`UPDATE admin_agenda SET status = 'Archivado', updated_at = ? WHERE id = ?`, [getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar agenda.' });
    auditAdminAction(req, 'archivar', 'agenda', id, 'Agenda archivada');
    res.json({ message: 'Agenda archivada.' });
  });
});

app.get('/api/admin/reports', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  db.get(`SELECT COUNT(*) AS leads FROM leads`, (leadErr, leads) => {
    if (leadErr) return res.status(500).json({ error: 'No fue posible cargar reportes.' });
    db.get(`SELECT COUNT(*) AS cases FROM cases`, (caseErr, casesRow) => {
      if (caseErr) return res.status(500).json({ error: 'No fue posible cargar reportes.' });
      db.get(`SELECT COALESCE(SUM(amount), 0) AS pending_payments FROM payments WHERE status <> 'Pagado'`, (payErr, paymentsRow) => {
        if (payErr) return res.status(500).json({ error: 'No fue posible cargar reportes.' });
        res.json({
          leads: leads.leads || 0,
          cases: casesRow.cases || 0,
          pending_payments: paymentsRow.pending_payments || 0,
          conversion_rate: leads.leads ? Math.round((casesRow.cases / leads.leads) * 100) : 0
        });
      });
    });
  });
});

app.get('/api/client/profile', requireAuth(['client']), (req, res) => {
  db.get(`SELECT u.full_name, u.document_id, u.email, u.created_at AS user_created_at,
      c.phone, c.city, c.address, c.created_at, c.updated_at, c.verified,
      ac.assigned_lawyer
    FROM users u
    LEFT JOIN clients c ON c.email = u.email OR c.document_id = u.document_id
    LEFT JOIN auth_clients ac ON ac.user_id = u.id
    WHERE u.id = ?`, [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'No fue posible cargar tu perfil.' });
    if (!row) return res.status(404).json({ error: 'No encontramos tu perfil de cliente.' });
    res.json({
      full_name: row.full_name,
      document_id: row.document_id || '',
      email: row.email,
      phone: row.phone || '',
      city: row.city || '',
      address: row.address || '',
      created_at: row.created_at || row.user_created_at,
      updated_at: row.updated_at || row.created_at || row.user_created_at,
      verified: Boolean(row.verified),
      assigned_lawyer: row.assigned_lawyer || 'Equipo Orjuela'
    });
  });
});

app.patch('/api/client/profile', requireAuth(['client']), (req, res) => {
  const payload = {
    full_name: cleanText(req.body.full_name, 140),
    phone: cleanText(req.body.phone, 30),
    city: cleanText(req.body.city, 80),
    address: cleanText(req.body.address, 160)
  };

  if (!payload.full_name || payload.full_name.length < 3 || !payload.phone || !payload.city) {
    return res.status(400).json({ error: 'Nombre, teléfono y ciudad son obligatorios.' });
  }
  if (!/^3\d{9}$|^\+57\s?3\d{9}$/.test(payload.phone)) {
    return res.status(400).json({ error: 'Ingresa un celular colombiano válido.' });
  }

  const updatedAt = getTimestamp();
  db.serialize(() => {
    db.run(`UPDATE users SET full_name = ?, updated_at = ? WHERE id = ?`, [payload.full_name, updatedAt, req.user.id]);
    db.get(`SELECT id FROM clients WHERE email = ? OR document_id = ?`, [req.user.email, req.user.document_id], (selectErr, client) => {
      if (selectErr) return res.status(500).json({ error: 'No fue posible validar tu perfil.' });

      const finish = () => {
        db.get(`SELECT u.full_name, u.document_id, u.email, u.created_at AS user_created_at,
            c.phone, c.city, c.address, c.created_at, c.updated_at, c.verified,
            ac.assigned_lawyer
          FROM users u
          LEFT JOIN clients c ON c.email = u.email OR c.document_id = u.document_id
          LEFT JOIN auth_clients ac ON ac.user_id = u.id
          WHERE u.id = ?`, [req.user.id], (profileErr, row) => {
          if (profileErr || !row) return res.status(500).json({ error: 'Perfil actualizado, pero no fue posible recargarlo.' });
          res.json({
            full_name: row.full_name,
            document_id: row.document_id || '',
            email: row.email,
            phone: row.phone || '',
            city: row.city || '',
            address: row.address || '',
            created_at: row.created_at || row.user_created_at,
            updated_at: row.updated_at || updatedAt,
            verified: Boolean(row.verified),
            assigned_lawyer: row.assigned_lawyer || 'Equipo Orjuela'
          });
        });
      };

      if (client) {
        return db.run(`UPDATE clients SET name = ?, phone = ?, city = ?, address = ?, updated_at = ? WHERE id = ?`,
          [payload.full_name, payload.phone, payload.city, payload.address, updatedAt, client.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'No fue posible actualizar tu perfil.' });
            finish();
          });
      }

      db.run(`INSERT INTO clients (name, document_id, phone, email, city, address, created_at, updated_at, verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [payload.full_name, req.user.document_id || '', payload.phone, req.user.email, payload.city, payload.address, updatedAt, updatedAt], (insertErr) => {
          if (insertErr) return res.status(500).json({ error: 'No fue posible crear tu perfil.' });
          finish();
        });
    });
  });
});

app.get('/api/partner/network', requireAuth(['ally']), (req, res) => {
  getPartnerProfile(req.user.id, (profileErr, partner) => {
    if (profileErr || !partner) return res.status(404).json({ error: 'No encontramos tu perfil de aliado.' });

    ensurePartnerReferralCode(req.user.id, req.user.full_name, (codeErr, referralCode) => {
      if (codeErr) return res.status(500).json({ error: 'No fue posible generar tu codigo de aliado.' });

      const baseUrl = getBaseUrl(req);
      const inviteLink = `${baseUrl}/aliados/registro?ref=${encodeURIComponent(referralCode)}`;

      db.all(`SELECT r.*, c.amount AS commission_amount, c.status AS commission_status
        FROM referrals r
        LEFT JOIN commissions c ON c.referral_id = r.id AND c.ally_id = ? AND c.commission_type = 'direct'
        WHERE r.ally_id = ?
        ORDER BY r.created_at DESC`, [req.user.id, req.user.id], (refErr, directReferrals) => {
        if (refErr) return res.status(500).json({ error: 'Error al cargar tus referidos.' });

        db.all(`SELECT p.user_id, p.city, p.referral_code, p.created_at, u.full_name, u.status,
            COUNT(r.id) AS referrals_count,
            COALESCE(SUM(c.amount), 0) AS generated_commissions
          FROM partners p
          JOIN users u ON u.id = p.user_id
          LEFT JOIN referrals r ON r.ally_id = p.user_id
          LEFT JOIN commissions c ON c.source_ally_id = p.user_id AND c.ally_id = ?
          WHERE p.invited_by_partner_id = ?
          GROUP BY p.user_id
          ORDER BY p.user_id DESC`, [req.user.id, req.user.id], (teamErr, team) => {
          if (teamErr) return res.status(500).json({ error: 'Error al cargar tu equipo.' });

          db.all(`SELECT r.id, r.referred_full_name, r.legal_area, r.status, r.created_at,
              u.full_name AS source_ally_name, c.amount AS commission_amount, c.status AS commission_status
            FROM referrals r
            JOIN users u ON u.id = r.ally_id
            JOIN partners p ON p.user_id = r.ally_id
            LEFT JOIN commissions c ON c.referral_id = r.id AND c.ally_id = ?
            WHERE p.invited_by_partner_id = ?
            ORDER BY r.created_at DESC`, [req.user.id, req.user.id], (networkErr, networkReferrals) => {
            if (networkErr) return res.status(500).json({ error: 'Error al cargar referidos de tu red.' });

            db.all(`SELECT c.*, r.referred_full_name, r.legal_area, u.full_name AS source_ally_name
              FROM commissions c
              JOIN referrals r ON r.id = c.referral_id
              JOIN users u ON u.id = c.source_ally_id
              WHERE c.ally_id = ?
              ORDER BY c.created_at DESC`, [req.user.id], (commissionErr, commissions) => {
              if (commissionErr) return res.status(500).json({ error: 'Error al cargar comisiones.' });

              getActiveCommissionSettings((settingsErr, settings) => {
                if (settingsErr) return res.status(500).json({ error: 'Error al cargar configuracion de comisiones.' });

                const summary = {
                  total_referrals: directReferrals.length,
                  in_review: directReferrals.filter((item) => ['new', 'in_progress', 'Nuevo referido', 'En revision'].includes(item.status)).length,
                  converted: directReferrals.filter((item) => ['won', 'Cliente vinculado'].includes(item.status)).length,
                  pending_commission: commissions.filter((item) => item.status === 'pending').reduce((sum, item) => sum + money(item.amount), 0),
                  approved_commission: commissions.filter((item) => item.status === 'approved').reduce((sum, item) => sum + money(item.amount), 0),
                  paid_commission: commissions.filter((item) => item.status === 'paid').reduce((sum, item) => sum + money(item.amount), 0),
                  active_team_members: team.filter((item) => item.status === 'active').length
                };

      res.json({
                  partner: {
                    full_name: partner.full_name,
                    email: partner.email,
                    city: partner.city,
                    phone: partner.phone,
                    referral_code: referralCode,
                    invite_link: inviteLink
                  },
                  summary,
                  settings,
                  team,
                  direct_referrals: directReferrals.map(publicReferral),
                  network_referrals: networkReferrals.map((item) => ({
                    id: item.id,
                    masked_name: maskName(item.referred_full_name),
                    legal_area: item.legal_area,
                    status: item.status,
                    created_at: item.created_at,
                    source_ally_name: item.source_ally_name,
                    commission_amount: item.commission_amount || 0,
                    commission_status: item.commission_status,
                    public_note: 'Seguimiento limitado por protección de datos.'
                  })),
                  commissions: commissions.map((item) => ({
                    ...item,
                    referred_full_name: maskName(item.referred_full_name),
                    percentage: undefined
                  })),
                  activity: [
                    ...directReferrals.slice(0, 4).map((item) => ({
                      date: item.created_at,
                      type: 'Referido registrado',
                      description: `${item.referred_full_name} fue registrado en el programa.`,
                      icon: 'bi-person-plus',
                      status: item.status
                    })),
                    ...commissions.slice(0, 4).map((item) => ({
                      date: item.created_at,
                      type: item.status === 'paid' ? 'Comision pagada' : 'Comision aprobada',
                      description: `${item.commission_type} por ${item.referred_full_name}.`,
                      icon: 'bi-cash-coin',
                      status: item.status
                    })),
                    ...team.slice(0, 3).map((item) => ({
                      date: item.created_at || getTimestamp(),
                      type: 'Nuevo aliado unido a mi red',
                      description: `${item.full_name} forma parte de tu equipo de aliados.`,
                      icon: 'bi-diagram-3',
                      status: item.status
                    }))
                  ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8),
                  crm_referrals: directReferrals.map((item) => ({
                    id: item.id,
                    name: item.referred_full_name,
                    masked_name: maskName(item.referred_full_name),
                    case_type: item.legal_area,
                    registered_at: item.created_at,
                    current_status: item.status,
                    updated_at: item.updated_at,
                    public_note: 'Seguimiento limitado por protección de datos. No se comparte información sensible del referido.',
                    observations: 'La firma actualizará novedades comerciales visibles para el aliado.',
                  })),
                  resources: [],
                  level: {},
                  goals: {},
                  notifications: [],
                  profile: {
                    full_name: partner.full_name,
                    document_id: partner.document_id,
                    phone: partner.phone,
                    email: partner.email,
                    city: partner.city,
                    occupation: partner.occupation || partner.partner_type,
                    referral_code: referralCode,
                    invite_link: inviteLink,
                    status: partner.status,
                    joined_at: partner.created_at,
                    bank_name: 'Requiere aprobación administrativa',
                    account_type: 'Dato sensible protegido',
                    account_number: '****'
                  },
                  legal_documents: [],
                  charts: {
                    commissions_by_month: [],
                    referrals_by_month: [],
                    conversion_rate: summary.total_referrals ? Math.round((summary.converted / summary.total_referrals) * 100) : 0,
                    network_growth: [],
                    direct_vs_indirect: [
                      { label: 'Directas', value: commissions.filter((item) => item.commission_type === 'direct').reduce((sum, item) => sum + money(item.amount), 0) },
                      { label: 'Indirectas', value: commissions.filter((item) => item.commission_type !== 'direct').reduce((sum, item) => sum + money(item.amount), 0) }
                    ],
                    pending_vs_paid: [
                      { label: 'Pendientes', value: summary.pending_commission },
                      { label: 'Pagadas', value: summary.paid_commission }
                    ]
                  },
                  network_tree: {
                    name: partner.full_name,
                    level: 'Aliado principal',
                    status: partner.status,
                    referrals_count: directReferrals.length,
                    commissions: commissions.reduce((sum, item) => sum + money(item.amount), 0),
                    children: team.map((item) => ({
                      name: item.full_name,
                      level: 'Nivel 1',
                      status: item.status,
                      referrals_count: item.referrals_count || 0,
                      commissions: item.generated_commissions || 0
                    }))
                  },
                  academy: [],
                  share: {
                    client_message: `Hola, quiero recomendarte a Orjuela Abogados. Pueden ayudarte con asesoria juridica personalizada. Puedes dejar tus datos aqui: ${inviteLink}`,
                    ally_message: `Hola, quiero invitarte al programa de aliados de Orjuela Abogados. Puedes referir personas que necesiten servicios legales y recibir comisiones por casos efectivos. Registrate aqui: ${inviteLink}`
                  }
                });
              });
            });
          });
        });
      });
    });
  });
});

app.post('/api/partner/network/referrals', requireAuth(['ally']), (req, res) => {
  const payload = {
    client_name: cleanText(req.body.client_name),
    client_identification: normalizeDocument(req.body.client_identification),
    client_phone: cleanText(req.body.client_phone, 60),
    client_email: normalizeEmail(req.body.client_email),
    city: cleanText(req.body.city, 100),
    legal_area: cleanText(req.body.legal_area, 80),
    description: cleanText(req.body.description, 900),
    referral_channel: cleanText(req.body.referral_channel, 100),
    data_authorization: req.body.data_authorization
  };

  if (!payload.client_name || !payload.client_identification || !payload.client_phone || !payload.city || !payload.legal_area || !payload.description || payload.data_authorization !== true) {
    return res.status(400).json({ error: 'Completa los campos obligatorios y confirma la autorizacion de datos.' });
  }
  if (payload.client_email && !isValidEmail(payload.client_email)) {
    return res.status(400).json({ error: 'El correo del referido no tiene un formato valido.' });
  }

  db.get(`SELECT id FROM referrals WHERE client_identification = ? OR referred_phone = ? OR referred_email = ?`, [payload.client_identification, payload.client_phone, payload.client_email], (dupErr, duplicate) => {
    if (dupErr) return res.status(500).json({ error: 'Error al validar duplicados.' });
    if (duplicate) return res.status(409).json({ error: 'Este referido ya existe por cedula, telefono o correo.' });

    const createdAt = getTimestamp();
    const stmt = db.prepare(`INSERT INTO referrals (ally_id, referred_full_name, client_identification, referred_phone, referred_email, referred_city, legal_area, case_description, referral_channel, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Nuevo referido', ?, ?)`);
    stmt.run(req.user.id, payload.client_name, payload.client_identification, payload.client_phone, payload.client_email, payload.city, payload.legal_area, payload.description, payload.referral_channel, createdAt, createdAt, function (insertErr) {
      if (insertErr) return res.status(500).json({ error: 'No fue posible guardar el referido.' });
      const referralId = this.lastID;
      createCommissionRows(referralId, req.user.id, (commissionErr) => {
        if (commissionErr) console.error(commissionErr);
        res.status(201).json({ message: 'Referido enviado correctamente. Quedo asociado a tu cuenta de aliado.', id: referralId });
      });
    });
    stmt.finalize();
  });
});

app.get('/api/partner/advanced', requireAuth(['ally']), (req, res) => {
  const allyId = req.user.id;
  const month = currentMonthKey();
  const response = {};

  db.serialize(() => {
    getPartnerProfile(allyId, (profileErr, partner) => {
      if (!profileErr && partner) {
        const referralCode = partner.referral_code || 'ORJUELAPRUEBA';
        response.profile = {
          full_name: partner.full_name,
          document_id: partner.document_id,
          phone: partner.phone,
          email: partner.email,
          city: partner.city,
          partner_type: partner.partner_type,
          company: partner.company,
          how_known: partner.how_known,
          occupation: partner.occupation || partner.partner_type,
          referral_code: referralCode,
          invite_link: `${getBaseUrl(req)}/aliados/registro?ref=${encodeURIComponent(referralCode)}`,
          status: partner.status,
          joined_at: partner.created_at,
          bank_name: partner.bank_name || 'Bancolombia',
          account_type: partner.account_type || 'Ahorros',
          account_number: partner.account_number || '****6789',
          commission_balance: partner.commission_balance || 0
        };
      }
    });

    db.all(`SELECT * FROM ally_resources WHERE is_active = 1 ORDER BY resource_type, title`, (resourceErr, resources) => {
      if (resourceErr) return res.status(500).json({ error: 'Error al cargar recursos.' });
      response.resources = resources;

      db.all(`SELECT * FROM ally_notifications WHERE ally_id = ? ORDER BY created_at DESC`, [allyId], (notificationErr, notifications) => {
        if (notificationErr) return res.status(500).json({ error: 'Error al cargar notificaciones.' });
        response.notifications = notifications;

        db.all(`SELECT m.*, COALESCE(p.status, 'pendiente') AS progress_status, COALESCE(p.progress, 0) AS progress
          FROM ally_academy_modules m
          LEFT JOIN ally_academy_progress p ON p.module_id = m.id AND p.ally_id = ?
          WHERE m.is_active = 1
          ORDER BY m.sort_order`, [allyId], (academyErr, academy) => {
          if (academyErr) return res.status(500).json({ error: 'Error al cargar academia.' });
          response.academy = academy;

          db.get(`SELECT * FROM ally_kyc_verifications WHERE ally_id = ?`, [allyId], (kycErr, kyc) => {
            if (kycErr) return res.status(500).json({ error: 'Error al cargar verificacion.' });
            response.kyc = kyc || { status: 'Sin verificar', phone_validated: 0, email_validated: 0 };

            db.all(`SELECT * FROM ally_legal_acceptances WHERE ally_id = ? ORDER BY document_type`, [allyId], (legalErr, legalDocuments) => {
              if (legalErr) return res.status(500).json({ error: 'Error al cargar documentos legales.' });
              response.legal_documents = legalDocuments;

              db.get(`SELECT * FROM ally_goals WHERE (ally_id = ? OR ally_id IS NULL) AND month = ? AND is_active = 1 ORDER BY ally_id DESC LIMIT 1`, [allyId, month], (goalErr, goal) => {
                if (goalErr) return res.status(500).json({ error: 'Error al cargar metas.' });
                const activeGoal = goal || { month, referral_goal: 5, converted_goal: 1, commission_goal: 500000 };

                db.all(`SELECT r.status, r.created_at FROM referrals r WHERE r.ally_id = ?`, [allyId], (refErr, refs) => {
                  if (refErr) return res.status(500).json({ error: 'Error al cargar referidos.' });
                  db.all(`SELECT commission_type, amount, status, created_at FROM commissions WHERE ally_id = ?`, [allyId], (commErr, commissions) => {
                    if (commErr) return res.status(500).json({ error: 'Error al cargar comisiones.' });
                    db.all(`SELECT * FROM ally_levels WHERE is_active = 1 ORDER BY sort_order`, (levelErr, levels) => {
                      if (levelErr) return res.status(500).json({ error: 'Error al cargar niveles.' });

                      const converted = refs.filter((item) => ['Cliente activo', 'Cliente vinculado', 'won'].includes(item.status)).length;
                      const totalCommissions = commissions.reduce((sum, item) => sum + money(item.amount), 0);
                      db.all(`SELECT user_id FROM partners WHERE invited_by_partner_id = ?`, [allyId], (teamErr, team) => {
                        if (teamErr) return res.status(500).json({ error: 'Error al cargar red.' });
                        const activeAllies = team.length;
                        const currentLevel = [...levels].reverse().find((level) =>
                          converted >= level.min_converted_referrals &&
                          totalCommissions >= level.min_commissions &&
                          activeAllies >= level.min_active_allies
                        ) || levels[0];
                        const nextLevel = levels.find((level) => level.sort_order > currentLevel.sort_order);

                        response.level = {
                          current: currentLevel,
                          next: nextLevel,
                          progress: nextLevel ? Math.min(100, Math.round((
                            progressPercent(converted, nextLevel.min_converted_referrals) +
                            progressPercent(totalCommissions, nextLevel.min_commissions) +
                            progressPercent(activeAllies, nextLevel.min_active_allies)
                          ) / 3)) : 100
                        };
                        response.goals = {
                          ...activeGoal,
                          referral_progress: progressPercent(refs.length, activeGoal.referral_goal),
                          converted_progress: progressPercent(converted, activeGoal.converted_goal),
                          commission_progress: progressPercent(totalCommissions, activeGoal.commission_goal),
                          message: 'Mantén referidos de calidad y seguimiento oportuno. Las comisiones dependen de validación interna.'
                        };
                        const byMonth = (rows, valueFn = () => 1) => {
                          const grouped = {};
                          rows.forEach((row) => {
                            const key = String(row.created_at || '').slice(0, 7) || month;
                            grouped[key] = (grouped[key] || 0) + valueFn(row);
                          });
                          return Object.entries(grouped).map(([label, value]) => ({ label, value }));
                        };
                        response.charts = {
                          commissions_by_month: byMonth(commissions, (item) => money(item.amount)),
                          referrals_by_month: byMonth(refs),
                          conversion_rate: refs.length ? Math.round((converted / refs.length) * 100) : 0,
                          network_growth: [{ label: month, value: activeAllies }],
                          direct_vs_indirect: [
                            { label: 'Directas', value: commissions.filter((item) => item.commission_type === 'direct').reduce((sum, item) => sum + money(item.amount), 0) },
                            { label: 'Indirectas', value: commissions.filter((item) => item.commission_type !== 'direct').reduce((sum, item) => sum + money(item.amount), 0) }
                          ],
                          pending_vs_paid: [
                            { label: 'Pendientes', value: commissions.filter((item) => item.status === 'pending').reduce((sum, item) => sum + money(item.amount), 0) },
                            { label: 'Pagadas', value: commissions.filter((item) => item.status === 'paid').reduce((sum, item) => sum + money(item.amount), 0) }
                          ]
                        };
                        res.json(response);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

app.post('/api/partner/notifications/:id/read', requireAuth(['ally']), (req, res) => {
  db.run(`UPDATE ally_notifications SET is_read = 1 WHERE ally_id = ? AND id = ?`, [req.user.id, parseInt(req.params.id, 10)], () => {
    res.json({ message: 'Notificacion marcada como leida.' });
  });
});

app.post('/api/partner/notifications/read-all', requireAuth(['ally']), (req, res) => {
  db.run(`UPDATE ally_notifications SET is_read = 1 WHERE ally_id = ?`, [req.user.id], () => {
    res.json({ message: 'Notificaciones marcadas como leidas.' });
  });
});

app.post('/api/partner/legal-acceptances', requireAuth(['ally']), (req, res) => {
  const documentType = cleanText(req.body.document_type, 80);
  const version = cleanText(req.body.version || 'v1.0', 20);
  if (!documentType) return res.status(400).json({ error: 'Tipo de documento obligatorio.' });
  db.run(`INSERT INTO ally_legal_acceptances (ally_id, document_type, accepted_at, ip_address, version, status)
    VALUES (?, ?, ?, ?, ?, 'accepted')`, [req.user.id, documentType, getTimestamp(), req.ip || '', version], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible registrar la aceptacion.' });
    res.status(201).json({ message: 'Documento aceptado correctamente.', id: this.lastID });
  });
});

app.post('/api/partner/electronic-signatures', requireAuth(['ally']), (req, res) => {
  const payload = {
    document_type: cleanText(req.body.document_type, 80),
    full_name: cleanText(req.body.full_name, 140),
    document_number: normalizeDocument(req.body.document_number),
    version: cleanText(req.body.version || 'v1.0', 20)
  };
  if (!payload.document_type || !payload.full_name || !payload.document_number) return res.status(400).json({ error: 'Datos de firma incompletos.' });
  db.run(`INSERT INTO ally_electronic_signatures (ally_id, document_type, full_name, document_number, version, signed_at, status)
    VALUES (?, ?, ?, ?, ?, ?, 'accepted')`, [req.user.id, payload.document_type, payload.full_name, payload.document_number, payload.version, getTimestamp()], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible registrar la firma.' });
    res.status(201).json({ message: 'Firma electronica registrada.', id: this.lastID });
  });
});

app.patch('/api/partner/profile', requireAuth(['ally']), (req, res) => {
  const payload = {
    phone: cleanText(req.body.phone, 60),
    city: cleanText(req.body.city, 100),
    partner_type: cleanText(req.body.partner_type, 60) || 'Independiente',
    company: cleanText(req.body.company, 120),
    occupation: cleanText(req.body.occupation, 120),
    bank_name: cleanText(req.body.bank_name, 100),
    account_type: cleanText(req.body.account_type, 60),
    account_number: cleanText(req.body.account_number, 80)
  };
  if (!payload.phone || !payload.city || !payload.partner_type) {
    return res.status(400).json({ error: 'Teléfono, ciudad y tipo de aliado son obligatorios.' });
  }
  db.run(`UPDATE partners SET phone = ?, city = ?, partner_type = ?, company = ?, occupation = ?,
      bank_name = COALESCE(NULLIF(?, ''), bank_name),
      account_type = COALESCE(NULLIF(?, ''), account_type),
      account_number = COALESCE(NULLIF(?, ''), account_number),
      updated_at = ?
    WHERE user_id = ?`,
    [payload.phone, payload.city, payload.partner_type, payload.company, payload.occupation, payload.bank_name, payload.account_type, payload.account_number, getTimestamp(), req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: 'No fue posible actualizar tu perfil.' });
      if (this.changes === 0) return res.status(404).json({ error: 'No encontramos tu perfil de aliado.' });
      res.json({ message: 'Perfil actualizado. Los datos de pago quedan sujetos a validación administrativa.' });
    });
});

app.post('/api/partner/academy/:id/complete', requireAuth(['ally']), (req, res) => {
  const moduleId = parseInt(req.params.id, 10);
  if (!moduleId) return res.status(400).json({ error: 'Módulo inválido.' });
  db.run(`INSERT INTO ally_academy_progress (ally_id, module_id, status, progress, updated_at)
      VALUES (?, ?, 'completado', 100, ?)
      ON CONFLICT(ally_id, module_id) DO UPDATE SET status = 'completado', progress = 100, updated_at = excluded.updated_at`,
    [req.user.id, moduleId, getTimestamp()], function (err) {
      if (err) return res.status(500).json({ error: 'No fue posible actualizar el módulo.' });
      res.json({ message: 'Módulo completado.' });
    });
});

app.post('/api/partner/kyc', requireAuth(['ally']), (req, res) => {
  const payload = {
    front_document_url: cleanText(req.body.front_document_url, 300),
    back_document_url: cleanText(req.body.back_document_url, 300),
    selfie_url: cleanText(req.body.selfie_url, 300),
    bank_name: cleanText(req.body.bank_name, 100),
    account_type: cleanText(req.body.account_type, 60),
    account_number: cleanText(req.body.account_number, 80)
  };
  const now = getTimestamp();
  db.run(`INSERT INTO ally_kyc_verifications (ally_id, front_document_url, back_document_url, selfie_url, bank_name, account_type, account_number, status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'En revision', ?)
    ON CONFLICT(ally_id) DO UPDATE SET front_document_url = excluded.front_document_url, back_document_url = excluded.back_document_url,
      selfie_url = excluded.selfie_url, bank_name = excluded.bank_name, account_type = excluded.account_type, account_number = excluded.account_number,
      status = 'En revision', updated_at = excluded.updated_at`, [req.user.id, payload.front_document_url, payload.back_document_url, payload.selfie_url, payload.bank_name, payload.account_type, payload.account_number, now], (err) => {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar la verificacion.' });
    res.json({ message: 'Verificacion enviada a revision.' });
  });
});

app.post('/api/partner/network/invitations', requireAuth(['ally']), (req, res) => {
  const payload = {
    full_name: cleanText(req.body.full_name),
    document_id: normalizeDocument(req.body.document_id),
    phone: cleanText(req.body.phone, 60),
    email: normalizeEmail(req.body.email),
    city: cleanText(req.body.city, 100),
    occupation: cleanText(req.body.occupation, 120),
    message: cleanText(req.body.message, 500)
  };

  if (!payload.full_name || !payload.document_id || !payload.phone || !payload.email || !payload.city || !payload.occupation) {
    return res.status(400).json({ error: 'Completa los datos obligatorios del nuevo aliado.' });
  }
  if (!isValidEmail(payload.email)) return res.status(400).json({ error: 'Correo invalido.' });

  db.get(`SELECT u.id FROM users u
    LEFT JOIN partners p ON p.user_id = u.id
    WHERE u.email = ? OR p.document_id = ? OR p.phone = ?`, [payload.email, payload.document_id, payload.phone], (dupErr, duplicate) => {
    if (dupErr) return res.status(500).json({ error: 'Error al validar duplicados.' });
    if (duplicate) return res.status(409).json({ error: 'Ya existe un aliado con ese correo, cedula o telefono.' });

    const createdAt = getTimestamp();
    const tempPassword = crypto.randomBytes(10).toString('hex');
    db.run(`INSERT INTO users (full_name, email, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, 'ally', 'pending', ?, ?)`, [payload.full_name, payload.email, hashPassword(tempPassword), createdAt, createdAt], function (userErr) {
      if (userErr) return res.status(500).json({ error: 'No fue posible crear la invitacion.' });
      const invitedUserId = this.lastID;
      db.run(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, occupation, referral_code, invited_by_partner_id, commission_balance)
        VALUES (?, ?, ?, ?, 'Invitado', ?, ?, ?, 0)`, [invitedUserId, payload.document_id, payload.phone, payload.city, payload.occupation, generateReferralCode(payload.full_name, payload.document_id), req.user.id], (partnerErr) => {
        if (partnerErr) return res.status(500).json({ error: 'No fue posible asociar el aliado invitado.' });
        sendNotificationEmail('Nuevo aliado invitado', `<p>${escapeHtml(req.user.full_name)} invito a ${escapeHtml(payload.full_name)} (${escapeHtml(payload.email)}).</p>`);
        res.status(201).json({ message: 'Invitacion registrada correctamente. El nuevo aliado quedo asociado a tu red.' });
      });
    });
  });
});

app.get('/api/admin/partner-network', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  db.all(`SELECT p.user_id, p.document_id, p.phone, p.city, p.occupation, p.referral_code, p.invited_by_partner_id,
      u.full_name, u.email, u.status,
      inviter.full_name AS invited_by_name,
      COUNT(DISTINCT r.id) AS referrals_count,
      COALESCE(SUM(c.amount), 0) AS commissions_total
    FROM partners p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN users inviter ON inviter.id = p.invited_by_partner_id
    LEFT JOIN referrals r ON r.ally_id = p.user_id
    LEFT JOIN commissions c ON c.ally_id = p.user_id
    GROUP BY p.user_id
    ORDER BY u.created_at DESC`, (allyErr, allies) => {
    if (allyErr) return res.status(500).json({ error: 'Error al cargar aliados.' });

    db.all(`SELECT r.*, u.full_name AS ally_name
      FROM referrals r
      JOIN users u ON u.id = r.ally_id
      ORDER BY r.created_at DESC`, (refErr, referralsRows) => {
      if (refErr) return res.status(500).json({ error: 'Error al cargar referidos.' });

      db.all(`SELECT c.*, receiver.full_name AS ally_name, source.full_name AS source_ally_name, r.referred_full_name
        FROM commissions c
        JOIN users receiver ON receiver.id = c.ally_id
        JOIN users source ON source.id = c.source_ally_id
        JOIN referrals r ON r.id = c.referral_id
        ORDER BY c.created_at DESC`, (commErr, commissions) => {
        if (commErr) return res.status(500).json({ error: 'Error al cargar comisiones.' });

        getActiveCommissionSettings((settingsErr, settings) => {
          if (settingsErr) return res.status(500).json({ error: 'Error al cargar configuracion.' });
          db.all(`SELECT * FROM ally_levels WHERE is_active = 1 ORDER BY sort_order`, (levelErr, levels) => {
            if (levelErr) return res.status(500).json({ error: 'Error al cargar niveles.' });
            db.all(`SELECT * FROM ally_resources WHERE is_active = 1 ORDER BY resource_type`, (resourceErr, resources) => {
              if (resourceErr) return res.status(500).json({ error: 'Error al cargar recursos.' });
              db.all(`SELECT k.*, u.full_name FROM ally_kyc_verifications k JOIN users u ON u.id = k.ally_id ORDER BY k.updated_at DESC`, (kycErr, kyc) => {
                if (kycErr) return res.status(500).json({ error: 'Error al cargar KYC.' });
                db.all(`SELECT f.*, u.full_name FROM ally_fraud_alerts f LEFT JOIN users u ON u.id = f.ally_id ORDER BY f.created_at DESC`, (fraudErr, fraudAlerts) => {
                  if (fraudErr) return res.status(500).json({ error: 'Error al cargar alertas.' });
                  db.all(`SELECT * FROM ally_academy_modules WHERE is_active = 1 ORDER BY sort_order`, (academyErr, academy) => {
                    if (academyErr) return res.status(500).json({ error: 'Error al cargar academia.' });
                    db.all(`SELECT * FROM ally_goals WHERE is_active = 1 ORDER BY updated_at DESC`, (goalErr, goals) => {
                      if (goalErr) return res.status(500).json({ error: 'Error al cargar metas.' });
                      res.json({ allies, referrals: referralsRows, commissions, settings, levels, resources, kyc, fraudAlerts, academy, goals });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

app.patch('/api/admin/network-referrals/:id/status', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = cleanText(req.body.status, 40);
  if (!id || !NETWORK_REFERRAL_STATUSES.includes(status)) return res.status(400).json({ error: 'Estado no valido.' });
  db.run(`UPDATE referrals SET status = ?, updated_at = ? WHERE id = ?`, [status, getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar el referido.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Referido no encontrado.' });
    res.json({ message: 'Estado actualizado correctamente.' });
  });
});

app.post('/api/admin/partner-network/allies', requireAuth(['admin']), (req, res) => {
  const payload = {
    full_name: cleanText(req.body.full_name, 140),
    document_id: cleanText(req.body.document_id, 40) || generatedDocumentId('ALLY', req.body.email),
    phone: cleanText(req.body.phone, 60),
    email: normalizeEmail(req.body.email),
    city: cleanText(req.body.city, 80),
    partner_type: cleanText(req.body.partner_type || 'Independiente', 60),
    occupation: cleanText(req.body.occupation, 100),
    status: cleanText(req.body.status || 'active', 20)
  };
  if (!payload.full_name || !payload.email || !payload.phone || !payload.city) return res.status(400).json({ error: 'Nombre, correo, teléfono y ciudad son obligatorios.' });
  if (!isValidEmail(payload.email)) return res.status(400).json({ error: 'Correo inválido.' });
  const now = getTimestamp();
  const password = hashPassword(`Aliado${crypto.randomInt(1000, 9999)}!`);
  db.run(`INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'ally', ?, ?, ?)`, [payload.full_name, payload.document_id, payload.email, password, payload.status, now, now], function (userErr) {
    if (userErr) return res.status(500).json({ error: 'No fue posible crear el usuario aliado.' });
    const userId = this.lastID;
    db.run(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, occupation, referral_code, commission_balance, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`, [userId, payload.document_id, payload.phone, payload.city, payload.partner_type, payload.occupation, generateReferralCode(payload.full_name, payload.document_id), now, now], function (partnerErr) {
      if (partnerErr) return res.status(500).json({ error: 'No fue posible crear aliado.' });
      auditAdminAction(req, 'crear', 'aliado', userId, payload.full_name);
      res.status(201).json({ message: 'Aliado creado.', user_id: userId });
    });
  });
});

app.patch('/api/admin/partner-network/allies/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Aliado inválido.' });
  const payload = {
    full_name: cleanText(req.body.full_name, 140),
    phone: cleanText(req.body.phone, 60),
    city: cleanText(req.body.city, 80),
    partner_type: cleanText(req.body.partner_type, 60),
    occupation: cleanText(req.body.occupation, 100),
    status: cleanText(req.body.status, 20)
  };
  db.run(`UPDATE users SET full_name = COALESCE(NULLIF(?, ''), full_name), status = COALESCE(NULLIF(?, ''), status), updated_at = ? WHERE id = ? AND role = 'ally'`,
    [payload.full_name, payload.status, getTimestamp(), id], function (userErr) {
    if (userErr) return res.status(500).json({ error: 'No fue posible actualizar aliado.' });
    db.run(`UPDATE partners SET phone = COALESCE(NULLIF(?, ''), phone), city = COALESCE(NULLIF(?, ''), city), partner_type = COALESCE(NULLIF(?, ''), partner_type), occupation = COALESCE(NULLIF(?, ''), occupation), updated_at = ? WHERE user_id = ?`,
      [payload.phone, payload.city, payload.partner_type, payload.occupation, getTimestamp(), id], (partnerErr) => {
      if (partnerErr) return res.status(500).json({ error: 'No fue posible actualizar perfil de aliado.' });
      auditAdminAction(req, 'actualizar', 'aliado', id, payload.full_name || 'Aliado actualizado');
      res.json({ message: 'Aliado actualizado.' });
    });
  });
});

app.delete('/api/admin/partner-network/allies/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Aliado inválido.' });
  db.run(`UPDATE users SET status = 'archived', updated_at = ? WHERE id = ? AND role = 'ally'`, [getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar aliado.' });
    auditAdminAction(req, 'archivar', 'aliado', id, 'Aliado archivado');
    res.json({ message: 'Aliado archivado.' });
  });
});

app.patch('/api/admin/commissions/:id/status', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = cleanText(req.body.status, 20);
  const amount = req.body.amount !== undefined ? Number(req.body.amount) : null;
  if (!id || !COMMISSION_STATUSES.includes(status)) return res.status(400).json({ error: 'Estado de comision no valido.' });
  const paidAt = status === 'paid' ? getTimestamp() : null;
  const params = amount !== null && !Number.isNaN(amount)
    ? [status, amount, paidAt, id]
    : [status, paidAt, id];
  const sql = amount !== null && !Number.isNaN(amount)
    ? `UPDATE commissions SET status = ?, amount = ?, paid_at = ? WHERE id = ?`
    : `UPDATE commissions SET status = ?, paid_at = ? WHERE id = ?`;
  db.run(sql, params, function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar la comision.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Comision no encontrada.' });
    res.json({ message: 'Comision actualizada correctamente.' });
  });
});

app.patch('/api/admin/commission-settings', requireAuth(['admin']), (req, res) => {
  const direct = Number(req.body.direct_percentage);
  const level1 = Number(req.body.level_1_percentage);
  const level2 = Number(req.body.level_2_percentage);
  if ([direct, level1, level2].some((value) => Number.isNaN(value) || value < 0 || value > 100)) {
    return res.status(400).json({ error: 'Porcentajes no validos.' });
  }
  const now = getTimestamp();
  db.run(`UPDATE commission_settings SET is_active = 0 WHERE is_active = 1`);
  db.run(`INSERT INTO commission_settings (direct_percentage, level_1_percentage, level_2_percentage, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)`, [direct, level1, level2, now, now], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible guardar la configuracion.' });
    res.json({ message: 'Configuracion actualizada.', id: this.lastID });
  });
});

app.post('/api/auth/recovery/request', (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Ingresa un correo válido.' });

  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

  db.run(`UPDATE users SET reset_token_hash = ?, reset_token_expires_at = ?, updated_at = ? WHERE email = ?`, [tokenHash, expiresAt, getTimestamp(), email], () => {
    sendNotificationEmail('Recuperación de contraseña', `
      <h2>Solicitud de recuperación de acceso</h2>
      <p>Correo: ${escapeHtml(email)}</p>
      <p>Token temporal: ${escapeHtml(rawToken)}</p>
      <p>Vence: ${escapeHtml(expiresAt)}</p>
    `);
    res.json({ message: 'Si el correo existe, enviaremos instrucciones para recuperar el acceso.' });
  });
});

app.post('/api/auth/recovery/reset', (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(String(req.body.token || '')).digest('hex');
  const password = String(req.body.password || '');
  if (!tokenHash || password.length < 8) return res.status(400).json({ error: 'Token o contraseña no válidos.' });

  db.get(`SELECT id, reset_token_expires_at FROM users WHERE reset_token_hash = ?`, [tokenHash], (err, user) => {
    if (err || !user || new Date(user.reset_token_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Token inválido o vencido.' });
    }

    db.run(`UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL, updated_at = ? WHERE id = ?`, [hashPassword(password), getTimestamp(), user.id], () => {
      res.json({ message: 'Contraseña actualizada correctamente.' });
    });
  });
});

app.post('/api/allies', (req, res) => {
  const payload = {
    full_name: cleanText(req.body.full_name),
    document_number: normalizeDocument(req.body.document_number),
    phone: cleanText(req.body.phone, 60),
    email: normalizeEmail(req.body.email),
    city: cleanText(req.body.city, 100),
    ally_type: cleanText(req.body.ally_type, 40),
    how_known: cleanText(req.body.how_known, 180),
    bank_name: cleanText(req.body.bank_name, 100),
    account_type: cleanText(req.body.account_type, 40),
    account_number: cleanText(req.body.account_number, 80),
    accept_program_terms: req.body.accept_program_terms,
    accept_terms: req.body.accept_terms
  };

  if (!payload.full_name || !payload.document_number || !payload.phone || !payload.email || !payload.city || !payload.ally_type || payload.accept_terms !== true) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos y aceptar el tratamiento de datos.' });
  }
  if (!isValidEmail(payload.email)) {
    return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido.' });
  }
  if (!isOneOf(payload.ally_type, ALLY_TYPES)) {
    return res.status(400).json({ error: 'El tipo de aliado seleccionado no es válido.' });
  }

  const createdAt = getTimestamp();
  const stmt = db.prepare(`INSERT INTO allies (full_name, document_number, phone, email, city, ally_type, how_known, bank_name, account_type, account_number, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`);

  stmt.run(payload.full_name, payload.document_number, payload.phone, payload.email, payload.city, payload.ally_type, payload.how_known, payload.bank_name, payload.account_type, payload.account_number, createdAt, createdAt, function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Ya existe un aliado registrado con esa cédula.' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Error interno al guardar el aliado.' });
    }

    sendNotificationEmail('Nuevo aliado registrado', `
      <h2>Nuevo registro de aliado</h2>
      <p><strong>Nombre:</strong> ${escapeHtml(payload.full_name)}</p>
      <p><strong>Cédula:</strong> ${escapeHtml(payload.document_number)}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(payload.phone)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(payload.email)}</p>
      <p><strong>Ciudad:</strong> ${escapeHtml(payload.city)}</p>
      <p><strong>Tipo de aliado:</strong> ${escapeHtml(payload.ally_type)}</p>
      <p><strong>Cómo conoció la firma:</strong> ${escapeHtml(payload.how_known)}</p>
      <p><strong>Fecha:</strong> ${createdAt}</p>
    `);

    res.status(201).json({ message: 'Tu registro como aliado fue recibido correctamente. Pronto nuestro equipo validará tu información.' });
  });
  stmt.finalize();
});

app.post('/api/referrals', (req, res) => {
  const payload = {
    ally_document_number: normalizeDocument(req.body.ally_document_number),
    ally_email: normalizeEmail(req.body.ally_email),
    referred_full_name: cleanText(req.body.referred_full_name),
    referred_phone: cleanText(req.body.referred_phone, 60),
    referred_email: normalizeEmail(req.body.referred_email),
    referred_city: cleanText(req.body.referred_city, 100),
    legal_area: cleanText(req.body.legal_area, 60),
    case_description: cleanText(req.body.case_description, 800),
    urgency: cleanText(req.body.urgency, 40),
    file_notes: cleanText(req.body.file_notes, 300),
    contact_authorization: req.body.contact_authorization
  };

  if (!payload.ally_document_number || !payload.ally_email || !payload.referred_full_name || !payload.referred_phone || !payload.referred_city || !payload.legal_area || !payload.case_description || payload.contact_authorization !== true) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos y el referido debe autorizar el contacto.' });
  }
  if (!isValidEmail(payload.ally_email) || (payload.referred_email && !isValidEmail(payload.referred_email))) {
    return res.status(400).json({ error: 'Uno de los correos no tiene un formato válido.' });
  }
  if (!isOneOf(payload.legal_area, LEGAL_AREAS)) {
    return res.status(400).json({ error: 'El área legal seleccionada no es válida.' });
  }

  db.get(`SELECT id, full_name, status FROM allies WHERE document_number = ? AND email = ?`, [payload.ally_document_number, payload.ally_email], (err, ally) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error interno al verificar el aliado.' });
    }
    if (!ally) {
      return res.status(404).json({ error: 'No se encontró un aliado registrado con la cédula y correo proporcionados.' });
    }
    if (ally.status === 'inactive') {
      return res.status(403).json({ error: 'El aliado se encuentra inactivo. Comunícate con Orjuela Abogados.' });
    }

    const createdAt = getTimestamp();
    const stmt = db.prepare(`INSERT INTO referrals (ally_id, referred_full_name, referred_phone, referred_email, referred_city, legal_area, case_description, urgency, file_notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`);

    stmt.run(ally.id, payload.referred_full_name, payload.referred_phone, payload.referred_email || '', payload.referred_city, payload.legal_area, payload.case_description, payload.urgency, payload.file_notes, createdAt, createdAt, function (insertErr) {
      if (insertErr) {
        console.error(insertErr);
        return res.status(500).json({ error: 'Error interno al guardar el referido.' });
      }

      sendNotificationEmail('Nuevo referido desde aliado', `
        <h2>Nuevo referido recibido</h2>
        <p><strong>Aliado:</strong> ${escapeHtml(ally.full_name)} (${escapeHtml(payload.ally_document_number)})</p>
        <p><strong>Nombre referido:</strong> ${escapeHtml(payload.referred_full_name)}</p>
        <p><strong>Teléfono referido:</strong> ${escapeHtml(payload.referred_phone)}</p>
        <p><strong>Correo referido:</strong> ${escapeHtml(payload.referred_email || 'No proporcionado')}</p>
        <p><strong>Ciudad referido:</strong> ${escapeHtml(payload.referred_city)}</p>
        <p><strong>Área legal:</strong> ${escapeHtml(payload.legal_area)}</p>
        <p><strong>Urgencia:</strong> ${escapeHtml(payload.urgency)}</p>
        <p><strong>Descripción:</strong> ${escapeHtml(payload.case_description)}</p>
        <p><strong>Fecha:</strong> ${createdAt}</p>
      `);

      res.status(201).json({ message: 'Referido enviado correctamente. El equipo de Orjuela Abogados se pondrá en contacto con la persona referida.' });
    });
    stmt.finalize();
  });
});

app.post('/api/leads', (req, res) => {
  const payload = {
    name: cleanText(req.body.name),
    phone: cleanText(req.body.phone, 60),
    email: normalizeEmail(req.body.email),
    case_type: cleanText(req.body.case_type, 80),
    source: cleanText(req.body.source || 'Web', 40),
    assigned_to: cleanText(req.body.assigned_to, 100),
    notes: cleanText(req.body.notes, 1000),
    referrer_id: req.body.referrer_id ? parseInt(req.body.referrer_id, 10) : null
  };

  if (!payload.name || !payload.phone || !payload.case_type) {
    return res.status(400).json({ error: 'Nombre, teléfono y tipo de caso son obligatorios.' });
  }
  if (payload.email && !isValidEmail(payload.email)) {
    return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido.' });
  }

  const createdAt = getTimestamp();
  const stmt = db.prepare(`INSERT INTO leads (name, phone, email, case_type, source, status, assigned_to, notes, referrer_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'Nuevo', ?, ?, ?, ?, ?)`);

  stmt.run(payload.name, payload.phone, payload.email, payload.case_type, payload.source, payload.assigned_to, payload.notes, payload.referrer_id, createdAt, createdAt, function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error interno al guardar el lead.' });
    }

    sendNotificationEmail('Nuevo lead desde la web', `
      <h2>Nuevo lead comercial</h2>
      <p><strong>Nombre:</strong> ${escapeHtml(payload.name)}</p>
      <p><strong>Teléfono:</strong> ${escapeHtml(payload.phone)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(payload.email)}</p>
      <p><strong>Tipo de caso:</strong> ${escapeHtml(payload.case_type)}</p>
      <p><strong>Fuente:</strong> ${escapeHtml(payload.source)}</p>
      <p><strong>Notas:</strong> ${escapeHtml(payload.notes)}</p>
    `);

    res.status(201).json({ message: 'Tu solicitud fue recibida. El equipo de Orjuela Abogados te contactará pronto.' });
  });
  stmt.finalize();
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  res.json({ message: 'Autenticación correcta' });
});

app.get('/api/admin/allies', authorizeAdmin, (req, res) => {
  const search = req.query.search ? cleanText(String(req.query.search), 80).toLowerCase().replace(/%/g, '') : '';
  let baseQuery = `SELECT id, full_name, document_number, phone, email, city, ally_type, status, created_at, updated_at FROM allies`;
  const params = [];

  if (search) {
    baseQuery += ` WHERE LOWER(full_name) LIKE ? OR LOWER(document_number) LIKE ? OR LOWER(city) LIKE ? OR LOWER(status) LIKE ?`;
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  baseQuery += ` ORDER BY created_at DESC`;
  db.all(baseQuery, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al cargar aliados.' });
    }
    res.json(rows);
  });
});

app.patch('/api/admin/allies/:id/status', authorizeAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = cleanText(req.body.status, 20);
  if (!id || !status) {
    return res.status(400).json({ error: 'ID y estado son obligatorios.' });
  }
  if (!isOneOf(status, ALLY_STATUSES)) {
    return res.status(400).json({ error: 'Estado de aliado no válido.' });
  }

  db.run(`UPDATE allies SET status = ?, updated_at = ? WHERE id = ?`, [status, getTimestamp(), id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al actualizar el estado del aliado.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Aliado no encontrado.' });
    }
    res.json({ message: 'Aliado actualizado correctamente.' });
  });
});

app.get('/api/admin/referrals', authorizeAdmin, (req, res) => {
  const search = req.query.search ? cleanText(String(req.query.search), 80).toLowerCase().replace(/%/g, '') : '';
  let baseQuery = `SELECT r.id, r.referred_full_name, r.referred_phone, r.referred_email, r.referred_city, r.legal_area, r.case_description, r.status, r.created_at, r.updated_at,
      a.full_name AS ally_name, a.document_number AS ally_document_number
    FROM referrals r
    JOIN allies a ON a.id = r.ally_id`;
  const params = [];

  if (search) {
    baseQuery += ` WHERE LOWER(r.referred_full_name) LIKE ? OR LOWER(r.referred_phone) LIKE ? OR LOWER(r.referred_email) LIKE ? OR LOWER(r.referred_city) LIKE ? OR LOWER(r.legal_area) LIKE ? OR LOWER(r.status) LIKE ? OR LOWER(a.full_name) LIKE ? OR LOWER(a.document_number) LIKE ?`;
    const term = `%${search}%`;
    params.push(term, term, term, term, term, term, term, term);
  }

  baseQuery += ` ORDER BY r.created_at DESC`;
  db.all(baseQuery, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al cargar los referidos.' });
    }
    res.json(rows);
  });
});

app.patch('/api/admin/referrals/:id/status', authorizeAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = cleanText(req.body.status, 20);
  if (!id || !status) {
    return res.status(400).json({ error: 'ID y estado son obligatorios.' });
  }
  if (!isOneOf(status, REFERRAL_STATUSES)) {
    return res.status(400).json({ error: 'Estado de referido no válido.' });
  }

  db.run(`UPDATE referrals SET status = ?, updated_at = ? WHERE id = ?`, [status, getTimestamp(), id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al actualizar el estado del referido.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Referido no encontrado.' });
    }
    res.json({ message: 'Referido actualizado correctamente.' });
  });
});

const distFolder = path.join(__dirname, 'dist', 'abogados-asociados');
const browserFolder = path.join(distFolder, 'browser');
const staticFolder = fs.existsSync(browserFolder) ? browserFolder : distFolder;
if (fs.existsSync(staticFolder)) {
  app.use(express.static(staticFolder));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(staticFolder, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});

