const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(DATA_DIR, 'uploads');
const DATABASE_URL = process.env.DATABASE_URL || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_REGISTRATION_CODE = process.env.ADMIN_REGISTRATION_CODE || '';
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const APP_ENV = process.env.APP_ENV || 'development';
const QA_DEMO_DATA = process.env.QA_DEMO_DATA === 'true' || APP_ENV === 'qa';
const SEED_ACCESS_USERS = process.env.SEED_ACCESS_USERS === 'true';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const SUPPORT_MULTI_ROLE_EMAIL = 'orjuelayabogadossoporte@gmail.com';

function parseEmailList(value) {
  return String(value || '')
    .split(/[,\s;]+/)
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

const GOOGLE_ADMIN_EMAILS = new Set([
  ...parseEmailList(ADMIN_EMAIL),
  SUPPORT_MULTI_ROLE_EMAIL,
  'orjuelayabogados@gmail.com',
  ...parseEmailList(process.env.GOOGLE_ADMIN_EMAILS)
]);

const ALLY_TYPES = ['persona_natural', 'empresa', 'inmobiliaria', 'contador', 'asesor_comercial', 'cliente', 'independiente', 'otro'];
const ALLY_STATUSES = ['pending', 'active', 'inactive'];
const LEGAL_AREAS = ['derecho_civil', 'derecho_laboral', 'derecho_comercial', 'derecho_inmobiliario', 'derecho_familia', 'cobranza', 'contratos', 'sucesiones', 'otro'];
const REFERRAL_STATUSES = ['new', 'contacted', 'in_progress', 'proposal_sent', 'won', 'commission_approved', 'commission_paid', 'rejected'];
const AUTH_ROLES = ['admin', 'abogado', 'asistente', 'ally', 'client'];
const ADMIN_ROLES = ['admin', 'abogado', 'asistente'];
const NETWORK_REFERRAL_STATUSES = ['Nuevo referido', 'En revision', 'Contactado', 'En negociacion', 'Cliente vinculado', 'Caso rechazado', 'Comision aprobada', 'Comision pagada'];
const COMMISSION_STATUSES = ['pending', 'approved', 'paid', 'rejected'];
const COMMISSION_TYPES = ['direct', 'indirect_level_1', 'indirect_level_2'];

const app = express();
app.use(cors());
app.use(express.json({ limit: '16mb' }));
app.use((req, res, next) => {
  res.charset = 'utf-8';
  next();
});
app.use('/uploads', express.static(UPLOAD_DIR));

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL && !/localhost|127\.0\.0\.1/i.test(DATABASE_URL) ? { rejectUnauthorized: false } : false
});

function createPgErrorLogger(context, callback) {
  return (err) => {
    if (err) console.error(`[db] ${context}:`, err);
    if (callback) callback(err || null);
  };
}

function normalizeQueryArgs(params, callback) {
  if (typeof params === 'function') return { params: [], callback: params };
  return { params: params || [], callback: callback || (() => {}) };
}

function pgGet(sql, params = [], callback) {
  const args = normalizeQueryArgs(params, callback);
  pool.query(sql, args.params, (err, result) => {
    args.callback(err, result?.rows?.[0]);
  });
}

function pgAll(sql, params = [], callback) {
  const args = normalizeQueryArgs(params, callback);
  pool.query(sql, args.params, (err, result) => {
    args.callback(err, result?.rows || []);
  });
}

function pgRun(sql, params = [], callback = () => {}) {
  const args = normalizeQueryArgs(params, callback);
  pool.query(sql, args.params, (err, result) => {
    args.callback.call({
      lastID: result?.rows?.[0]?.id || result?.rows?.[0]?.user_id,
      changes: result?.rowCount || 0
    }, err);
  });
}

async function runSchema(sqlStatements) {
  for (const sql of sqlStatements) {
    await pool.query(sql);
  }
}

async function createDatabase() {
  ensureDataDirectory();
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL es obligatorio para usar PostgreSQL/Supabase.');
  }

  await runSchema([
    `CREATE TABLE IF NOT EXISTS allies (
      id BIGSERIAL PRIMARY KEY,
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
    )`,

    `CREATE TABLE IF NOT EXISTS referrals (
      id BIGSERIAL PRIMARY KEY,
      ally_id BIGINT NOT NULL,
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
      updated_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS leads (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      case_type TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Nuevo',
      assigned_to TEXT,
      notes TEXT,
      referrer_id BIGINT,
      priority TEXT DEFAULT 'Media',
      next_action TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS clients (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      document_id TEXT,
      phone TEXT,
      email TEXT,
      city TEXT,
      address TEXT,
      verified INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Activo',
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS cases (
      id BIGSERIAL PRIMARY KEY,
      client_id BIGINT NOT NULL,
      case_type TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'Recibido',
      assigned_lawyer TEXT,
      next_action TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      archived_at TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`,

    `CREATE TABLE IF NOT EXISTS case_documents (
      id BIGSERIAL PRIMARY KEY,
      case_id BIGINT NOT NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      document_type TEXT,
      status TEXT DEFAULT 'Recibido',
      observations TEXT,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id)
    )`,

    `CREATE TABLE IF NOT EXISTS payments (
      id BIGSERIAL PRIMARY KEY,
      related_type TEXT NOT NULL,
      related_id BIGINT NOT NULL,
      concept TEXT,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      payment_method TEXT,
      payment_date TEXT,
      support_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS admin_agenda (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      client_name TEXT,
      related_type TEXT,
      related_id BIGINT,
      assigned_to TEXT,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Programada',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      document_id TEXT,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      auth_provider TEXT DEFAULT 'password',
      google_sub TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      reset_token_hash TEXT,
      reset_token_expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(email, role)
    )`,

    `CREATE TABLE IF NOT EXISTS client_messages (
      id BIGSERIAL PRIMARY KEY,
      client_id BIGINT NOT NULL,
      case_id BIGINT,
      sender_id BIGINT,
      sender_role TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_name TEXT,
      attachment_url TEXT,
      is_read_by_client INTEGER NOT NULL DEFAULT 1,
      is_read_by_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (case_id) REFERENCES cases(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS client_service_requests (
      id BIGSERIAL PRIMARY KEY,
      client_id BIGINT NOT NULL,
      lead_id BIGINT,
      service_type TEXT NOT NULL,
      description TEXT NOT NULL,
      urgency TEXT NOT NULL,
      documents TEXT,
      city TEXT,
      email TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'Enviada',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    )`,

    `CREATE TABLE IF NOT EXISTS client_notifications (
      id BIGSERIAL PRIMARY KEY,
      client_id BIGINT NOT NULL,
      notification_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_id BIGINT,
      actor_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id BIGINT,
      summary TEXT,
      created_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS partners (
      user_id BIGINT PRIMARY KEY,
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
      invited_by_partner_id BIGINT,
      commission_percentage REAL DEFAULT 10,
      commission_balance REAL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS commissions (
      id BIGSERIAL PRIMARY KEY,
      ally_id BIGINT NOT NULL,
      referral_id BIGINT NOT NULL,
      source_ally_id BIGINT NOT NULL,
      commission_type TEXT NOT NULL,
      percentage REAL NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      paid_at TEXT,
      FOREIGN KEY (ally_id) REFERENCES partners(user_id),
      FOREIGN KEY (source_ally_id) REFERENCES partners(user_id),
      FOREIGN KEY (referral_id) REFERENCES referrals(id)
    )`,

    `CREATE TABLE IF NOT EXISTS commission_settings (
      id BIGSERIAL PRIMARY KEY,
      direct_percentage REAL NOT NULL DEFAULT 10,
      level_1_percentage REAL NOT NULL DEFAULT 3,
      level_2_percentage REAL NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS referral_status_history (
      id BIGSERIAL PRIMARY KEY,
      referral_id BIGINT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      visible_to_ally INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (referral_id) REFERENCES referrals(id)
    )`,

    `CREATE TABLE IF NOT EXISTS ally_activity_logs (
      id BIGSERIAL PRIMARY KEY,
      ally_id BIGINT NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT,
      status TEXT,
      created_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS ally_resources (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      description TEXT,
      url TEXT,
      content TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS ally_levels (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      min_converted_referrals INTEGER NOT NULL,
      min_commissions REAL NOT NULL,
      min_active_allies INTEGER NOT NULL,
      benefits TEXT,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1
    )`,

    `CREATE TABLE IF NOT EXISTS ally_goals (
      id BIGSERIAL PRIMARY KEY,
      ally_id BIGINT,
      month TEXT NOT NULL,
      referral_goal INTEGER NOT NULL DEFAULT 5,
      converted_goal INTEGER NOT NULL DEFAULT 1,
      commission_goal REAL NOT NULL DEFAULT 500000,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS ally_notifications (
      id BIGSERIAL PRIMARY KEY,
      ally_id BIGINT NOT NULL,
      notification_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS admin_notifications (
      id BIGSERIAL PRIMARY KEY,
      notification_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      entity_type TEXT,
      entity_id BIGINT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      whatsapp_url TEXT,
      email_url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS ally_legal_acceptances (
      id BIGSERIAL PRIMARY KEY,
      ally_id BIGINT NOT NULL,
      document_type TEXT NOT NULL,
      accepted_at TEXT,
      ip_address TEXT,
      version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    )`,

    `CREATE TABLE IF NOT EXISTS ally_kyc_verifications (
      id BIGSERIAL PRIMARY KEY,
      ally_id BIGINT NOT NULL UNIQUE,
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
    )`,

    `CREATE TABLE IF NOT EXISTS ally_electronic_signatures (
      id BIGSERIAL PRIMARY KEY,
      ally_id BIGINT NOT NULL,
      document_type TEXT NOT NULL,
      full_name TEXT NOT NULL,
      document_number TEXT NOT NULL,
      version TEXT NOT NULL,
      signed_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'accepted'
    )`,

    `CREATE TABLE IF NOT EXISTS ally_fraud_alerts (
      id BIGSERIAL PRIMARY KEY,
      ally_id BIGINT,
      referral_id BIGINT,
      risk_level TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS ally_academy_modules (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      content TEXT,
      video_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1
    )`,

    `CREATE TABLE IF NOT EXISTS ally_academy_progress (
      id BIGSERIAL PRIMARY KEY,
      ally_id BIGINT NOT NULL,
      module_id BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendiente',
      progress INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(ally_id, module_id)
    )`,

    `CREATE TABLE IF NOT EXISTS auth_clients (
      user_id BIGINT PRIMARY KEY,
      document_id TEXT UNIQUE,
      assigned_lawyer TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
  ]);

  await runSchema([
    `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`,
    `CREATE UNIQUE INDEX IF NOT EXISTS users_email_role_key ON users(email, role)`,
    `ALTER TABLE partners ADD COLUMN IF NOT EXISTS commission_percentage REAL DEFAULT 10`
  ]);

  pgRun(`INSERT INTO commission_settings (direct_percentage, level_1_percentage, level_2_percentage, is_active, created_at, updated_at)
    SELECT 10, 3, 1, 1, $1, $2
    WHERE NOT EXISTS (SELECT 1 FROM commission_settings WHERE is_active = 1)`, [new Date().toISOString(), new Date().toISOString()], createPgErrorLogger('seed commission_settings'));

    const seedNow = new Date().toISOString();
    [
      ['Bronce', 0, 0, 0, 'Acceso a recursos base, portal de seguimiento y soporte comercial.', 1],
      ['Plata', 3, 500000, 1, 'Prioridad en soporte, plantillas avanzadas y revisión mensual de desempeño.', 2],
      ['Oro', 8, 1500000, 3, 'Acompañamiento comercial dedicado y materiales personalizados.', 3],
      ['Elite', 15, 3500000, 5, 'Beneficios preferenciales, sesiones estratégicas y reconocimiento destacado.', 4]
    ].forEach((item) => {
      pgRun(`INSERT INTO ally_levels (name, min_converted_referrals, min_commissions, min_active_allies, benefits, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name) DO NOTHING`, item, createPgErrorLogger('seed ally_levels'));
    });

    [
      ['Mensaje para cliente', 'whatsapp', 'Texto base para recomendar servicios legales.', '', 'Hola, quiero recomendarte a Orjuela Abogados. Pueden ayudarte con asesoría jurídica personalizada.'],
      ['Mensaje para invitar aliado', 'whatsapp', 'Texto base para invitar aliados.', '', 'Hola, quiero invitarte al programa de aliados de Orjuela Abogados.'],
      ['Texto para redes sociales', 'social', 'Copy breve para publicar en redes.', '', 'Acompañamiento legal claro, profesional y personalizado con Orjuela Abogados.'],
      ['Flyer servicios legales', 'flyer', 'Pieza descargable para compartir.', '/assets/logoCompleto.jpg', ''],
      ['PDF portafolio de servicios', 'pdf', 'Documento comercial editable.', '/assets/logoCompleto.jpg', ''],
      ['Logo autorizado', 'logo', 'Uso de marca aprobado para aliados.', '/assets/logoCompleto.jpg', '']
    ].forEach((item) => {
      pgRun(`INSERT INTO ally_resources (title, resource_type, description, url, content, created_at)
        SELECT $1, $2, $3, $4, $5, $6
        WHERE NOT EXISTS (SELECT 1 FROM ally_resources WHERE title = $7)`, [...item, seedNow, item[0]], createPgErrorLogger('seed ally_resources'));
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
      pgRun(`INSERT INTO ally_academy_modules (title, description, content, sort_order)
        SELECT $1, $2, $3, $4
        WHERE NOT EXISTS (SELECT 1 FROM ally_academy_modules WHERE title = $5)`, [item[0], item[1], item[2], index + 1, item[0]], createPgErrorLogger('seed ally_academy_modules'));
    });
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
const dbReady = createDatabase();

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

function sendTransactionalEmail(to, subject, html) {
  if (!to || !transporter) {
    console.log('[mail] Transactional email skipped. Configure SMTP_* variables.', subject);
    return false;
  }

  transporter.sendMail({
    from: process.env.SMTP_FROM || ADMIN_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    html
  }).catch((error) => {
    console.error('[mail] Error sending transactional email:', error);
  });
  return true;
}

function getTimestamp() {
  return new Date().toISOString();
}

function createClientNotification(clientId, type, title, description) {
  if (!clientId || !title || !description) return;
  pgRun(`INSERT INTO client_notifications (client_id, notification_type, title, description, is_read, created_at)
    VALUES ($1, $2, $3, $4, 0, $5)`, [
    clientId,
    cleanText(type || 'Portal', 60),
    cleanText(title, 160),
    cleanText(description, 500),
    getTimestamp()
  ], () => {});
}

function createAllyNotification(allyId, type, title, description) {
  if (!allyId || !title || !description) return;
  pgRun(`INSERT INTO ally_notifications (ally_id, notification_type, title, description, is_read, created_at)
    VALUES ($1, $2, $3, $4, 0, $5)`, [
    allyId,
    cleanText(type || 'Portal', 60),
    cleanText(title, 160),
    cleanText(description, 500),
    getTimestamp()
  ], createPgErrorLogger('create ally notification'));
}

function whatsappLink(phone, message = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const normalized = digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
  const text = cleanText(message, 500);
  return `https://wa.me/${normalized}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

function mailtoLink(email, subject = '') {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !isValidEmail(cleanEmail)) return '';
  const cleanSubject = cleanText(subject, 160);
  return `mailto:${cleanEmail}${cleanSubject ? `?subject=${encodeURIComponent(cleanSubject)}` : ''}`;
}

function createAdminNotification(data = {}) {
  const title = cleanText(data.title, 180);
  const description = cleanText(data.description, 700);
  if (!title || !description) return;

  const contactName = cleanText(data.contact_name, 180);
  const contactPhone = cleanText(data.contact_phone, 80);
  const contactEmail = normalizeEmail(data.contact_email);
  const notificationType = cleanText(data.notification_type || 'general', 80);
  const entityType = cleanText(data.entity_type || '', 80);
  const entityId = data.entity_id ? parseInt(data.entity_id, 10) : null;
  const message = data.whatsapp_message || `Hola ${contactName || ''}, te contactamos de Orjuela Abogados y Asociados.`;

  pgRun(`INSERT INTO admin_notifications
    (notification_type, title, description, entity_type, entity_id, contact_name, contact_phone, contact_email, whatsapp_url, email_url, is_read, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11)`, [
    notificationType,
    title,
    description,
    entityType,
    entityId,
    contactName,
    contactPhone,
    contactEmail,
    whatsappLink(contactPhone, message),
    mailtoLink(contactEmail, title),
    getTimestamp()
  ], createPgErrorLogger('create admin notification'));
}

const ADMIN_LEADS_SQL = `
  SELECT
    CAST(l.id AS TEXT) AS id,
    l.id AS raw_id,
    'lead' AS source_kind,
    l.name,
    l.phone,
    l.email,
    l.case_type,
    l.source,
    l.status,
    l.assigned_to,
    l.notes,
    l.priority,
    l.next_action,
    '' AS city,
    '' AS ally_name,
    l.created_at,
    l.updated_at
  FROM leads l
  UNION ALL
  SELECT
    'referral-' || CAST(r.id AS TEXT) AS id,
    r.id AS raw_id,
    'referral' AS source_kind,
    r.referred_full_name AS name,
    r.referred_phone AS phone,
    r.referred_email AS email,
    r.legal_area AS case_type,
    COALESCE(NULLIF(r.referral_channel, ''), 'Aliado') AS source,
    r.status,
    COALESCE(u.full_name, 'Equipo aliados') AS assigned_to,
    CONCAT(
      'Referido por: ', COALESCE(u.full_name, 'Aliado no identificado'),
      '. Ciudad: ', COALESCE(r.referred_city, ''),
      '. Descripción: ', COALESCE(r.case_description, ''),
      CASE WHEN COALESCE(r.file_notes, '') <> '' THEN CONCAT('. Notas: ', r.file_notes) ELSE '' END
    ) AS notes,
    COALESCE(NULLIF(r.urgency, ''), 'Media') AS priority,
    'Contactar al referido y calificar necesidad legal' AS next_action,
    r.referred_city AS city,
    COALESCE(u.full_name, '') AS ally_name,
    r.created_at,
    r.updated_at
  FROM referrals r
  LEFT JOIN users u ON u.id = r.ally_id
`;

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
  pgRun(`INSERT INTO auth_clients (user_id, document_id, assigned_lawyer)
    VALUES ($1, $2, 'Equipo Orjuela')
    ON CONFLICT (user_id) DO NOTHING`, [user.id, documentId], (authErr) => {
    if (authErr) return callback(authErr);
    pgGet(`SELECT id FROM clients WHERE email = $1 OR document_id = $2`, [user.email, documentId], (clientErr, client) => {
      if (clientErr) return callback(clientErr);
      if (client) return callback();
      pgRun(`INSERT INTO clients (name, document_id, phone, email, created_at) VALUES ($1, $2, '', $3, $4)`, [user.full_name, documentId, user.email, getTimestamp()], callback);
    });
  });
}

function ensurePartnerProfile(user, callback) {
  const documentId = normalizeDocument(user.document_id) || generatedDocumentId('ALIADO', user.email);
  const referralCode = generateReferralCode(user.full_name || user.email, documentId);
  pgRun(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, referral_code, commission_balance, created_at, updated_at)
    VALUES ($1, $2, '', '', 'Independiente', '', 'Registro web', 'Aliado referidor', $3, 0, $4, $5)
    ON CONFLICT (user_id) DO NOTHING`,
    [user.id, documentId, referralCode, getTimestamp(), getTimestamp()], callback);
}

function ensureRoleProfile(user, callback = () => {}) {
  if (user.role === 'client') return ensureClientProfile(user, callback);
  if (user.role === 'ally') return ensurePartnerProfile(user, callback);
  return callback();
}

function adminGoogleSignupAllowed(email) {
  return GOOGLE_ADMIN_EMAILS.has(normalizeEmail(email));
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function isSupportMultiRoleEmail(email) {
  return normalizeEmail(email) === SUPPORT_MULTI_ROLE_EMAIL;
}

function roleMatchesRequest(userRole, requestedRole) {
  if (requestedRole === 'admin') return isAdminRole(userRole);
  return userRole === requestedRole;
}

function findUserForRequestedRole(users, requestedRole) {
  return (users || []).find((user) => roleMatchesRequest(user.role, requestedRole));
}

function validateEmailRoleAvailability(existingUsers, email, requestedRole) {
  const users = existingUsers || [];
  if (findUserForRequestedRole(users, requestedRole)) {
    return 'Ya existe una cuenta con este correo para ese perfil.';
  }
  if (isSupportMultiRoleEmail(email)) return '';
  if (isAdminRole(requestedRole) && users.length > 0) {
    return 'Este correo ya pertenece a otro perfil y no puede registrarse como administrador.';
  }
  if (users.some((user) => isAdminRole(user.role))) {
    return 'Este correo pertenece a un administrador y no puede usarse como cliente o aliado.';
  }
  return '';
}

function documentPrefixForRole(role) {
  if (role === 'ally') return 'ALIADO';
  if (role === 'admin') return 'ADMIN';
  return 'CLIENTE';
}

function googleValidationMessage(error) {
  const reason = error?.message || '';
  if (reason === 'invalid_audience') {
    return 'La cuenta de Google fue validada, pero el Client ID no coincide con la configuracion del servidor.';
  }
  if (reason === 'email_not_verified') {
    return 'Tu correo de Google no aparece verificado.';
  }
  return 'No fue posible validar tu cuenta de Google.';
}

function verifyGoogleCredential(credential, callback) {
  if (!credential) return callback(new Error('missing_credential'));
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

function googleTokenMatchesClient(tokenInfo) {
  if (!GOOGLE_CLIENT_ID) return true;
  const tokenClientId = cleanText(tokenInfo.aud || tokenInfo.audience || tokenInfo.issued_to, 250);
  if (!tokenClientId) return true;
  return tokenClientId === GOOGLE_CLIENT_ID;
}

function verifyGoogleAccessToken(accessToken, callback) {
  getJsonFromUrl('https://www.googleapis.com/oauth2/v3/userinfo', { Authorization: `Bearer ${accessToken}` }, (profileErr, profileResult) => {
    if (profileErr) return callback(profileErr);
    const profile = profileResult.body;
    if (profileResult.statusCode !== 200 || profile.error) return callback(new Error('invalid_credential'));
    if (profile.email_verified !== true && profile.email_verified !== 'true') return callback(new Error('email_not_verified'));

    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`;
    getJsonFromUrl(tokenInfoUrl, {}, (tokenErr, tokenResult) => {
      const tokenInfo = tokenResult?.body || {};
      if (!tokenErr && tokenResult?.statusCode === 200 && !tokenInfo.error && !googleTokenMatchesClient(tokenInfo)) {
        return callback(new Error('invalid_audience'));
      }
      if (tokenErr || tokenResult?.statusCode !== 200 || tokenInfo.error) {
        console.warn('[auth/google] tokeninfo was unavailable for access_token validation; userinfo succeeded.');
      }

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

  pgGet(`SELECT id FROM users WHERE email = $1 AND role = $2`, [email, role], (selectErr, existingUser) => {
    if (selectErr) return callback(selectErr);

    if (existingUser) {
      return pgRun(`UPDATE users
        SET full_name = $1, document_id = $2, password_hash = $3, status = 'active', updated_at = $4
        WHERE id = $5`, [fullName, documentId, passwordHash, now, existingUser.id], (updateErr) => {
        callback(updateErr, existingUser.id);
      });
    }

    return pgRun(`INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
      RETURNING id`, [fullName, documentId, email, passwordHash, role, now, now], function insertUser(insertErr) {
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
        pgRun(`INSERT INTO auth_clients (user_id, document_id, assigned_lawyer)
          VALUES ($1, $2, 'Equipo Orjuela')
          ON CONFLICT(user_id) DO UPDATE SET
            document_id = excluded.document_id,
            assigned_lawyer = excluded.assigned_lawyer`, [userId, user.documentId]);

        pgRun(`INSERT INTO clients (name, document_id, phone, email, created_at)
          SELECT $1, $2, '3000000000', $3, $4
          WHERE NOT EXISTS (SELECT 1 FROM clients WHERE email = $5)`,
          [user.fullName, user.documentId, user.email, now, user.email]);
      }

      if (user.role === 'ally') {
        pgRun(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, bank_name, account_type, account_number, referral_code, commission_balance, created_at, updated_at)
          VALUES ($1, $2, '3001234567', 'Bogotá', 'Independiente', 'Orjuela Abogados', 'Usuario de prueba para producción', 'Asesor comercial aliado', 'Bancolombia', 'Ahorros', '****6789', 'ORJUELAPRUEBA', 1190000, $3, $4)
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

    [...directReferrals, ...networkReferrals].forEach((item) => {
      pgRun(`INSERT INTO referrals
        (id, ally_id, referred_full_name, client_identification, referred_phone, referred_email, referred_city, legal_area, case_description, referral_channel, urgency, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          ally_id = excluded.ally_id,
          referred_full_name = excluded.referred_full_name,
          client_identification = excluded.client_identification,
          referred_phone = excluded.referred_phone,
          referred_email = excluded.referred_email,
          referred_city = excluded.referred_city,
          legal_area = excluded.legal_area,
          case_description = excluded.case_description,
          referral_channel = excluded.referral_channel,
          urgency = excluded.urgency,
          status = excluded.status,
          updated_at = excluded.updated_at`, [...item, item[12]]);
    });

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
    commissionRows.forEach((item) => {
      pgRun(`INSERT INTO commissions
        (id, ally_id, referral_id, source_ally_id, commission_type, percentage, amount, status, created_at, paid_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          ally_id = excluded.ally_id,
          referral_id = excluded.referral_id,
          source_ally_id = excluded.source_ally_id,
          commission_type = excluded.commission_type,
          percentage = excluded.percentage,
          amount = excluded.amount,
          status = excluded.status,
          paid_at = excluded.paid_at`, item);
    });

    pgRun(`INSERT INTO ally_goals (id, ally_id, month, referral_goal, converted_goal, commission_goal, is_active, updated_at)
      VALUES (2001, $1, $2, 8, 2, 700000, 1, $3)
      ON CONFLICT (id) DO UPDATE SET
        ally_id = excluded.ally_id,
        month = excluded.month,
        referral_goal = excluded.referral_goal,
        converted_goal = excluded.converted_goal,
        commission_goal = excluded.commission_goal,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at`, [allyUserId, month, now]);

    pgRun(`DELETE FROM ally_notifications WHERE ally_id = $1`, [allyUserId], () => {
      [
        ['Comision aprobada', 'Comisión aprobada', 'Tu comisión por María Rodríguez fue aprobada para pago.', 0, '2026-05-13T08:00:00.000Z'],
        ['Nuevo aliado registrado', 'Nuevo aliado en tu red', 'Camila Red Aliada ya aparece activa dentro de tu red.', 0, '2026-05-12T12:00:00.000Z'],
        ['Cambio de estado', 'Referido actualizado', 'Empresa Andina SAS pasó a Cliente activo.', 1, '2026-05-10T09:00:00.000Z']
      ].forEach((item) => {
        pgRun(`INSERT INTO ally_notifications (ally_id, notification_type, title, description, is_read, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)`, [allyUserId, ...item]);
      });
    });

    pgAll(`SELECT id, title FROM ally_academy_modules ORDER BY sort_order LIMIT 4`, (moduleErr, modules) => {
      if (moduleErr) return;
      modules.forEach((module, index) => {
        const progress = index < 2 ? 100 : index === 2 ? 65 : 25;
        pgRun(`INSERT INTO ally_academy_progress (ally_id, module_id, status, progress, updated_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (ally_id, module_id) DO UPDATE SET
            status = excluded.status,
            progress = excluded.progress,
            updated_at = excluded.updated_at`,
          [allyUserId, module.id, progress === 100 ? 'completado' : 'pendiente', progress, now]);
      });
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
      pgRun(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, referral_code, invited_by_partner_id, commission_balance, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'Independiente', 'Red de aliados Orjuela', 'Invitado por usuario de prueba', 'Referidor aliado', $5, $6, $7, $8, $9)
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
  pgGet(`SELECT referral_code, document_id FROM partners WHERE user_id = $1`, [userId], (err, partner) => {
    if (err || !partner) return callback(err || new Error('Partner not found'));
    if (partner.referral_code) return callback(null, partner.referral_code);

    const attempt = () => {
      const code = generateReferralCode(fullName, partner.document_id);
      pgRun(`UPDATE partners SET referral_code = $1 WHERE user_id = $2 AND (referral_code IS NULL OR referral_code = '')`, [code, userId], (updateErr) => {
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
  pgGet(`SELECT direct_percentage, level_1_percentage, level_2_percentage FROM commission_settings WHERE is_active = 1 ORDER BY id DESC LIMIT 1`, (err, row) => {
    callback(err, row || { direct_percentage: 10, level_1_percentage: 3, level_2_percentage: 1 });
  });
}

function getPartnerProfile(userId, callback) {
  pgGet(`SELECT p.*, u.full_name, u.email, u.status
    FROM partners p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = $1`, [userId], callback);
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
    const rows = [];

    getPartnerProfile(sourceAllyId, (profileErr, partner) => {
      if (profileErr) return callback(profileErr);
      rows.push({
        allyId: sourceAllyId,
        sourceAllyId,
        type: 'direct',
        percentage: Number(partner?.commission_percentage || settings.direct_percentage || 10)
      });
      const finish = () => {
        let pending = rows.length;
        let firstErr = null;
        rows.forEach((row) => {
          pgRun(`INSERT INTO commissions (ally_id, referral_id, source_ally_id, commission_type, percentage, amount, status, created_at)
            VALUES ($1, $2, $3, $4, $5, 0, 'pending', $6)`,
            [row.allyId, referralId, row.sourceAllyId, row.type, row.percentage, createdAt], (insertErr) => {
              if (insertErr && !firstErr) firstErr = insertErr;
              pending -= 1;
              if (pending === 0) callback(firstErr);
            });
        });
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
    { id: 1, fullName: 'Aliado Demo Orjuela', email: 'aliado@orjuela.demo', password: 'Aliado123!', role: 'ally' },
    { id: 2, fullName: 'Cliente Demo Orjuela', email: 'cliente@orjuela.demo', password: 'Cliente123!', role: 'client' },
    { id: 3, fullName: 'Admin Demo Orjuela', email: 'admin@orjuela.demo', password: 'Admin123!', role: 'admin' }
  ];

  demoUsers.forEach((user) => {
    pgRun(`INSERT INTO users (id, full_name, email, password_hash, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
      ON CONFLICT (id) DO UPDATE SET full_name = excluded.full_name, email = excluded.email, password_hash = excluded.password_hash, role = excluded.role, status = excluded.status, updated_at = excluded.updated_at`,
      [user.id, user.fullName, user.email, hashPassword(user.password), user.role, now, now]);
  });

  pgRun(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, referral_code, commission_balance, created_at, updated_at)
    VALUES (1, '900111222', '300 111 2233', 'Bogota', 'Independiente', 'Orjuela QA', 'Ambiente QA', 'Asesor comercial', 'ORJUELAQA', 320000, $1, $2)
    ON CONFLICT (user_id) DO UPDATE SET phone = excluded.phone, city = excluded.city, referral_code = excluded.referral_code, commission_balance = excluded.commission_balance, updated_at = excluded.updated_at`, [now, now]);

  pgRun(`INSERT INTO auth_clients (user_id, document_id, assigned_lawyer)
    VALUES (2, '1020304050', 'Equipo inmobiliario')
    ON CONFLICT (user_id) DO UPDATE SET document_id = excluded.document_id, assigned_lawyer = excluded.assigned_lawyer`);

  pgRun(`INSERT INTO allies (id, full_name, document_number, phone, email, city, ally_type, how_known, status, created_at, updated_at)
    VALUES (1, 'Aliado Demo Orjuela', '900111222', '300 111 2233', 'aliado@orjuela.demo', 'Bogota', 'independiente', 'Ambiente QA', 'active', $1, $2)
    ON CONFLICT (id) DO UPDATE SET full_name = excluded.full_name, phone = excluded.phone, email = excluded.email, city = excluded.city, status = excluded.status, updated_at = excluded.updated_at`, [now, now]);

  pgRun(`INSERT INTO clients (id, name, document_id, phone, email, created_at, updated_at)
    VALUES (1, 'Cliente Demo Orjuela', '1020304050', '310 222 3344', 'cliente@orjuela.demo', $1, $2)
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, document_id = excluded.document_id, phone = excluded.phone, email = excluded.email, updated_at = excluded.updated_at`, [now, now]);

  [
    [1, 'Laura Mendez', '300 456 7890', 'laura@example.com', 'Derecho civil', 'Web', 'Nuevo', 'Comercial', 'Llamar hoy antes de las 5:00 p. m.'],
    [2, 'Inmobiliaria Norte', '311 222 3344', 'contacto@inmobiliaria.test', 'Contratos', 'Aliado', 'Contactado', 'Asistente', 'Enviar propuesta de revision contractual']
  ].forEach((lead) => {
    pgRun(`INSERT INTO leads (id, name, phone, email, case_type, source, status, assigned_to, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING`, [...lead, now, now]);
  });

  pgRun(`INSERT INTO cases (id, client_id, case_type, description, status, assigned_lawyer, next_action, created_at, updated_at)
    VALUES (1, 1, 'Contrato de compraventa', 'Revision de documentos para compra de inmueble.', 'En revision', 'Equipo inmobiliario', 'Enviar certificado actualizado', $1, $2)
    ON CONFLICT (id) DO NOTHING`, [now, now]);

  pgRun(`INSERT INTO referrals (id, ally_id, referred_full_name, referred_phone, referred_email, referred_city, legal_area, case_description, urgency, status, created_at, updated_at)
    VALUES (1, 1, 'Maria Rodriguez', '301 444 7788', 'maria.rodriguez@example.com', 'Bogota', 'derecho_inmobiliario', 'Revision de promesa de compraventa.', 'Media', 'in_progress', $1, $2)
    ON CONFLICT (id) DO NOTHING`, [now, now]);

  pgRun(`INSERT INTO commissions (id, ally_id, referral_id, source_ally_id, commission_type, percentage, amount, status, created_at)
    VALUES (1, 1, 1, 1, 'direct', 10, 180000, 'approved', $1)
    ON CONFLICT (id) DO NOTHING`, [now]);

  console.log('[qa] Demo data enabled. Users: aliado@orjuela.demo, cliente@orjuela.demo, admin@orjuela.demo');
}
function auditAdminAction(req, action, entityType, entityId, summary = '') {
  const actor = req.user || {};
  pgRun(`INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, summary, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
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

  pgAll(`SELECT id, role FROM users WHERE email = $1`, [payload.email], (existingErr, existingUsers) => {
    if (existingErr) return res.status(500).json({ error: 'Error validando usuario.' });
    const roleError = validateEmailRoleAvailability(existingUsers, payload.email, 'client');
    if (roleError) return res.status(409).json({ error: roleError });

    pgGet(`SELECT id FROM clients WHERE document_id = $1`, [documentId], (clientDocErr, existingClient) => {
      if (clientDocErr) return res.status(500).json({ error: 'Error validando cliente.' });
      if (existingClient) return res.status(409).json({ error: 'Ya existe un cliente con esa cédula.' });

      pgRun(`INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'client', 'active', $5, $6)
        RETURNING id`,
        [payload.full_name, documentId, payload.email, hashPassword(payload.password), createdAt, createdAt], function insertUser(err) {
          if (err) return res.status(500).json({ error: 'No fue posible crear la cuenta de cliente.' });
          const userId = this.lastID;
          pgRun(`INSERT INTO auth_clients (user_id, document_id, assigned_lawyer) VALUES ($1, $2, 'Equipo Orjuela')`, [userId, documentId]);
          pgRun(`INSERT INTO clients (name, document_id, phone, email, created_at) VALUES ($1, $2, $3, $4, $5)`, [payload.full_name, documentId, payload.phone, payload.email, createdAt]);
          createAdminNotification({
            notification_type: 'new_client',
            title: 'Nuevo cliente registrado',
            description: `${payload.full_name} creó cuenta de cliente en la plataforma.`,
            entity_type: 'client',
            entity_id: userId,
            contact_name: payload.full_name,
            contact_phone: payload.phone,
            contact_email: payload.email,
            whatsapp_message: `Hola ${payload.full_name}, te contactamos de Orjuela Abogados para acompañarte en tu proceso.`
          });
          res.status(201).json(createAuthResponse({ id: userId, full_name: payload.full_name, document_id: documentId, email: payload.email, role: 'client', status: 'active', auth_provider: 'password' }));
        });
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

  pgAll(`SELECT id, role FROM users WHERE email = $1`, [payload.email], (existingErr, existingUsers) => {
    if (existingErr) return res.status(500).json({ error: 'Error validando usuario.' });
    const roleError = validateEmailRoleAvailability(existingUsers, payload.email, 'admin');
    if (roleError) return res.status(409).json({ error: roleError });

    pgRun(`INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'admin', 'active', $5, $6)
      RETURNING id`,
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
  pgGet(`SELECT user_id FROM partners WHERE referral_code = $1`, [payload.ref], (refErr, referrer) => {
    if (refErr) {
      console.error(refErr);
      return res.status(500).json({ error: 'Error al validar el codigo de invitacion.' });
    }
    pgAll(`SELECT id, role FROM users WHERE email = $1`, [payload.email], (userRoleErr, existingUsers) => {
      if (userRoleErr) return res.status(500).json({ error: 'Error al validar usuario.' });
      const roleError = validateEmailRoleAvailability(existingUsers, payload.email, 'ally');
      if (roleError) return res.status(409).json({ error: roleError });

      pgGet(`SELECT p.user_id FROM partners p
        WHERE p.document_id = $1 OR ($2 <> '' AND p.phone = $3)`, [payload.document_id, payload.phone, payload.phone], (dupErr, duplicate) => {
        if (dupErr) {
          console.error(dupErr);
          return res.status(500).json({ error: 'Error al validar duplicados.' });
        }
        if (duplicate) {
          return res.status(409).json({ error: 'Ya existe un aliado registrado con esa cedula o telefono.' });
        }

        pgRun(`INSERT INTO users (full_name, email, password_hash, role, status, created_at, updated_at)
          VALUES ($1, $2, $3, 'ally', 'active', $4, $5)
          RETURNING id`,
          [payload.full_name, payload.email, hashPassword(payload.password), createdAt, createdAt], function (err) {
        if (err) {
          if (err.message.includes('unique') || err.message.includes('duplicate')) return res.status(409).json({ error: 'Ya existe una cuenta de aliado con este correo.' });
          console.error(err);
          return res.status(500).json({ error: 'Error al crear usuario.' });
        }

        const userId = this.lastID;
        const referralCode = generateReferralCode(payload.full_name, payload.document_id);
        pgRun(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, referral_code, invited_by_partner_id, commission_balance)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)`, [userId, payload.document_id, payload.phone, payload.city, payload.partner_type, payload.company, payload.how_known, payload.occupation, referralCode, referrer?.user_id || null], (partnerErr) => {
          if (partnerErr) {
            console.error(partnerErr);
            return res.status(500).json({ error: 'Error al crear perfil de aliado.' });
          }

          const user = { id: userId, full_name: payload.full_name, email: payload.email, role: 'ally', status: 'active' };
          createAdminNotification({
            notification_type: 'new_ally',
            title: 'Nuevo aliado registrado',
            description: `${payload.full_name} creó cuenta de aliado en el portal. Ciudad: ${payload.city}. Tipo: ${payload.partner_type}.`,
            entity_type: 'ally',
            entity_id: userId,
            contact_name: payload.full_name,
            contact_phone: payload.phone,
            contact_email: payload.email,
            whatsapp_message: `Hola ${payload.full_name}, bienvenido al programa de aliados de Orjuela Abogados. Queremos confirmar tu registro.`
          });
          res.status(201).json({ message: 'Tu cuenta de aliado fue creada exitosamente.', token: signToken(user), user });
        });
      });
      });
    });
  });
});

app.post('/api/auth/google', (req, res) => {
  const requestedRole = cleanText(req.body.role, 20);
  if (!['ally', 'client', 'admin'].includes(requestedRole)) {
    return res.status(400).json({ error: 'Selecciona un tipo de acceso válido.' });
  }

  const credential = String(req.body.credential || '');
  const accessToken = String(req.body.access_token || '');
  const verifier = accessToken ? verifyGoogleAccessToken : verifyGoogleCredential;

  verifier(accessToken || credential, (verifyErr, googleProfile) => {
    if (verifyErr || !googleProfile?.email) {
      console.error('[auth/google] Google validation failed:', verifyErr?.message || 'missing_profile');
      return res.status(401).json({ error: googleValidationMessage(verifyErr) });
    }

    pgAll(`SELECT id, full_name, document_id, email, password_hash, auth_provider, google_sub, avatar_url, role, status FROM users WHERE email = $1`, [googleProfile.email], (selectErr, existingUsers) => {
      if (selectErr) return res.status(500).json({ error: 'Error validando usuario.' });
      const existingUser = findUserForRequestedRole(existingUsers, requestedRole);

      if (existingUser) {
        if (existingUser.status !== 'active') return res.status(403).json({ error: 'Esta cuenta no está activa.' });
        if (existingUser.google_sub && googleProfile.google_sub && existingUser.google_sub !== googleProfile.google_sub) {
          return res.status(403).json({ error: 'Esta cuenta ya esta vinculada a otro perfil de Google.' });
        }
        if (requestedRole === 'admin' && !isAdminRole(existingUser.role)) {
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
        pgRun(`UPDATE users SET full_name = $1, google_sub = COALESCE(google_sub, $2), avatar_url = $3, auth_provider = $4, updated_at = $5 WHERE id = $6`,
          [updatedUser.full_name, googleProfile.google_sub, updatedUser.avatar_url, updatedUser.auth_provider, getTimestamp(), existingUser.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'No fue posible actualizar la cuenta.' });
            ensureRoleProfile(updatedUser, (profileErr) => {
              if (profileErr) return res.status(500).json({ error: 'No fue posible preparar tu perfil.' });
              res.json(createAuthResponse(updatedUser));
            });
          });
        return;
      }

      if (requestedRole === 'admin' && !adminGoogleSignupAllowed(googleProfile.email)) {
        return res.status(403).json({ error: 'El acceso con Google al panel interno requiere un correo autorizado en GOOGLE_ADMIN_EMAILS o ADMIN_EMAIL.' });
      }
      const roleError = validateEmailRoleAvailability(existingUsers, googleProfile.email, requestedRole);
      if (roleError) return res.status(409).json({ error: roleError });

      const now = getTimestamp();
      const documentId = generatedDocumentId(documentPrefixForRole(requestedRole), googleProfile.email);
      const passwordHash = hashPassword(crypto.randomBytes(24).toString('hex'));
      pgRun(`INSERT INTO users (full_name, document_id, email, password_hash, auth_provider, google_sub, avatar_url, role, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'google', $5, $6, $7, 'active', $8, $9)
        RETURNING id`,
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
            if (requestedRole === 'ally') {
              createAdminNotification({
                notification_type: 'new_ally',
                title: 'Nuevo aliado registrado con Google',
                description: `${googleProfile.full_name} creó cuenta de aliado con Google.`,
                entity_type: 'ally',
                entity_id: user.id,
                contact_name: googleProfile.full_name,
                contact_email: googleProfile.email
              });
            }
            if (requestedRole === 'client') {
              createAdminNotification({
                notification_type: 'new_client',
                title: 'Nuevo cliente registrado con Google',
                description: `${googleProfile.full_name} creó cuenta de cliente con Google.`,
                entity_type: 'client',
                entity_id: user.id,
                contact_name: googleProfile.full_name,
                contact_email: googleProfile.email
              });
            }
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

  pgAll(`SELECT id, full_name, document_id, email, password_hash, auth_provider, avatar_url, role, status FROM users WHERE email = $1`, [email], (err, users) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al validar credenciales.' });
    }

    const user = findUserForRequestedRole(users, requestedRole);
    if (!user || user.status !== 'active' || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
    if (requestedRole === 'admin' && !isAdminRole(user.role)) {
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
  pgGet(`SELECT COUNT(*) AS total FROM (${ADMIN_LEADS_SQL}) admin_leads`, (leadErr, leadCount) => {
    if (leadErr) return res.status(500).json({ error: 'No fue posible cargar dashboard.' });
    pgGet(`SELECT COUNT(*) AS total FROM cases`, (caseErr, caseCount) => {
      if (caseErr) return res.status(500).json({ error: 'No fue posible cargar casos.' });
      pgGet(`SELECT COUNT(*) AS total FROM clients`, (clientErr, clientCount) => {
        if (clientErr) return res.status(500).json({ error: 'No fue posible cargar clientes.' });
        pgGet(`SELECT COUNT(*) AS total FROM referrals`, (refErr, refCount) => {
          if (refErr) return res.status(500).json({ error: 'No fue posible cargar referidos.' });
          pgGet(`SELECT COUNT(*) AS total FROM (
              SELECT email, document_id, created_at FROM users WHERE role = 'ally'
              UNION
              SELECT email, document_number AS document_id, created_at FROM allies
            ) monthly_allies
            WHERE created_at >= date_trunc('month', CURRENT_DATE)::text`, (allyErr, allyCount) => {
            if (allyErr) return res.status(500).json({ error: 'No fue posible cargar aliados.' });
            pgGet(`SELECT COALESCE(SUM(amount), 0) AS total FROM commissions WHERE status = 'pending'`, (commErr, comm) => {
              if (commErr) return res.status(500).json({ error: 'No fue posible cargar comisiones.' });
              pgGet(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status <> 'Pagado'`, (payErr, pendingPayments) => {
                if (payErr) return res.status(500).json({ error: 'No fue posible cargar pagos.' });
                pgAll(`SELECT * FROM (${ADMIN_LEADS_SQL}) admin_leads ORDER BY created_at DESC LIMIT 8`, (recentErr, recentLeads) => {
                  if (recentErr) return res.status(500).json({ error: 'No fue posible cargar leads.' });
                  reports.leads = leadCount.total || 0;
                  reports.cases = caseCount.total || 0;
                  reports.clients = clientCount.total || 0;
                  reports.referrals = refCount.total || 0;
                  reports.monthly_allies = allyCount.total || 0;
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
                      { label: 'Aliados del mes', value: String(reports.monthly_allies) },
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
});

app.get('/api/admin/notifications', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  pgAll(`SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 150`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'No fue posible cargar notificaciones.' });
    res.json(rows);
  });
});

app.post('/api/admin/notifications/:id/read', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Notificación inválida.' });
  pgRun(`UPDATE admin_notifications SET is_read = 1 WHERE id = $1`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar la notificación.' });
    res.json({ message: 'Notificación marcada como leída.' });
  });
});

app.post('/api/admin/notifications/read-all', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  pgRun(`UPDATE admin_notifications SET is_read = 1`, (err) => {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar notificaciones.' });
    res.json({ message: 'Notificaciones marcadas como leídas.' });
  });
});

app.get('/api/admin/leads', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  pgAll(`SELECT * FROM (${ADMIN_LEADS_SQL}) admin_leads ORDER BY updated_at DESC, created_at DESC`, (err, rows) => {
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
  pgRun(`INSERT INTO leads (name, phone, email, case_type, source, status, assigned_to, notes, priority, next_action, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'Nuevo', $6, $7, $8, $9, $10, $11)
    RETURNING id`,
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
  pgRun(`UPDATE leads SET
      status = COALESCE(NULLIF($1, ''), status),
      assigned_to = COALESCE(NULLIF($2, ''), assigned_to),
      next_action = COALESCE(NULLIF($3, ''), next_action),
      updated_at = $4
    WHERE id = $5`, [status, assignedTo, nextAction, getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar el lead.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Lead no encontrado.' });
    res.json({ message: 'Lead actualizado.' });
  });
});

app.post('/api/admin/leads/:id/convert', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Lead inválido.' });
  pgGet(`SELECT * FROM leads WHERE id = $1`, [id], (leadErr, lead) => {
    if (leadErr) return res.status(500).json({ error: 'No fue posible cargar el lead.' });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado.' });
    const now = getTimestamp();
    pgGet(`SELECT id FROM clients WHERE email = $1 OR phone = $2`, [lead.email, lead.phone], (clientErr, existingClient) => {
      if (clientErr) return res.status(500).json({ error: 'No fue posible validar cliente.' });
      const createCase = (clientId) => {
        pgRun(`INSERT INTO cases (client_id, case_type, description, status, assigned_lawyer, next_action, created_at, updated_at)
          VALUES ($1, $2, $3, 'Recibido', $4, $5, $6, $7)
          RETURNING id`,
          [clientId, lead.case_type, lead.notes || '', lead.assigned_to || 'Equipo Orjuela', lead.next_action || 'Revisar documentación inicial', now, now], function (caseErr) {
            if (caseErr) return res.status(500).json({ error: 'No fue posible crear el caso.' });
            pgRun(`UPDATE leads SET status = 'Convertido en caso', updated_at = $1 WHERE id = $2`, [now, id]);
            res.status(201).json({ message: 'Lead convertido en caso.', case_id: this.lastID, client_id: clientId });
          });
      };
      if (existingClient) return createCase(existingClient.id);
      pgRun(`INSERT INTO clients (name, phone, email, city, created_at, updated_at, verified)
        VALUES ($1, $2, $3, '', $4, $5, 0)
        RETURNING id`, [lead.name, lead.phone, lead.email, now, now], function (insertErr) {
        if (insertErr) return res.status(500).json({ error: 'No fue posible crear el cliente.' });
        createCase(this.lastID);
      });
    });
  });
});

app.get('/api/admin/clients', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  pgAll(`SELECT * FROM clients WHERE COALESCE(status, 'Activo') <> 'Archivado' ORDER BY created_at DESC`, (err, rows) => err ? res.status(500).json({ error: 'No fue posible cargar clientes.' }) : res.json(rows));
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
  pgRun(`INSERT INTO clients (name, document_id, phone, email, city, address, verified, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'Activo', $8, $9)
    RETURNING id`, [payload.name, payload.document_id, payload.phone, payload.email, payload.city, payload.address, payload.verified, now, now], function (err) {
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
  pgRun(`UPDATE clients SET
      name = COALESCE(NULLIF($1, ''), name),
      document_id = COALESCE(NULLIF($2, ''), document_id),
      phone = COALESCE(NULLIF($3, ''), phone),
      email = COALESCE(NULLIF($4, ''), email),
      city = COALESCE(NULLIF($5, ''), city),
      address = COALESCE(NULLIF($6, ''), address),
      status = COALESCE(NULLIF($7, ''), status),
      verified = COALESCE($8, verified),
      updated_at = $9
    WHERE id = $10`, [payload.name, payload.document_id, payload.phone, payload.email, payload.city, payload.address, payload.status, payload.verified, getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar cliente.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    auditAdminAction(req, 'actualizar', 'cliente', id, payload.name || 'Cliente actualizado');
    res.json({ message: 'Cliente actualizado.' });
  });
});

app.delete('/api/admin/clients/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Cliente inválido.' });
  pgRun(`UPDATE clients SET status = 'Archivado', updated_at = $1 WHERE id = $2`, [getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar cliente.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
    auditAdminAction(req, 'archivar', 'cliente', id, 'Cliente archivado');
    res.json({ message: 'Cliente archivado.' });
  });
});

app.delete('/api/admin/clients/:id/permanent', requireAuth(['admin']), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Cliente inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const clientResult = await client.query(`SELECT * FROM clients WHERE id = $1`, [id]);
    const clientRow = clientResult.rows[0];
    if (!clientRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    const userResult = await client.query(`
      SELECT id FROM users
      WHERE role = 'client'
        AND (
          ($1 <> '' AND email = $1)
          OR ($2 <> '' AND document_id = $2)
        )`, [clientRow.email || '', clientRow.document_id || '']);
    const userIds = userResult.rows.map((row) => row.id);

    await client.query(`DELETE FROM client_notifications WHERE client_id = $1`, [id]);
    await client.query(`DELETE FROM client_service_requests WHERE client_id = $1`, [id]);
    await client.query(`DELETE FROM case_documents WHERE case_id IN (SELECT id FROM cases WHERE client_id = $1)`, [id]);
    await client.query(`DELETE FROM client_messages WHERE client_id = $1 OR case_id IN (SELECT id FROM cases WHERE client_id = $1)`, [id]);
    await client.query(`DELETE FROM payments WHERE (related_type = 'client' AND related_id = $1) OR (related_type = 'case' AND related_id IN (SELECT id FROM cases WHERE client_id = $1))`, [id]);
    await client.query(`DELETE FROM admin_agenda WHERE (related_type = 'client' AND related_id = $1) OR (related_type = 'case' AND related_id IN (SELECT id FROM cases WHERE client_id = $1))`, [id]);
    await client.query(`DELETE FROM cases WHERE client_id = $1`, [id]);
    await client.query(`DELETE FROM clients WHERE id = $1`, [id]);

    if (userIds.length) {
      await client.query(`DELETE FROM auth_clients WHERE user_id = ANY($1::bigint[])`, [userIds]);
      await client.query(`UPDATE client_messages SET sender_id = NULL WHERE sender_id = ANY($1::bigint[])`, [userIds]);
      await client.query(`DELETE FROM users WHERE role = 'client' AND id = ANY($1::bigint[])`, [userIds]);
    }

    await client.query('COMMIT');
    auditAdminAction(req, 'eliminar', 'cliente', id, clientRow.name || 'Cliente eliminado');
    res.json({ message: 'Cliente eliminado permanentemente.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin/clients/permanent] delete failed:', err);
    res.status(500).json({ error: 'No fue posible eliminar el cliente.' });
  } finally {
    client.release();
  }
});

app.get('/api/admin/cases', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  pgAll(`SELECT ca.*, cl.name AS client_name, cl.email AS client_email, cl.phone AS client_phone
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
  pgRun(`INSERT INTO clients (name, phone, email, city, created_at, updated_at, verified) VALUES ($1, $2, $3, '', $4, $5, 0)
    RETURNING id`,
    [payload.client_name, payload.client_phone, payload.client_email, now, now], function (clientErr) {
      if (clientErr) return res.status(500).json({ error: 'No fue posible crear cliente.' });
      pgRun(`INSERT INTO cases (client_id, case_type, description, status, assigned_lawyer, next_action, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
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
  pgRun(`UPDATE cases SET
      case_type = COALESCE(NULLIF($1, ''), case_type),
      description = COALESCE(NULLIF($2, ''), description),
      status = COALESCE(NULLIF($3, ''), status),
      assigned_lawyer = COALESCE(NULLIF($4, ''), assigned_lawyer),
      next_action = COALESCE(NULLIF($5, ''), next_action),
      updated_at = $6
    WHERE id = $7`, [payload.case_type, payload.description, payload.status, payload.assigned_lawyer, payload.next_action, getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar caso.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Caso no encontrado.' });
    auditAdminAction(req, 'actualizar', 'caso', id, payload.case_type || payload.status || 'Caso actualizado');
    res.json({ message: 'Caso actualizado.' });
  });
});

app.delete('/api/admin/cases/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Caso inválido.' });
  pgRun(`UPDATE cases SET archived_at = $1, status = 'Archivado', updated_at = $2 WHERE id = $3`, [getTimestamp(), getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar caso.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Caso no encontrado.' });
    auditAdminAction(req, 'archivar', 'caso', id, 'Caso archivado');
    res.json({ message: 'Caso archivado.' });
  });
});

app.get('/api/admin/payments', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  pgAll(`SELECT * FROM payments ORDER BY created_at DESC`, (err, rows) => err ? res.status(500).json({ error: 'No fue posible cargar pagos.' }) : res.json(rows));
});

app.post('/api/admin/payments', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const payload = {
    related_type: cleanText(req.body.related_type || 'case', 40),
    related_id: parseInt(req.body.related_id, 10),
    concept: cleanText(req.body.concept, 140),
    amount: Number(req.body.amount),
    status: cleanText(req.body.status || 'Pendiente', 40),
    payment_method: cleanText(req.body.payment_method || 'Nequi 3144278339', 80),
    payment_date: cleanText(req.body.payment_date, 40),
    support_url: cleanText(req.body.support_url, 220)
  };
  if (!payload.related_id || Number.isNaN(payload.amount) || payload.amount < 0) return res.status(400).json({ error: 'Relacionado y monto son obligatorios.' });
  if (!['Nequi 3144278339', 'Efectivo'].includes(payload.payment_method)) return res.status(400).json({ error: 'Medio de pago no válido.' });
  const now = getTimestamp();
  pgRun(`INSERT INTO payments (related_type, related_id, concept, amount, status, payment_method, payment_date, support_url, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`, [payload.related_type, payload.related_id, payload.concept, payload.amount, payload.status, payload.payment_method, payload.payment_date, payload.support_url, now, now], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear pago.' });
    auditAdminAction(req, 'crear', 'pago', this.lastID, payload.concept || String(payload.amount));
    res.status(201).json({ id: this.lastID, ...payload, created_at: now, updated_at: now });
  });
});

app.patch('/api/admin/payments/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const amount = req.body.amount === undefined ? null : Number(req.body.amount);
  if (!id) return res.status(400).json({ error: 'Pago inválido.' });
  pgRun(`UPDATE payments SET
      concept = COALESCE(NULLIF($1, ''), concept),
      amount = COALESCE($2, amount),
      status = COALESCE(NULLIF($3, ''), status),
      payment_method = COALESCE(NULLIF($4, ''), payment_method),
      payment_date = COALESCE(NULLIF($5, ''), payment_date),
      support_url = COALESCE(NULLIF($6, ''), support_url),
      updated_at = $7
    WHERE id = $8`, [
    cleanText(req.body.concept, 140),
    amount !== null && !Number.isNaN(amount) ? amount : null,
    cleanText(req.body.status, 40),
    cleanText(req.body.payment_method, 80),
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
  pgRun(`UPDATE payments SET status = 'Archivado', updated_at = $1 WHERE id = $2`, [getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar pago.' });
    auditAdminAction(req, 'archivar', 'pago', id, 'Pago archivado');
    res.json({ message: 'Pago archivado.' });
  });
});

app.get('/api/admin/documents', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  pgAll(`SELECT d.*, ca.case_type, cl.name AS client_name
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
  pgRun(`INSERT INTO case_documents (case_id, file_name, file_url, document_type, status, observations, uploaded_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`, [caseId, payload.file_name, payload.file_url, payload.document_type, payload.status, payload.observations, getTimestamp()], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear documento.' });
    auditAdminAction(req, 'crear', 'documento', this.lastID, payload.file_name);
    res.status(201).json({ id: this.lastID, case_id: caseId, ...payload });
  });
});

app.patch('/api/admin/documents/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Documento inválido.' });
  pgRun(`UPDATE case_documents SET
      file_name = COALESCE(NULLIF($1, ''), file_name),
      document_type = COALESCE(NULLIF($2, ''), document_type),
      status = COALESCE(NULLIF($3, ''), status),
      observations = COALESCE(NULLIF($4, ''), observations)
    WHERE id = $5`, [cleanText(req.body.file_name, 180), cleanText(req.body.document_type, 80), cleanText(req.body.status, 40), cleanText(req.body.observations, 500), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar documento.' });
    auditAdminAction(req, 'actualizar', 'documento', id, 'Documento actualizado');
    res.json({ message: 'Documento actualizado.' });
  });
});

app.delete('/api/admin/documents/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Documento inválido.' });
  pgRun(`UPDATE case_documents SET status = 'Archivado' WHERE id = $1`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar documento.' });
    auditAdminAction(req, 'archivar', 'documento', id, 'Documento archivado');
    res.json({ message: 'Documento archivado.' });
  });
});

app.get('/api/admin/agenda', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  pgAll(`SELECT id, title, client_name, related_type, related_id, assigned_to, scheduled_at AS date, status, notes
    FROM admin_agenda
    WHERE status <> 'Archivado'
    ORDER BY scheduled_at DESC LIMIT 40`, (agendaErr, agendaRows) => {
    if (agendaErr) return res.status(500).json({ error: 'No fue posible cargar agenda.' });
    if (agendaRows.length) return res.json(agendaRows);
    pgAll(`SELECT ca.id, cl.name AS client_name, ca.next_action AS title, 'case' AS related_type, ca.id AS related_id,
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
  pgRun(`INSERT INTO admin_agenda (title, client_name, related_type, related_id, assigned_to, scheduled_at, status, notes, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`, [payload.title, payload.client_name, payload.related_type, payload.related_id, payload.assigned_to, payload.scheduled_at, payload.status, payload.notes, now, now], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear agenda.' });
    auditAdminAction(req, 'crear', 'agenda', this.lastID, payload.title);
    res.status(201).json({ id: this.lastID, ...payload });
  });
});

app.patch('/api/admin/agenda/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Agenda inválida.' });
  pgRun(`UPDATE admin_agenda SET
      title = COALESCE(NULLIF($1, ''), title),
      client_name = COALESCE(NULLIF($2, ''), client_name),
      assigned_to = COALESCE(NULLIF($3, ''), assigned_to),
      scheduled_at = COALESCE(NULLIF($4, ''), scheduled_at),
      status = COALESCE(NULLIF($5, ''), status),
      notes = COALESCE(NULLIF($6, ''), notes),
      updated_at = $7
    WHERE id = $8`, [cleanText(req.body.title, 160), cleanText(req.body.client_name, 140), cleanText(req.body.assigned_to, 100), cleanText(req.body.scheduled_at, 60), cleanText(req.body.status, 40), cleanText(req.body.notes, 500), getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar agenda.' });
    auditAdminAction(req, 'actualizar', 'agenda', id, 'Agenda actualizada');
    res.json({ message: 'Agenda actualizada.' });
  });
});

app.delete('/api/admin/agenda/:id', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Agenda inválida.' });
  pgRun(`UPDATE admin_agenda SET status = 'Archivado', updated_at = $1 WHERE id = $2`, [getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar agenda.' });
    auditAdminAction(req, 'archivar', 'agenda', id, 'Agenda archivada');
    res.json({ message: 'Agenda archivada.' });
  });
});

app.get('/api/admin/reports', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  pgGet(`SELECT COUNT(*) AS leads FROM leads`, (leadErr, leads) => {
    if (leadErr) return res.status(500).json({ error: 'No fue posible cargar reportes.' });
    pgGet(`SELECT COUNT(*) AS cases FROM cases`, (caseErr, casesRow) => {
      if (caseErr) return res.status(500).json({ error: 'No fue posible cargar reportes.' });
      pgGet(`SELECT COALESCE(SUM(amount), 0) AS pending_payments FROM payments WHERE status <> 'Pagado'`, (payErr, paymentsRow) => {
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
  pgGet(`SELECT u.full_name, u.document_id, u.email, u.created_at AS user_created_at,
      c.phone, c.city, c.address, c.created_at, c.updated_at, c.verified,
      ac.assigned_lawyer
    FROM users u
    LEFT JOIN clients c ON c.email = u.email OR c.document_id = u.document_id
    LEFT JOIN auth_clients ac ON ac.user_id = u.id
    WHERE u.id = $1`, [req.user.id], (err, row) => {
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
  pgRun(`UPDATE users SET full_name = $1, updated_at = $2 WHERE id = $3`, [payload.full_name, updatedAt, req.user.id]);
  pgGet(`SELECT id FROM clients WHERE email = $1 OR document_id = $2`, [req.user.email, req.user.document_id], (selectErr, client) => {
      if (selectErr) return res.status(500).json({ error: 'No fue posible validar tu perfil.' });

      const finish = () => {
        pgGet(`SELECT u.full_name, u.document_id, u.email, u.created_at AS user_created_at,
            c.phone, c.city, c.address, c.created_at, c.updated_at, c.verified,
            ac.assigned_lawyer
          FROM users u
          LEFT JOIN clients c ON c.email = u.email OR c.document_id = u.document_id
          LEFT JOIN auth_clients ac ON ac.user_id = u.id
          WHERE u.id = $1`, [req.user.id], (profileErr, row) => {
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
        return pgRun(`UPDATE clients SET name = $1, phone = $2, city = $3, address = $4, updated_at = $5 WHERE id = $6`,
          [payload.full_name, payload.phone, payload.city, payload.address, updatedAt, client.id], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'No fue posible actualizar tu perfil.' });
            finish();
          });
      }

      pgRun(`INSERT INTO clients (name, document_id, phone, email, city, address, created_at, updated_at, verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
        [payload.full_name, req.user.document_id || '', payload.phone, req.user.email, payload.city, payload.address, updatedAt, updatedAt], (insertErr) => {
          if (insertErr) return res.status(500).json({ error: 'No fue posible crear tu perfil.' });
          finish();
        });
    });
});

app.get('/api/client/portal', requireAuth(['client']), (req, res) => {
  pgGet(`SELECT id, name FROM clients WHERE email = $1 OR document_id = $2`, [req.user.email, req.user.document_id], (clientErr, client) => {
    if (clientErr) return res.status(500).json({ error: 'No fue posible cargar tu expediente.' });
    if (!client) return res.json({ cases: [], documents: [], payments: [], appointments: [], messages: [], notifications: [] });
    pgAll(`SELECT * FROM cases WHERE client_id = $1 AND archived_at IS NULL ORDER BY COALESCE(updated_at, created_at) DESC`, [client.id], (caseErr, cases) => {
      if (caseErr) return res.status(500).json({ error: 'No fue posible cargar tus casos.' });
      const caseIds = cases.map((item) => item.id);
      const placeholders = caseIds.map((_, index) => `$${index + 1}`).join(',') || 'NULL';
      const casePlaceholdersAfterClient = caseIds.map((_, index) => `$${index + 2}`).join(',') || 'NULL';
      pgAll(`SELECT d.*, ca.case_type
        FROM case_documents d
        JOIN cases ca ON ca.id = d.case_id
        WHERE d.case_id IN (${placeholders}) AND COALESCE(d.status, 'Recibido') <> 'Archivado'
        ORDER BY d.uploaded_at DESC`, caseIds, (docErr, documents) => {
        if (docErr) return res.status(500).json({ error: 'No fue posible cargar documentos.' });
        pgAll(`SELECT * FROM payments
          WHERE (related_type = 'client' AND related_id = $1) OR (related_type = 'case' AND related_id IN (${casePlaceholdersAfterClient}))
          ORDER BY created_at DESC`, [client.id, ...caseIds], (payErr, payments) => {
          if (payErr) return res.status(500).json({ error: 'No fue posible cargar pagos.' });
          pgAll(`SELECT * FROM admin_agenda
            WHERE (related_type = 'client' AND related_id = $1) OR (related_type = 'case' AND related_id IN (${casePlaceholdersAfterClient}))
            ORDER BY scheduled_at DESC`, [client.id, ...caseIds], (agendaErr, appointments) => {
            if (agendaErr) return res.status(500).json({ error: 'No fue posible cargar agenda.' });
            pgAll(`SELECT m.*, ca.case_type
              FROM client_messages m
              LEFT JOIN cases ca ON ca.id = m.case_id
              WHERE m.client_id = $1
              ORDER BY m.created_at DESC
              LIMIT 100`, [client.id], (messageErr, messages) => {
              if (messageErr) return res.status(500).json({ error: 'No fue posible cargar mensajes.' });
              pgAll(`SELECT *
                FROM client_service_requests
                WHERE client_id = $1
                ORDER BY created_at DESC
                LIMIT 50`, [client.id], (serviceErr, serviceRequests) => {
                if (serviceErr) return res.status(500).json({ error: 'No fue posible cargar solicitudes.' });
                pgAll(`SELECT *
                  FROM client_notifications
                  WHERE client_id = $1
                  ORDER BY created_at DESC
                  LIMIT 100`, [client.id], (notificationErr, notifications) => {
                  if (notificationErr) return res.status(500).json({ error: 'No fue posible cargar notificaciones.' });
                  res.json({ client, cases, documents, payments, appointments, messages, serviceRequests, notifications });
                });
              });
            });
          });
        });
      });
    });
  });
});

app.post('/api/client/uploads', requireAuth(['client']), (req, res) => {
  const fileName = cleanText(req.body.file_name, 180);
  const mimeType = cleanText(req.body.mime_type, 120);
  const dataBase64 = String(req.body.data_base64 || '');
  const context = cleanText(req.body.context || 'general', 40).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'general';
  const allowedTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);

  if (!fileName || !mimeType || !dataBase64) return res.status(400).json({ error: 'Archivo incompleto.' });
  if (!allowedTypes.has(mimeType)) return res.status(400).json({ error: 'Formato de archivo no permitido.' });

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch (err) {
    return res.status(400).json({ error: 'Archivo no válido.' });
  }
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'El archivo no puede superar 10 MB.' });

  const originalExt = path.extname(fileName).toLowerCase();
  const fallbackExt = mimeType.includes('pdf') ? '.pdf' : mimeType.includes('png') ? '.png' : mimeType.includes('webp') ? '.webp' : mimeType.includes('word') ? '.docx' : '.jpg';
  const ext = originalExt || fallbackExt;
  const safeBase = path.basename(fileName, originalExt).replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').slice(0, 80) || 'archivo';
  const clientFolder = path.join(UPLOAD_DIR, `client-${req.user.id}`, context);
  fs.mkdirSync(clientFolder, { recursive: true });
  const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeBase}${ext}`;
  const storedPath = path.join(clientFolder, storedName);
  fs.writeFile(storedPath, buffer, (writeErr) => {
    if (writeErr) return res.status(500).json({ error: 'No fue posible guardar el archivo.' });
    const relativeUrl = `/uploads/client-${req.user.id}/${context}/${storedName}`;
    res.status(201).json({
      file_name: fileName,
      file_url: relativeUrl,
      mime_type: mimeType,
      size: buffer.length
    });
  });
});

app.post('/api/client/documents', requireAuth(['client']), (req, res) => {
  const caseId = parseInt(req.body.case_id, 10);
  const payload = {
    file_name: cleanText(req.body.file_name, 180),
    file_url: cleanText(req.body.file_url || '#', 220),
    document_type: cleanText(req.body.document_type || req.body.file_type || 'Cliente', 80),
    observations: cleanText(req.body.observations, 500)
  };
  if (!caseId || !payload.file_name) return res.status(400).json({ error: 'Caso y archivo son obligatorios.' });
  pgGet(`SELECT ca.id, ca.case_type, cl.id AS client_id FROM cases ca JOIN clients cl ON cl.id = ca.client_id WHERE ca.id = $1 AND (cl.email = $2 OR cl.document_id = $3)`, [caseId, req.user.email, req.user.document_id], (caseErr, legalCase) => {
    if (caseErr) return res.status(500).json({ error: 'No fue posible validar el caso.' });
    if (!legalCase) return res.status(403).json({ error: 'No puedes cargar documentos a este caso.' });
    pgRun(`INSERT INTO case_documents (case_id, file_name, file_url, document_type, status, observations, uploaded_at)
      VALUES ($1, $2, $3, $4, 'Recibido', $5, $6)
      RETURNING id`, [caseId, payload.file_name, payload.file_url, payload.document_type, payload.observations, getTimestamp()], function (err) {
      if (err) return res.status(500).json({ error: 'No fue posible registrar documento.' });
      createClientNotification(legalCase.client_id, 'Documentos', 'Documento recibido', `Registramos ${payload.file_name} en tu caso ${legalCase.case_type}.`);
      res.status(201).json({ id: this.lastID, case_id: caseId, ...payload, status: 'Recibido' });
    });
  });
});

app.post('/api/client/appointments', requireAuth(['client']), (req, res) => {
  const caseId = parseInt(req.body.case_id, 10);
  const payload = {
    title: cleanText(req.body.title || req.body.reason, 160),
    scheduled_at: cleanText(req.body.scheduled_at || req.body.requested_date, 60),
    notes: cleanText(req.body.notes || req.body.reason, 500)
  };
  if (!caseId || !payload.title || !payload.scheduled_at) return res.status(400).json({ error: 'Caso, motivo y fecha son obligatorios.' });
  pgGet(`SELECT ca.id, ca.case_type, cl.id AS client_id, cl.name FROM cases ca JOIN clients cl ON cl.id = ca.client_id WHERE ca.id = $1 AND (cl.email = $2 OR cl.document_id = $3)`, [caseId, req.user.email, req.user.document_id], (caseErr, legalCase) => {
    if (caseErr) return res.status(500).json({ error: 'No fue posible validar el caso.' });
    if (!legalCase) return res.status(403).json({ error: 'No puedes solicitar cita para este caso.' });
    const now = getTimestamp();
    pgRun(`INSERT INTO admin_agenda (title, client_name, related_type, related_id, assigned_to, scheduled_at, status, notes, created_at, updated_at)
      VALUES ($1, $2, 'case', $3, 'Equipo Orjuela', $4, 'Solicitada', $5, $6, $7)
      RETURNING id`, [payload.title, legalCase.name, caseId, payload.scheduled_at, payload.notes, now, now], function (err) {
      if (err) return res.status(500).json({ error: 'No fue posible solicitar cita.' });
      createClientNotification(legalCase.client_id, 'Citas', 'Cita solicitada', `Recibimos tu solicitud de cita para ${legalCase.case_type}.`);
      res.status(201).json({ id: this.lastID, message: 'Cita solicitada.' });
    });
  });
});

app.patch('/api/client/appointments/:id/reschedule', requireAuth(['client']), (req, res) => {
  const appointmentId = parseInt(req.params.id, 10);
  const payload = {
    scheduled_at: cleanText(req.body.scheduled_at || req.body.requested_date, 60),
    notes: cleanText(req.body.notes || req.body.reason, 500)
  };
  if (!appointmentId || !payload.scheduled_at) return res.status(400).json({ error: 'Cita y nueva fecha son obligatorias.' });

  pgGet(`SELECT ag.*, ca.case_type, cl.id AS client_id
    FROM admin_agenda ag
    LEFT JOIN cases ca ON ca.id = ag.related_id AND ag.related_type = 'case'
    LEFT JOIN clients cl ON (ag.related_type = 'client' AND cl.id = ag.related_id) OR (ag.related_type = 'case' AND cl.id = ca.client_id)
    WHERE ag.id = $1 AND (cl.email = $2 OR cl.document_id = $3)`,
    [appointmentId, req.user.email, req.user.document_id], (agendaErr, appointment) => {
      if (agendaErr) return res.status(500).json({ error: 'No fue posible validar la cita.' });
      if (!appointment) return res.status(403).json({ error: 'No puedes reprogramar esta cita.' });
      if (['Cancelada', 'Archivado', 'Realizada'].includes(appointment.status)) return res.status(400).json({ error: 'Esta cita ya no se puede reprogramar.' });

      pgRun(`UPDATE admin_agenda SET scheduled_at = $1, status = 'Reprogramación solicitada', notes = COALESCE(NULLIF($2, ''), notes), updated_at = $3 WHERE id = $4`,
        [payload.scheduled_at, payload.notes, getTimestamp(), appointmentId], function (err) {
          if (err) return res.status(500).json({ error: 'No fue posible reprogramar la cita.' });
          createClientNotification(appointment.client_id, 'Citas', 'Reprogramación solicitada', `Recibimos tu nueva fecha para ${appointment.case_type || appointment.title}.`);
          sendNotificationEmail('Cliente solicitó reprogramar cita', `
            <h2>Solicitud de reprogramación</h2>
            <p><strong>Cliente:</strong> ${escapeHtml(req.user.full_name)}</p>
            <p><strong>Cita:</strong> ${escapeHtml(appointment.title)}</p>
            <p><strong>Nueva fecha:</strong> ${escapeHtml(payload.scheduled_at)}</p>
            <p>${escapeHtml(payload.notes)}</p>
          `);
          res.json({ message: 'Reprogramación solicitada.' });
        });
    });
});

app.post('/api/client/appointments/:id/cancel', requireAuth(['client']), (req, res) => {
  const appointmentId = parseInt(req.params.id, 10);
  const reason = cleanText(req.body.reason || 'Cancelada por el cliente', 500);
  if (!appointmentId) return res.status(400).json({ error: 'Cita inválida.' });

  pgGet(`SELECT ag.*, ca.case_type, cl.id AS client_id
    FROM admin_agenda ag
    LEFT JOIN cases ca ON ca.id = ag.related_id AND ag.related_type = 'case'
    LEFT JOIN clients cl ON (ag.related_type = 'client' AND cl.id = ag.related_id) OR (ag.related_type = 'case' AND cl.id = ca.client_id)
    WHERE ag.id = $1 AND (cl.email = $2 OR cl.document_id = $3)`,
    [appointmentId, req.user.email, req.user.document_id], (agendaErr, appointment) => {
      if (agendaErr) return res.status(500).json({ error: 'No fue posible validar la cita.' });
      if (!appointment) return res.status(403).json({ error: 'No puedes cancelar esta cita.' });
      if (['Cancelada', 'Archivado', 'Realizada'].includes(appointment.status)) return res.status(400).json({ error: 'Esta cita ya no se puede cancelar.' });

      const notes = [appointment.notes, `Cancelada por cliente: ${reason}`].filter(Boolean).join('\n');
      pgRun(`UPDATE admin_agenda SET status = 'Cancelada', notes = $1, updated_at = $2 WHERE id = $3`,
        [notes, getTimestamp(), appointmentId], function (err) {
          if (err) return res.status(500).json({ error: 'No fue posible cancelar la cita.' });
          createClientNotification(appointment.client_id, 'Citas', 'Cita cancelada', `Cancelamos tu cita ${appointment.title}.`);
          sendNotificationEmail('Cliente canceló una cita', `
            <h2>Cita cancelada por cliente</h2>
            <p><strong>Cliente:</strong> ${escapeHtml(req.user.full_name)}</p>
            <p><strong>Cita:</strong> ${escapeHtml(appointment.title)}</p>
            <p>${escapeHtml(reason)}</p>
          `);
          res.json({ message: 'Cita cancelada.' });
        });
    });
});

app.post('/api/client/payments/:id/support', requireAuth(['client']), (req, res) => {
  const paymentId = parseInt(req.params.id, 10);
  const payload = {
    support_url: cleanText(req.body.support_url, 220),
    payment_method: cleanText(req.body.payment_method || 'Nequi 3118924111', 80),
    payment_date: cleanText(req.body.payment_date, 40)
  };
  if (!paymentId) return res.status(400).json({ error: 'Pago inválido.' });
  if (!payload.support_url) return res.status(400).json({ error: 'Registra el enlace o referencia del comprobante.' });
  if (!['Nequi 3118924111', 'Nequi 3144278339', 'Efectivo', 'Transferencia', 'Otro'].includes(payload.payment_method)) {
    return res.status(400).json({ error: 'Medio de pago no válido.' });
  }

  pgGet(`SELECT id, name FROM clients WHERE email = $1 OR document_id = $2`, [req.user.email, req.user.document_id], (clientErr, client) => {
    if (clientErr) return res.status(500).json({ error: 'No fue posible validar tu perfil.' });
    if (!client) return res.status(404).json({ error: 'No encontramos tu perfil de cliente.' });

    pgGet(`SELECT p.*
      FROM payments p
      LEFT JOIN cases ca ON ca.id = p.related_id AND p.related_type = 'case'
      WHERE p.id = $1 AND (
        (p.related_type = 'client' AND p.related_id = $2)
        OR (p.related_type = 'case' AND ca.client_id = $3)
      )`, [paymentId, client.id, client.id], (paymentErr, payment) => {
      if (paymentErr) return res.status(500).json({ error: 'No fue posible validar el pago.' });
      if (!payment) return res.status(403).json({ error: 'No puedes registrar soporte para este pago.' });

      pgRun(`UPDATE payments SET support_url = $1, payment_method = $2, payment_date = COALESCE(NULLIF($3, ''), payment_date), status = 'Soporte enviado', updated_at = $4 WHERE id = $5`,
        [payload.support_url, payload.payment_method, payload.payment_date, getTimestamp(), paymentId], function (err) {
          if (err) return res.status(500).json({ error: 'No fue posible registrar el soporte.' });
          createClientNotification(client.id, 'Pagos', 'Soporte de pago enviado', `Recibimos el soporte para ${payment.concept || 'tu pago'}.`);
          sendNotificationEmail('Soporte de pago registrado por cliente', `
            <h2>Soporte de pago recibido</h2>
            <p><strong>Cliente:</strong> ${escapeHtml(client.name || req.user.full_name)}</p>
            <p><strong>Concepto:</strong> ${escapeHtml(payment.concept || 'Pago')}</p>
            <p><strong>Medio:</strong> ${escapeHtml(payload.payment_method)}</p>
            <p><strong>Soporte:</strong> ${escapeHtml(payload.support_url)}</p>
          `);
          res.json({ message: 'Soporte registrado.', id: paymentId, status: 'Soporte enviado', ...payload });
        });
    });
  });
});

app.post('/api/client/messages', requireAuth(['client']), (req, res) => {
  const caseId = parseInt(req.body.case_id, 10);
  const payload = {
    message: cleanText(req.body.message, 2000),
    attachment_name: cleanText(req.body.attachment_name, 180),
    attachment_url: cleanText(req.body.attachment_url, 220)
  };
  if (!caseId || !payload.message || payload.message.length < 8) {
    return res.status(400).json({ error: 'Caso y mensaje son obligatorios.' });
  }

  pgGet(`SELECT ca.id, ca.case_type, cl.id AS client_id, cl.name AS client_name
    FROM cases ca
    JOIN clients cl ON cl.id = ca.client_id
    WHERE ca.id = $1 AND (cl.email = $2 OR cl.document_id = $3)`,
    [caseId, req.user.email, req.user.document_id], (caseErr, legalCase) => {
      if (caseErr) return res.status(500).json({ error: 'No fue posible validar el caso.' });
      if (!legalCase) return res.status(403).json({ error: 'No puedes enviar mensajes a este caso.' });

      const now = getTimestamp();
      pgRun(`INSERT INTO client_messages
        (client_id, case_id, sender_id, sender_role, sender_name, message, attachment_name, attachment_url, is_read_by_client, is_read_by_admin, created_at)
        VALUES ($1, $2, $3, 'client', $4, $5, $6, $7, 1, 0, $8)
        RETURNING id`,
        [legalCase.client_id, caseId, req.user.id, req.user.full_name || legalCase.client_name, payload.message, payload.attachment_name, payload.attachment_url, now], function (err) {
          if (err) return res.status(500).json({ error: 'No fue posible enviar el mensaje.' });
          createClientNotification(legalCase.client_id, 'Mensajes', 'Mensaje enviado', `Tu mensaje sobre ${legalCase.case_type} fue enviado a la firma.`);
          sendNotificationEmail('Nuevo mensaje de cliente', `
            <h2>Nuevo mensaje en portal cliente</h2>
            <p><strong>Cliente:</strong> ${escapeHtml(req.user.full_name || legalCase.client_name)}</p>
            <p><strong>Caso:</strong> ${escapeHtml(legalCase.case_type)}</p>
            <p>${escapeHtml(payload.message)}</p>
            ${payload.attachment_name ? `<p><strong>Adjunto:</strong> ${escapeHtml(payload.attachment_name)}</p>` : ''}
            ${payload.attachment_url ? `<p><strong>URL:</strong> ${escapeHtml(payload.attachment_url)}</p>` : ''}
          `);
          res.status(201).json({
            id: this.lastID,
            client_id: legalCase.client_id,
            case_id: caseId,
            case_type: legalCase.case_type,
            sender_role: 'client',
            sender_name: req.user.full_name || legalCase.client_name,
            message: payload.message,
            attachment_name: payload.attachment_name,
            attachment_url: payload.attachment_url,
            is_read_by_client: 1,
            is_read_by_admin: 0,
            created_at: now
          });
        });
    });
});

app.post('/api/client/service-requests', requireAuth(['client']), (req, res) => {
  const payload = {
    service_type: cleanText(req.body.service_type, 80),
    description: cleanText(req.body.description, 2000),
    urgency: cleanText(req.body.urgency || 'Media', 20),
    documents: cleanText(req.body.documents, 180),
    city: cleanText(req.body.city, 80),
    email: normalizeEmail(req.body.email || req.user.email),
    phone: cleanText(req.body.phone, 30)
  };

  if (!payload.service_type || !payload.description || payload.description.length < 12 || !payload.city || !payload.email || !payload.phone) {
    return res.status(400).json({ error: 'Completa tipo de servicio, descripción, ciudad, correo y teléfono.' });
  }
  if (!isValidEmail(payload.email)) return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });

  pgGet(`SELECT id, name, phone, email, city FROM clients WHERE email = $1 OR document_id = $2`, [req.user.email, req.user.document_id], (clientErr, client) => {
    if (clientErr) return res.status(500).json({ error: 'No fue posible validar tu perfil.' });
    if (!client) return res.status(404).json({ error: 'No encontramos tu perfil de cliente.' });

    const now = getTimestamp();
    const leadNotes = [
      payload.description,
      payload.documents ? `Documento inicial: ${payload.documents}` : '',
      `Urgencia: ${payload.urgency}`,
      `Solicitud enviada desde portal cliente #${client.id}`
    ].filter(Boolean).join('\n');

    pgRun(`INSERT INTO leads (name, phone, email, case_type, source, status, assigned_to, notes, priority, next_action, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'Portal cliente', 'Nuevo', 'Comercial', $5, $6, 'Contactar al cliente y abrir caso si aplica', $7, $8)
      RETURNING id`,
      [client.name || req.user.full_name, payload.phone, payload.email, payload.service_type, leadNotes, payload.urgency === 'Alta' ? 'Alta' : 'Media', now, now], function (leadErr) {
        if (leadErr) return res.status(500).json({ error: 'No fue posible registrar la solicitud.' });
        const leadId = this.lastID;
        pgRun(`INSERT INTO client_service_requests
          (client_id, lead_id, service_type, description, urgency, documents, city, email, phone, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Enviada', $10, $11)
          RETURNING id`,
          [client.id, leadId, payload.service_type, payload.description, payload.urgency, payload.documents, payload.city, payload.email, payload.phone, now, now], function (requestErr) {
          if (requestErr) return res.status(500).json({ error: 'No fue posible guardar la solicitud.' });
          createClientNotification(client.id, 'Servicios', 'Solicitud enviada', `Recibimos tu solicitud de ${payload.service_type}.`);
          sendNotificationEmail('Nueva solicitud de servicio desde portal cliente', `
            <h2>Nueva solicitud de servicio legal</h2>
            <p><strong>Cliente:</strong> ${escapeHtml(client.name || req.user.full_name)}</p>
            <p><strong>Servicio:</strong> ${escapeHtml(payload.service_type)}</p>
            <p><strong>Urgencia:</strong> ${escapeHtml(payload.urgency)}</p>
            <p>${escapeHtml(payload.description)}</p>
            ${payload.documents ? `<p><strong>Documento inicial:</strong> ${escapeHtml(payload.documents)}</p>` : ''}
          `);
          res.status(201).json({
            id: this.lastID,
            lead_id: leadId,
            client_id: client.id,
            ...payload,
            status: 'Enviada',
            created_at: now,
            updated_at: now
          });
        });
      });
  });
});

app.post('/api/client/notifications/:id/read', requireAuth(['client']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Notificación inválida.' });
  pgGet(`SELECT id FROM clients WHERE email = $1 OR document_id = $2`, [req.user.email, req.user.document_id], (clientErr, client) => {
    if (clientErr) return res.status(500).json({ error: 'No fue posible validar tu perfil.' });
    if (!client) return res.status(404).json({ error: 'No encontramos tu perfil de cliente.' });
    pgRun(`UPDATE client_notifications SET is_read = 1 WHERE client_id = $1 AND id = $2`, [client.id, id], function (err) {
      if (err) return res.status(500).json({ error: 'No fue posible actualizar la notificación.' });
      res.json({ message: 'Notificación marcada como leída.' });
    });
  });
});

app.post('/api/client/notifications/read-all', requireAuth(['client']), (req, res) => {
  pgGet(`SELECT id FROM clients WHERE email = $1 OR document_id = $2`, [req.user.email, req.user.document_id], (clientErr, client) => {
    if (clientErr) return res.status(500).json({ error: 'No fue posible validar tu perfil.' });
    if (!client) return res.status(404).json({ error: 'No encontramos tu perfil de cliente.' });
    pgRun(`UPDATE client_notifications SET is_read = 1 WHERE client_id = $1`, [client.id], function (err) {
      if (err) return res.status(500).json({ error: 'No fue posible actualizar notificaciones.' });
      res.json({ message: 'Notificaciones marcadas como leídas.' });
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

      pgAll(`SELECT r.*, c.amount AS commission_amount, c.status AS commission_status
        FROM referrals r
        LEFT JOIN commissions c ON c.referral_id = r.id AND c.ally_id = $1 AND c.commission_type = 'direct'
        WHERE r.ally_id = $2
        ORDER BY r.created_at DESC`, [req.user.id, req.user.id], (refErr, directReferrals) => {
        if (refErr) return res.status(500).json({ error: 'Error al cargar tus referidos.' });

        pgAll(`SELECT p.user_id, p.city, p.referral_code, p.created_at, u.full_name, u.status,
            COUNT(r.id) AS referrals_count,
            COALESCE(SUM(c.amount), 0) AS generated_commissions
          FROM partners p
          JOIN users u ON u.id = p.user_id
          LEFT JOIN referrals r ON r.ally_id = p.user_id
          LEFT JOIN commissions c ON c.source_ally_id = p.user_id AND c.ally_id = $1
          WHERE p.invited_by_partner_id = $2
          GROUP BY p.user_id, p.city, p.referral_code, p.created_at, u.full_name, u.status
          ORDER BY p.user_id DESC`, [req.user.id, req.user.id], (teamErr, team) => {
          if (teamErr) return res.status(500).json({ error: 'Error al cargar tu equipo.' });

          pgAll(`SELECT r.id, r.ally_id AS source_ally_id, r.referred_full_name, r.legal_area, r.status, r.created_at,
              u.full_name AS source_ally_name, c.amount AS commission_amount, c.status AS commission_status
            FROM referrals r
            JOIN users u ON u.id = r.ally_id
            JOIN partners p ON p.user_id = r.ally_id
            LEFT JOIN commissions c ON c.referral_id = r.id AND c.ally_id = $1
            WHERE p.invited_by_partner_id = $2
            ORDER BY r.created_at DESC`, [req.user.id, req.user.id], (networkErr, networkReferrals) => {
            if (networkErr) return res.status(500).json({ error: 'Error al cargar referidos de tu red.' });

            pgAll(`SELECT c.*, r.referred_full_name, r.legal_area, u.full_name AS source_ally_name
              FROM commissions c
              JOIN referrals r ON r.id = c.referral_id
              JOIN users u ON u.id = c.source_ally_id
              WHERE c.ally_id = $1
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

  pgGet(`SELECT id FROM referrals WHERE client_identification = $1 OR referred_phone = $2 OR referred_email = $3`, [payload.client_identification, payload.client_phone, payload.client_email], (dupErr, duplicate) => {
    if (dupErr) return res.status(500).json({ error: 'Error al validar duplicados.' });
    if (duplicate) return res.status(409).json({ error: 'Este referido ya existe por cedula, telefono o correo.' });

    const createdAt = getTimestamp();
    pgRun(`INSERT INTO referrals (ally_id, referred_full_name, client_identification, referred_phone, referred_email, referred_city, legal_area, case_description, referral_channel, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Nuevo referido', $10, $11)
      RETURNING id`,
      [req.user.id, payload.client_name, payload.client_identification, payload.client_phone, payload.client_email, payload.city, payload.legal_area, payload.description, payload.referral_channel, createdAt, createdAt], function (insertErr) {
      if (insertErr) return res.status(500).json({ error: 'No fue posible guardar el referido.' });
      const referralId = this.lastID;
      createCommissionRows(referralId, req.user.id, (commissionErr) => {
        if (commissionErr) console.error(commissionErr);
        res.status(201).json({ message: 'Referido enviado correctamente. Quedo asociado a tu cuenta de aliado.', id: referralId });
      });
    });
  });
});

app.get('/api/partner/advanced', requireAuth(['ally']), (req, res) => {
  const allyId = req.user.id;
  const month = currentMonthKey();
  const response = {};

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

    pgAll(`SELECT * FROM ally_resources WHERE is_active = 1 ORDER BY resource_type, title`, (resourceErr, resources) => {
      if (resourceErr) return res.status(500).json({ error: 'Error al cargar recursos.' });
      response.resources = resources;

      pgAll(`SELECT * FROM ally_notifications WHERE ally_id = $1 ORDER BY created_at DESC`, [allyId], (notificationErr, notifications) => {
        if (notificationErr) return res.status(500).json({ error: 'Error al cargar notificaciones.' });
        response.notifications = notifications;

        pgAll(`SELECT m.*, COALESCE(p.status, 'pendiente') AS progress_status, COALESCE(p.progress, 0) AS progress
          FROM ally_academy_modules m
          LEFT JOIN ally_academy_progress p ON p.module_id = m.id AND p.ally_id = $1
          WHERE m.is_active = 1
          ORDER BY m.sort_order`, [allyId], (academyErr, academy) => {
          if (academyErr) return res.status(500).json({ error: 'Error al cargar academia.' });
          response.academy = academy;

          pgGet(`SELECT * FROM ally_kyc_verifications WHERE ally_id = $1`, [allyId], (kycErr, kyc) => {
            if (kycErr) return res.status(500).json({ error: 'Error al cargar verificacion.' });
            response.kyc = kyc || { status: 'Sin verificar', phone_validated: 0, email_validated: 0 };

            pgAll(`SELECT * FROM ally_legal_acceptances WHERE ally_id = $1 ORDER BY document_type`, [allyId], (legalErr, legalDocuments) => {
              if (legalErr) return res.status(500).json({ error: 'Error al cargar documentos legales.' });
              response.legal_documents = legalDocuments;

              pgGet(`SELECT * FROM ally_goals WHERE (ally_id = $1 OR ally_id IS NULL) AND month = $2 AND is_active = 1 ORDER BY ally_id DESC LIMIT 1`, [allyId, month], (goalErr, goal) => {
                if (goalErr) return res.status(500).json({ error: 'Error al cargar metas.' });
                const activeGoal = goal || { month, referral_goal: 5, converted_goal: 1, commission_goal: 500000 };

                pgAll(`SELECT r.status, r.created_at FROM referrals r WHERE r.ally_id = $1`, [allyId], (refErr, refs) => {
                  if (refErr) return res.status(500).json({ error: 'Error al cargar referidos.' });
                  pgAll(`SELECT commission_type, amount, status, created_at FROM commissions WHERE ally_id = $1`, [allyId], (commErr, commissions) => {
                    if (commErr) return res.status(500).json({ error: 'Error al cargar comisiones.' });
                    pgAll(`SELECT * FROM ally_levels WHERE is_active = 1 ORDER BY sort_order`, (levelErr, levels) => {
                      if (levelErr) return res.status(500).json({ error: 'Error al cargar niveles.' });

                      const converted = refs.filter((item) => ['Cliente activo', 'Cliente vinculado', 'won'].includes(item.status)).length;
                      const totalCommissions = commissions.reduce((sum, item) => sum + money(item.amount), 0);
                      pgAll(`SELECT user_id FROM partners WHERE invited_by_partner_id = $1`, [allyId], (teamErr, team) => {
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

app.post('/api/partner/notifications/:id/read', requireAuth(['ally']), (req, res) => {
  pgRun(`UPDATE ally_notifications SET is_read = 1 WHERE ally_id = $1 AND id = $2`, [req.user.id, parseInt(req.params.id, 10)], () => {
    res.json({ message: 'Notificacion marcada como leida.' });
  });
});

app.post('/api/partner/notifications/read-all', requireAuth(['ally']), (req, res) => {
  pgRun(`UPDATE ally_notifications SET is_read = 1 WHERE ally_id = $1`, [req.user.id], () => {
    res.json({ message: 'Notificaciones marcadas como leidas.' });
  });
});

app.post('/api/partner/legal-acceptances', requireAuth(['ally']), (req, res) => {
  const documentType = cleanText(req.body.document_type, 80);
  const version = cleanText(req.body.version || 'v1.0', 20);
  if (!documentType) return res.status(400).json({ error: 'Tipo de documento obligatorio.' });
  pgRun(`INSERT INTO ally_legal_acceptances (ally_id, document_type, accepted_at, ip_address, version, status)
    VALUES ($1, $2, $3, $4, $5, 'accepted')
    RETURNING id`, [req.user.id, documentType, getTimestamp(), req.ip || '', version], function (err) {
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
  pgRun(`INSERT INTO ally_electronic_signatures (ally_id, document_type, full_name, document_number, version, signed_at, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'accepted')
    RETURNING id`, [req.user.id, payload.document_type, payload.full_name, payload.document_number, payload.version, getTimestamp()], function (err) {
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
  pgRun(`UPDATE partners SET phone = $1, city = $2, partner_type = $3, company = $4, occupation = $5,
      bank_name = COALESCE(NULLIF($6, ''), bank_name),
      account_type = COALESCE(NULLIF($7, ''), account_type),
      account_number = COALESCE(NULLIF($8, ''), account_number),
      updated_at = $9
    WHERE user_id = $10`,
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
  pgRun(`INSERT INTO ally_academy_progress (ally_id, module_id, status, progress, updated_at)
      VALUES ($1, $2, 'completado', 100, $3)
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
  pgRun(`INSERT INTO ally_kyc_verifications (ally_id, front_document_url, back_document_url, selfie_url, bank_name, account_type, account_number, status, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'En revision', $8)
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

  pgAll(`SELECT id, role FROM users WHERE email = $1`, [payload.email], (roleErr, existingUsers) => {
    if (roleErr) return res.status(500).json({ error: 'Error al validar usuario.' });
    const roleError = validateEmailRoleAvailability(existingUsers, payload.email, 'ally');
    if (roleError) return res.status(409).json({ error: roleError });

  pgGet(`SELECT user_id FROM partners WHERE document_id = $1 OR phone = $2`, [payload.document_id, payload.phone], (dupErr, duplicate) => {
    if (dupErr) return res.status(500).json({ error: 'Error al validar duplicados.' });
    if (duplicate) return res.status(409).json({ error: 'Ya existe un aliado con esa cedula o telefono.' });

    const createdAt = getTimestamp();
    const tempPassword = crypto.randomBytes(10).toString('hex');
    pgRun(`INSERT INTO users (full_name, email, password_hash, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, 'ally', 'pending', $4, $5)
      RETURNING id`, [payload.full_name, payload.email, hashPassword(tempPassword), createdAt, createdAt], function (userErr) {
      if (userErr) return res.status(500).json({ error: 'No fue posible crear la invitacion.' });
      const invitedUserId = this.lastID;
      pgRun(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, occupation, referral_code, invited_by_partner_id, commission_balance)
        VALUES ($1, $2, $3, $4, 'Invitado', $5, $6, $7, 0)`, [invitedUserId, payload.document_id, payload.phone, payload.city, payload.occupation, generateReferralCode(payload.full_name, payload.document_id), req.user.id], (partnerErr) => {
        if (partnerErr) return res.status(500).json({ error: 'No fue posible asociar el aliado invitado.' });
        sendNotificationEmail('Nuevo aliado invitado', `<p>${escapeHtml(req.user.full_name)} invito a ${escapeHtml(payload.full_name)} (${escapeHtml(payload.email)}).</p>`);
        createAdminNotification({
          notification_type: 'new_ally',
          title: 'Nuevo aliado invitado',
          description: `${req.user.full_name} invitó a ${payload.full_name} a la red de aliados. Ciudad: ${payload.city}.`,
          entity_type: 'ally',
          entity_id: invitedUserId,
          contact_name: payload.full_name,
          contact_phone: payload.phone,
          contact_email: payload.email,
          whatsapp_message: `Hola ${payload.full_name}, te contactamos de Orjuela Abogados para confirmar tu invitación al programa de aliados.`
        });
        res.status(201).json({ message: 'Invitacion registrada correctamente. El nuevo aliado quedo asociado a tu red.' });
      });
    });
  });
});

app.get('/api/admin/partner-network', requireAuth(['admin', 'abogado', 'asistente']), async (req, res) => {
  try {
    const [
      usersResult,
      partnersResult,
      legacyAlliesResult,
      referralsResult,
      leadsResult,
      commissionsResult,
      settingsResult,
      resourcesResult,
      kycResult,
      goalsResult
    ] = await Promise.all([
      pool.query(`SELECT id, full_name, document_id, email, status, created_at FROM users WHERE role = 'ally' ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM partners`),
      pool.query(`SELECT * FROM allies ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM referrals ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM leads WHERE referrer_id IS NOT NULL ORDER BY created_at DESC`),
      pool.query(`SELECT c.*, receiver.full_name AS ally_name, source.full_name AS source_ally_name, r.referred_full_name
        FROM commissions c
        LEFT JOIN users receiver ON receiver.id = c.ally_id
        LEFT JOIN users source ON source.id = c.source_ally_id
        LEFT JOIN referrals r ON r.id = c.referral_id
        ORDER BY c.created_at DESC`),
      pool.query(`SELECT direct_percentage, level_1_percentage, level_2_percentage FROM commission_settings WHERE is_active = 1 ORDER BY id DESC LIMIT 1`),
      pool.query(`SELECT * FROM ally_resources WHERE is_active = 1 ORDER BY resource_type`),
      pool.query(`SELECT k.*, u.full_name FROM ally_kyc_verifications k JOIN users u ON u.id = k.ally_id ORDER BY k.updated_at DESC`),
      pool.query(`SELECT * FROM ally_goals WHERE is_active = 1 ORDER BY updated_at DESC`)
    ]);

    const users = usersResult.rows || [];
    const partners = partnersResult.rows || [];
    const legacyAllies = legacyAlliesResult.rows || [];
    const referrals = referralsResult.rows || [];
    const leads = leadsResult.rows || [];
    const commissions = commissionsResult.rows || [];
    const userById = new Map(users.map((user) => [Number(user.id), user]));
    const partnerByUserId = new Map(partners.map((partner) => [Number(partner.user_id), partner]));
    const legacyById = new Map(legacyAllies.map((ally) => [Number(ally.id), ally]));
    const legacyByEmail = new Map(legacyAllies.map((ally) => [normalizeEmail(ally.email), ally]));
    const legacyByDocument = new Map(legacyAllies.map((ally) => [normalizeDocument(ally.document_number), ally]));
    const resolveAllyName = (allyId) => {
      const numericId = Number(allyId);
      const user = userById.get(numericId);
      if (user) return user.full_name;
      return legacyById.get(numericId)?.full_name || 'Aliado no identificado';
    };
    const resolveLegacyForUser = (user) => legacyByEmail.get(normalizeEmail(user.email)) || legacyByDocument.get(normalizeDocument(user.document_id));
    const referralBelongsToUser = (referral, user, legacy) => Number(referral.ally_id) === Number(user.id) || (legacy && Number(referral.ally_id) === Number(legacy.id));

    const allies = users.map((user) => {
      const partner = partnerByUserId.get(Number(user.id)) || {};
      const legacy = resolveLegacyForUser(user) || {};
      const userReferrals = referrals.filter((referral) => referralBelongsToUser(referral, user, legacy));
      const userCommissions = commissions.filter((commission) => Number(commission.ally_id) === Number(user.id));
      return {
        user_id: user.id,
        document_id: partner.document_id || user.document_id || legacy.document_number || '',
        phone: partner.phone || legacy.phone || '',
        city: partner.city || legacy.city || '',
        occupation: partner.occupation || partner.partner_type || legacy.ally_type || '',
        referral_code: partner.referral_code || '',
        commission_percentage: partner.commission_percentage ?? 10,
        invited_by_partner_id: partner.invited_by_partner_id || null,
        full_name: user.full_name,
        email: user.email,
        status: user.status || legacy.status || 'active',
        invited_by_name: partner.invited_by_partner_id ? resolveAllyName(partner.invited_by_partner_id) : 'Principal',
        referrals_count: userReferrals.length,
        commissions_total: userCommissions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        created_at: user.created_at || partner.created_at || legacy.created_at,
        legacy_only: 0
      };
    });

    legacyAllies.forEach((legacy) => {
      const linkedUser = users.find((user) => normalizeEmail(user.email) === normalizeEmail(legacy.email) || normalizeDocument(user.document_id) === normalizeDocument(legacy.document_number));
      if (linkedUser) return;
      const legacyReferrals = referrals.filter((referral) => Number(referral.ally_id) === Number(legacy.id));
      allies.push({
        user_id: -Number(legacy.id),
        document_id: legacy.document_number,
        phone: legacy.phone,
        city: legacy.city,
        occupation: legacy.ally_type,
        referral_code: '',
        commission_percentage: 10,
        invited_by_partner_id: null,
        full_name: legacy.full_name,
        email: legacy.email,
        status: legacy.status,
        invited_by_name: 'Principal',
        referrals_count: legacyReferrals.length,
        commissions_total: 0,
        created_at: legacy.created_at,
        legacy_only: 1
      });
    });

    const referralsRows = referrals.map((referral) => ({
      ...referral,
      source_kind: 'referral',
      referred_at: referral.created_at,
      city: referral.referred_city,
      ally_name: resolveAllyName(referral.ally_id)
    })).concat(leads.map((lead) => ({
      id: lead.id,
      source_kind: 'lead',
      ally_id: lead.referrer_id,
      referred_full_name: lead.name,
      client_identification: '',
      referred_phone: lead.phone,
      referred_email: lead.email,
      referred_city: '',
      legal_area: lead.case_type,
      case_description: lead.notes,
      referral_channel: lead.source,
      urgency: lead.priority,
      file_notes: '',
      status: lead.status,
      created_at: lead.created_at,
      updated_at: lead.updated_at,
      referred_at: lead.created_at,
      city: '',
      ally_name: resolveAllyName(lead.referrer_id)
    }))).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    allies.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    res.json({
      allies,
      referrals: referralsRows,
      commissions,
      settings: settingsResult.rows?.[0] || { direct_percentage: 10, level_1_percentage: 3, level_2_percentage: 1 },
      resources: resourcesResult.rows || [],
      kyc: kycResult.rows || [],
      goals: goalsResult.rows || []
    });
  } catch (err) {
    console.error('[admin/partner-network] load failed:', err);
    res.status(500).json({ error: 'Error al cargar red de aliados.' });
  }
});

app.patch('/api/admin/network-referrals/:id/status', requireAuth(['admin', 'abogado', 'asistente']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = cleanText(req.body.status, 40);
  if (!id || !NETWORK_REFERRAL_STATUSES.includes(status)) return res.status(400).json({ error: 'Estado no valido.' });
  const updatedAt = getTimestamp();
  pgRun(`UPDATE referrals SET status = $1, updated_at = $2 WHERE id = $3`, [status, updatedAt, id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar el referido.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Referido no encontrado.' });

    if (status !== 'Cliente vinculado') {
      return res.json({ message: 'Estado actualizado correctamente.' });
    }

    pgGet(`SELECT r.*, u.full_name AS ally_name, u.email AS ally_email
      FROM referrals r
      JOIN users u ON u.id = r.ally_id
      WHERE r.id = $1`, [id], (refErr, referral) => {
      if (refErr || !referral) return res.json({ message: 'Estado actualizado correctamente, pero no fue posible cargar datos para notificar.' });

      const registerUrl = `${getBaseUrl(req)}/clientes/registro`;
      const referredName = referral.referred_full_name || 'cliente';
      const emailSent = sendTransactionalEmail(referral.referred_email, 'Crea tu cuenta de cliente en Orjuela Abogados', `
        <h2>Tu proceso ya puede continuar como cliente</h2>
        <p>Hola ${escapeHtml(referredName)},</p>
        <p>Orjuela Abogados y Asociados confirmó tu vinculación como cliente. Crea tu cuenta para consultar el seguimiento, documentos, pagos y mensajes de tu proceso.</p>
        <p><a href="${escapeHtml(registerUrl)}">Crear cuenta de cliente</a></p>
        <p>Si el botón no funciona, copia este enlace:</p>
        <p>${escapeHtml(registerUrl)}</p>
      `);

      const whatsappMessage = `Hola ${referredName}, te contactamos de Orjuela Abogados. Tu proceso ya fue vinculado como cliente. Crea tu cuenta aquí: ${registerUrl}`;
      const whatsappUrl = whatsappLink(referral.referred_phone, whatsappMessage);

      createAdminNotification({
        notification_type: 'client_invite',
        title: 'Enviar acceso de cliente al referido',
        description: `${referredName} fue marcado como Cliente vinculado. Usa WhatsApp o correo para enviarle el enlace de registro.`,
        entity_type: 'referral',
        entity_id: referral.id,
        contact_name: referredName,
        contact_phone: referral.referred_phone,
        contact_email: referral.referred_email,
        whatsapp_message: whatsappMessage
      });

      pgRun(`UPDATE commissions SET status = 'approved' WHERE referral_id = $1 AND status = 'pending'`, [id], (commissionErr) => {
        if (commissionErr) console.error('[commissions] No fue posible aprobar comisiones:', commissionErr);
        createAllyNotification(
          referral.ally_id,
          'Comision aprobada',
          'Referido convertido en cliente',
          `${referredName} ya fue marcado como cliente vinculado. Tu comisión quedó aprobada y pendiente de pago.`
        );
        res.json({
          message: emailSent
            ? 'Referido marcado como cliente. Se notificó al aliado y se envió correo de registro al referido.'
            : 'Referido marcado como cliente. Se notificó al aliado y quedó lista la acción de contacto por WhatsApp/correo.',
          whatsapp_url: whatsappUrl,
          register_url: registerUrl
        });
      });
    });
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
    commission_percentage: Number(req.body.commission_percentage ?? 10),
    status: cleanText(req.body.status || 'active', 20)
  };
  if (!payload.full_name || !payload.email || !payload.phone || !payload.city) return res.status(400).json({ error: 'Nombre, correo, teléfono y ciudad son obligatorios.' });
  if (!isValidEmail(payload.email)) return res.status(400).json({ error: 'Correo inválido.' });
  if (Number.isNaN(payload.commission_percentage) || payload.commission_percentage < 0 || payload.commission_percentage > 100) return res.status(400).json({ error: 'Porcentaje de comisión no válido.' });
  const now = getTimestamp();
  const password = hashPassword(`Aliado${crypto.randomInt(1000, 9999)}!`);
  pgAll(`SELECT id, role FROM users WHERE email = $1`, [payload.email], (roleErr, existingUsers) => {
    if (roleErr) return res.status(500).json({ error: 'No fue posible validar el correo.' });
    const roleError = validateEmailRoleAvailability(existingUsers, payload.email, 'ally');
    if (roleError) return res.status(409).json({ error: roleError });

    pgRun(`INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'ally', $5, $6, $7)
      RETURNING id`, [payload.full_name, payload.document_id, payload.email, password, payload.status, now, now], function (userErr) {
      if (userErr) return res.status(500).json({ error: 'No fue posible crear el usuario aliado.' });
      const userId = this.lastID;
      pgRun(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, occupation, referral_code, commission_percentage, commission_balance, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10)`, [userId, payload.document_id, payload.phone, payload.city, payload.partner_type, payload.occupation, generateReferralCode(payload.full_name, payload.document_id), payload.commission_percentage, now, now], function (partnerErr) {
        if (partnerErr) return res.status(500).json({ error: 'No fue posible crear aliado.' });
        auditAdminAction(req, 'crear', 'aliado', userId, payload.full_name);
        res.status(201).json({ message: 'Aliado creado.', user_id: userId });
      });
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
    commission_percentage: req.body.commission_percentage === undefined ? null : Number(req.body.commission_percentage),
    status: cleanText(req.body.status, 20)
  };
  if (payload.commission_percentage !== null && (Number.isNaN(payload.commission_percentage) || payload.commission_percentage < 0 || payload.commission_percentage > 100)) return res.status(400).json({ error: 'Porcentaje de comisión no válido.' });
  pgRun(`UPDATE users SET full_name = COALESCE(NULLIF($1, ''), full_name), status = COALESCE(NULLIF($2, ''), status), updated_at = $3 WHERE id = $4 AND role = 'ally'`,
    [payload.full_name, payload.status, getTimestamp(), id], function (userErr) {
    if (userErr) return res.status(500).json({ error: 'No fue posible actualizar aliado.' });
    pgRun(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, occupation, referral_code, commission_percentage, commission_balance, created_at, updated_at)
      SELECT u.id, COALESCE(NULLIF(u.document_id, ''), $1), $2, $3, COALESCE(NULLIF($4, ''), 'Independiente'), $5, $6, COALESCE($7, 10), 0, $8, $9
      FROM users u
      WHERE u.id = $10 AND u.role = 'ally'
      ON CONFLICT (user_id) DO UPDATE SET
        phone = COALESCE(NULLIF(excluded.phone, ''), partners.phone),
        city = COALESCE(NULLIF(excluded.city, ''), partners.city),
        partner_type = COALESCE(NULLIF(excluded.partner_type, ''), partners.partner_type),
        occupation = COALESCE(NULLIF(excluded.occupation, ''), partners.occupation),
        commission_percentage = COALESCE(excluded.commission_percentage, partners.commission_percentage),
        updated_at = excluded.updated_at`,
      [`ALLY-${id}`, payload.phone, payload.city, payload.partner_type, payload.occupation, generateReferralCode(payload.full_name || 'ALIADO', String(id)), payload.commission_percentage, getTimestamp(), getTimestamp(), id], (partnerErr) => {
      if (partnerErr) return res.status(500).json({ error: 'No fue posible actualizar perfil de aliado.' });
      auditAdminAction(req, 'actualizar', 'aliado', id, payload.full_name || 'Aliado actualizado');
      res.json({ message: 'Aliado actualizado.' });
    });
  });
});

app.delete('/api/admin/partner-network/allies/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Aliado inválido.' });
  pgRun(`UPDATE users SET status = 'archived', updated_at = $1 WHERE id = $2 AND role = 'ally'`, [getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar aliado.' });
    auditAdminAction(req, 'archivar', 'aliado', id, 'Aliado archivado');
    res.json({ message: 'Aliado archivado.' });
  });
});

app.delete('/api/admin/partner-network/allies/:id/permanent', requireAuth(['admin']), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Aliado inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const allyResult = await client.query(`
      SELECT u.id, u.full_name, u.email, u.document_id, p.referral_code
      FROM users u
      LEFT JOIN partners p ON p.user_id = u.id
      WHERE u.id = $1 AND u.role = 'ally'`, [id]);
    const ally = allyResult.rows[0];
    if (!ally) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aliado no encontrado.' });
    }

    await client.query(`DELETE FROM ally_academy_progress WHERE ally_id = $1`, [id]);
    await client.query(`DELETE FROM ally_fraud_alerts WHERE ally_id = $1 OR referral_id IN (SELECT id FROM referrals WHERE ally_id = $1)`, [id]);
    await client.query(`DELETE FROM ally_electronic_signatures WHERE ally_id = $1`, [id]);
    await client.query(`DELETE FROM ally_kyc_verifications WHERE ally_id = $1`, [id]);
    await client.query(`DELETE FROM ally_legal_acceptances WHERE ally_id = $1`, [id]);
    await client.query(`DELETE FROM ally_notifications WHERE ally_id = $1`, [id]);
    await client.query(`DELETE FROM ally_activity_logs WHERE ally_id = $1`, [id]);
    await client.query(`DELETE FROM ally_goals WHERE ally_id = $1`, [id]);
    await client.query(`DELETE FROM commissions WHERE ally_id = $1 OR source_ally_id = $1 OR referral_id IN (SELECT id FROM referrals WHERE ally_id = $1)`, [id]);
    await client.query(`DELETE FROM referral_status_history WHERE referral_id IN (SELECT id FROM referrals WHERE ally_id = $1)`, [id]);
    await client.query(`DELETE FROM referrals WHERE ally_id = $1`, [id]);
    await client.query(`UPDATE partners SET invited_by_partner_id = NULL WHERE invited_by_partner_id = $1`, [id]);
    await client.query(`DELETE FROM partners WHERE user_id = $1`, [id]);
    await client.query(`DELETE FROM allies WHERE ($1 <> '' AND email = $1) OR ($2 <> '' AND document_number = $2)`, [ally.email || '', ally.document_id || '']);
    await client.query(`DELETE FROM admin_notifications WHERE entity_type IN ('ally', 'partner') AND entity_id = $1`, [id]);
    await client.query(`UPDATE client_messages SET sender_id = NULL WHERE sender_id = $1`, [id]);
    await client.query(`DELETE FROM users WHERE id = $1 AND role = 'ally'`, [id]);

    await client.query('COMMIT');
    auditAdminAction(req, 'eliminar', 'aliado', id, ally.full_name || 'Aliado eliminado');
    res.json({ message: 'Aliado eliminado permanentemente.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin/allies/permanent] delete failed:', err);
    res.status(500).json({ error: 'No fue posible eliminar el aliado.' });
  } finally {
    client.release();
  }
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
    ? `UPDATE commissions SET status = $1, amount = $2, paid_at = $3 WHERE id = $4`
    : `UPDATE commissions SET status = $1, paid_at = $2 WHERE id = $3`;
  pgRun(sql, params, function (err) {
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
  pgRun(`UPDATE commission_settings SET is_active = 0 WHERE is_active = 1`);
  pgRun(`INSERT INTO commission_settings (direct_percentage, level_1_percentage, level_2_percentage, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, 1, $4, $5)
    RETURNING id`, [direct, level1, level2, now, now], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible guardar la configuracion.' });
    res.json({ message: 'Configuracion actualizada.', id: this.lastID });
  });
});

app.post('/api/admin/partner-network/levels', requireAuth(['admin']), (req, res) => {
  const payload = {
    name: cleanText(req.body.name, 80),
    min_converted_referrals: parseInt(req.body.min_converted_referrals, 10),
    min_commissions: Number(req.body.min_commissions),
    min_active_allies: parseInt(req.body.min_active_allies, 10),
    benefits: cleanText(req.body.benefits, 500),
    sort_order: parseInt(req.body.sort_order, 10) || 1
  };
  if (!payload.name || [payload.min_converted_referrals, payload.min_commissions, payload.min_active_allies].some((value) => Number.isNaN(value) || value < 0)) {
    return res.status(400).json({ error: 'Completa los requisitos del nivel con valores válidos.' });
  }
  pgRun(`INSERT INTO ally_levels (name, min_converted_referrals, min_commissions, min_active_allies, benefits, sort_order, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, 1)
    RETURNING id`, [payload.name, payload.min_converted_referrals, payload.min_commissions, payload.min_active_allies, payload.benefits, payload.sort_order], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear el nivel.' });
    auditAdminAction(req, 'crear', 'nivel_aliado', this.lastID, payload.name);
    res.status(201).json({ id: this.lastID, ...payload, is_active: 1 });
  });
});

app.patch('/api/admin/partner-network/levels/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const payload = {
    name: cleanText(req.body.name, 80),
    min_converted_referrals: req.body.min_converted_referrals === undefined ? null : parseInt(req.body.min_converted_referrals, 10),
    min_commissions: req.body.min_commissions === undefined ? null : Number(req.body.min_commissions),
    min_active_allies: req.body.min_active_allies === undefined ? null : parseInt(req.body.min_active_allies, 10),
    benefits: cleanText(req.body.benefits, 500),
    sort_order: req.body.sort_order === undefined ? null : parseInt(req.body.sort_order, 10)
  };
  if (!id) return res.status(400).json({ error: 'Nivel inválido.' });
  pgRun(`UPDATE ally_levels SET
      name = COALESCE(NULLIF($1, ''), name),
      min_converted_referrals = COALESCE($2, min_converted_referrals),
      min_commissions = COALESCE($3, min_commissions),
      min_active_allies = COALESCE($4, min_active_allies),
      benefits = COALESCE(NULLIF($5, ''), benefits),
      sort_order = COALESCE($6, sort_order)
    WHERE id = $7`, [
    payload.name,
    payload.min_converted_referrals !== null && !Number.isNaN(payload.min_converted_referrals) ? payload.min_converted_referrals : null,
    payload.min_commissions !== null && !Number.isNaN(payload.min_commissions) ? payload.min_commissions : null,
    payload.min_active_allies !== null && !Number.isNaN(payload.min_active_allies) ? payload.min_active_allies : null,
    payload.benefits,
    payload.sort_order !== null && !Number.isNaN(payload.sort_order) ? payload.sort_order : null,
    id
  ], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar el nivel.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Nivel no encontrado.' });
    auditAdminAction(req, 'actualizar', 'nivel_aliado', id, payload.name || 'Nivel actualizado');
    res.json({ message: 'Nivel actualizado.' });
  });
});

app.delete('/api/admin/partner-network/levels/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Nivel inválido.' });
  pgRun(`UPDATE ally_levels SET is_active = 0 WHERE id = $1`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar el nivel.' });
    auditAdminAction(req, 'archivar', 'nivel_aliado', id, 'Nivel archivado');
    res.json({ message: 'Nivel archivado.' });
  });
});

app.post('/api/admin/partner-network/goals', requireAuth(['admin']), (req, res) => {
  const payload = {
    ally_id: req.body.ally_id ? parseInt(req.body.ally_id, 10) : null,
    month: cleanText(req.body.month, 20),
    referral_goal: parseInt(req.body.referral_goal, 10),
    converted_goal: parseInt(req.body.converted_goal, 10),
    commission_goal: Number(req.body.commission_goal)
  };
  if (!payload.month || [payload.referral_goal, payload.converted_goal, payload.commission_goal].some((value) => Number.isNaN(value) || value < 0)) {
    return res.status(400).json({ error: 'Completa la meta con valores válidos.' });
  }
  pgRun(`INSERT INTO ally_goals (ally_id, month, referral_goal, converted_goal, commission_goal, is_active, updated_at)
    VALUES ($1, $2, $3, $4, $5, 1, $6)
    RETURNING id`, [payload.ally_id, payload.month, payload.referral_goal, payload.converted_goal, payload.commission_goal, getTimestamp()], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear la meta.' });
    auditAdminAction(req, 'crear', 'meta_aliado', this.lastID, payload.month);
    res.status(201).json({ id: this.lastID, ...payload, is_active: 1 });
  });
});

app.patch('/api/admin/partner-network/goals/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const payload = {
    ally_id: req.body.ally_id === '' ? null : (req.body.ally_id === undefined ? undefined : parseInt(req.body.ally_id, 10)),
    month: cleanText(req.body.month, 20),
    referral_goal: req.body.referral_goal === undefined ? null : parseInt(req.body.referral_goal, 10),
    converted_goal: req.body.converted_goal === undefined ? null : parseInt(req.body.converted_goal, 10),
    commission_goal: req.body.commission_goal === undefined ? null : Number(req.body.commission_goal)
  };
  if (!id) return res.status(400).json({ error: 'Meta inválida.' });
  pgRun(`UPDATE ally_goals SET
      ally_id = CASE WHEN $1 = '__KEEP__' THEN ally_id ELSE $2 END,
      month = COALESCE(NULLIF($3, ''), month),
      referral_goal = COALESCE($4, referral_goal),
      converted_goal = COALESCE($5, converted_goal),
      commission_goal = COALESCE($6, commission_goal),
      updated_at = $7
    WHERE id = $8`, [
    payload.ally_id === undefined ? '__KEEP__' : '',
    payload.ally_id === undefined || Number.isNaN(payload.ally_id) ? null : payload.ally_id,
    payload.month,
    payload.referral_goal !== null && !Number.isNaN(payload.referral_goal) ? payload.referral_goal : null,
    payload.converted_goal !== null && !Number.isNaN(payload.converted_goal) ? payload.converted_goal : null,
    payload.commission_goal !== null && !Number.isNaN(payload.commission_goal) ? payload.commission_goal : null,
    getTimestamp(),
    id
  ], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar la meta.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Meta no encontrada.' });
    auditAdminAction(req, 'actualizar', 'meta_aliado', id, payload.month || 'Meta actualizada');
    res.json({ message: 'Meta actualizada.' });
  });
});

app.delete('/api/admin/partner-network/goals/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Meta inválida.' });
  pgRun(`UPDATE ally_goals SET is_active = 0, updated_at = $1 WHERE id = $2`, [getTimestamp(), id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar la meta.' });
    auditAdminAction(req, 'archivar', 'meta_aliado', id, 'Meta archivada');
    res.json({ message: 'Meta archivada.' });
  });
});

app.post('/api/admin/partner-network/resources', requireAuth(['admin']), (req, res) => {
  const payload = {
    title: cleanText(req.body.title, 140),
    resource_type: cleanText(req.body.resource_type || 'Mensaje', 60),
    description: cleanText(req.body.description, 500),
    url: cleanText(req.body.url, 220),
    content: cleanText(req.body.content, 2000)
  };
  if (!payload.title || !payload.resource_type) return res.status(400).json({ error: 'Título y tipo son obligatorios.' });
  pgRun(`INSERT INTO ally_resources (title, resource_type, description, url, content, is_active, created_at)
    VALUES ($1, $2, $3, $4, $5, 1, $6)
    RETURNING id`, [payload.title, payload.resource_type, payload.description, payload.url, payload.content, getTimestamp()], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear el recurso.' });
    auditAdminAction(req, 'crear', 'recurso_aliado', this.lastID, payload.title);
    res.status(201).json({ id: this.lastID, ...payload, is_active: 1 });
  });
});

app.patch('/api/admin/partner-network/resources/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Recurso inválido.' });
  pgRun(`UPDATE ally_resources SET
      title = COALESCE(NULLIF($1, ''), title),
      resource_type = COALESCE(NULLIF($2, ''), resource_type),
      description = COALESCE(NULLIF($3, ''), description),
      url = COALESCE(NULLIF($4, ''), url),
      content = COALESCE(NULLIF($5, ''), content)
    WHERE id = $6`, [
    cleanText(req.body.title, 140),
    cleanText(req.body.resource_type, 60),
    cleanText(req.body.description, 500),
    cleanText(req.body.url, 220),
    cleanText(req.body.content, 2000),
    id
  ], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar el recurso.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Recurso no encontrado.' });
    auditAdminAction(req, 'actualizar', 'recurso_aliado', id, cleanText(req.body.title, 140) || 'Recurso actualizado');
    res.json({ message: 'Recurso actualizado.' });
  });
});

app.delete('/api/admin/partner-network/resources/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Recurso inválido.' });
  pgRun(`UPDATE ally_resources SET is_active = 0 WHERE id = $1`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar el recurso.' });
    auditAdminAction(req, 'archivar', 'recurso_aliado', id, 'Recurso archivado');
    res.json({ message: 'Recurso archivado.' });
  });
});

app.post('/api/admin/partner-network/academy', requireAuth(['admin']), (req, res) => {
  const payload = {
    title: cleanText(req.body.title, 140),
    description: cleanText(req.body.description, 500),
    content: cleanText(req.body.content, 4000),
    video_url: cleanText(req.body.video_url, 220),
    sort_order: parseInt(req.body.sort_order, 10) || 1
  };
  if (!payload.title || !payload.description) return res.status(400).json({ error: 'Título y descripción son obligatorios.' });
  pgRun(`INSERT INTO ally_academy_modules (title, description, content, video_url, sort_order, is_active)
    VALUES ($1, $2, $3, $4, $5, 1)
    RETURNING id`, [payload.title, payload.description, payload.content, payload.video_url, payload.sort_order], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear el módulo.' });
    auditAdminAction(req, 'crear', 'academia_aliado', this.lastID, payload.title);
    res.status(201).json({ id: this.lastID, ...payload, is_active: 1 });
  });
});

app.patch('/api/admin/partner-network/academy/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sortOrder = req.body.sort_order === undefined ? null : parseInt(req.body.sort_order, 10);
  if (!id) return res.status(400).json({ error: 'Módulo inválido.' });
  pgRun(`UPDATE ally_academy_modules SET
      title = COALESCE(NULLIF($1, ''), title),
      description = COALESCE(NULLIF($2, ''), description),
      content = COALESCE(NULLIF($3, ''), content),
      video_url = COALESCE(NULLIF($4, ''), video_url),
      sort_order = COALESCE($5, sort_order)
    WHERE id = $6`, [
    cleanText(req.body.title, 140),
    cleanText(req.body.description, 500),
    cleanText(req.body.content, 4000),
    cleanText(req.body.video_url, 220),
    sortOrder !== null && !Number.isNaN(sortOrder) ? sortOrder : null,
    id
  ], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar el módulo.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Módulo no encontrado.' });
    auditAdminAction(req, 'actualizar', 'academia_aliado', id, cleanText(req.body.title, 140) || 'Módulo actualizado');
    res.json({ message: 'Módulo actualizado.' });
  });
});

app.delete('/api/admin/partner-network/academy/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Módulo inválido.' });
  pgRun(`UPDATE ally_academy_modules SET is_active = 0 WHERE id = $1`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar el módulo.' });
    auditAdminAction(req, 'archivar', 'academia_aliado', id, 'Módulo archivado');
    res.json({ message: 'Módulo archivado.' });
  });
});

app.post('/api/admin/partner-network/fraud-alerts', requireAuth(['admin']), (req, res) => {
  const payload = {
    ally_id: req.body.ally_id ? parseInt(req.body.ally_id, 10) : null,
    referral_id: req.body.referral_id ? parseInt(req.body.referral_id, 10) : null,
    risk_level: cleanText(req.body.risk_level || 'Medio', 20),
    alert_type: cleanText(req.body.alert_type || 'Revisión manual', 80),
    description: cleanText(req.body.description, 700),
    status: cleanText(req.body.status || 'open', 30)
  };
  if (!payload.alert_type || !payload.description) return res.status(400).json({ error: 'Tipo y descripción son obligatorios.' });
  pgRun(`INSERT INTO ally_fraud_alerts (ally_id, referral_id, risk_level, alert_type, description, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`, [payload.ally_id, payload.referral_id, payload.risk_level, payload.alert_type, payload.description, payload.status, getTimestamp()], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible crear la alerta.' });
    auditAdminAction(req, 'crear', 'alerta_antifraude', this.lastID, payload.alert_type);
    res.status(201).json({ id: this.lastID, ...payload });
  });
});

app.patch('/api/admin/partner-network/fraud-alerts/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Alerta inválida.' });
  pgRun(`UPDATE ally_fraud_alerts SET
      risk_level = COALESCE(NULLIF($1, ''), risk_level),
      alert_type = COALESCE(NULLIF($2, ''), alert_type),
      description = COALESCE(NULLIF($3, ''), description),
      status = COALESCE(NULLIF($4, ''), status)
    WHERE id = $5`, [
    cleanText(req.body.risk_level, 20),
    cleanText(req.body.alert_type, 80),
    cleanText(req.body.description, 700),
    cleanText(req.body.status, 30),
    id
  ], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible actualizar la alerta.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Alerta no encontrada.' });
    auditAdminAction(req, 'actualizar', 'alerta_antifraude', id, cleanText(req.body.alert_type, 80) || 'Alerta actualizada');
    res.json({ message: 'Alerta actualizada.' });
  });
});

app.delete('/api/admin/partner-network/fraud-alerts/:id', requireAuth(['admin']), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Alerta inválida.' });
  pgRun(`UPDATE ally_fraud_alerts SET status = 'archived' WHERE id = $1`, [id], function (err) {
    if (err) return res.status(500).json({ error: 'No fue posible archivar la alerta.' });
    auditAdminAction(req, 'archivar', 'alerta_antifraude', id, 'Alerta archivada');
    res.json({ message: 'Alerta archivada.' });
  });
});

app.post('/api/auth/recovery/request', (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Ingresa un correo válido.' });

  pgGet(`SELECT id, full_name, email, role, status FROM users WHERE email = $1`, [email], (selectErr, user) => {
    if (selectErr) return res.status(500).json({ error: 'No fue posible procesar la solicitud.' });
    if (!user || user.status !== 'active') {
      return res.json({ message: 'Si el correo existe, enviaremos instrucciones para recuperar el acceso.' });
    }

    const rawCode = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawCode).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
    const resetUrl = `${getBaseUrl(req)}/restablecer-contrasena?codigo=${encodeURIComponent(rawCode)}`;

    pgRun(`UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2, updated_at = $3 WHERE id = $4`, [tokenHash, expiresAt, getTimestamp(), user.id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: 'No fue posible procesar la solicitud.' });

      const sent = sendTransactionalEmail(user.email, 'Restablece tu contraseña Orjuela Abogados', `
        <h2>Restablecimiento de contraseña</h2>
        <p>Hola ${escapeHtml(user.full_name || 'usuario')}, recibimos una solicitud para recuperar tu acceso.</p>
        <p>Este enlace vence en 30 minutos y funciona para tu portal de ${escapeHtml(user.role)}:</p>
        <p><a href="${escapeHtml(resetUrl)}">Crear nueva contraseña</a></p>
        <p>Código temporal: ${escapeHtml(rawCode)}</p>
        <p>Si el botón no funciona, copia este enlace:</p>
        <p>${escapeHtml(resetUrl)}</p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
      `);

      if (!sent) {
        console.log('[recovery] Reset link generated:', resetUrl);
      }
      res.json({ message: 'Si el correo existe, enviaremos instrucciones para recuperar el acceso.' });
    });
  });
  });
});

app.post('/api/auth/recovery/reset', (req, res) => {
  const code = String(req.body.codigo || req.body.token || '').trim();
  const password = String(req.body.password || '');
  const passwordError = validatePasswordStrength(password);
  if (!code || passwordError) return res.status(400).json({ error: passwordError || 'Código no válido.' });

  const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
  pgGet(`SELECT id, reset_token_expires_at FROM users WHERE reset_token_hash = $1`, [tokenHash], (err, user) => {
    if (err || !user || new Date(user.reset_token_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Código inválido o vencido.' });
    }

    pgRun(`UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL, updated_at = $2 WHERE id = $3`, [hashPassword(password), getTimestamp(), user.id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: 'No fue posible actualizar la contraseña.' });
      pgGet(`SELECT id, full_name, document_id, email, auth_provider, avatar_url, role, status FROM users WHERE id = $1`, [user.id], (userErr, updatedUser) => {
        if (userErr || !updatedUser) return res.status(500).json({ error: 'Contraseña actualizada, pero no fue posible iniciar sesión automáticamente.' });
        res.json({
          message: 'Contraseña actualizada correctamente.',
          ...createAuthResponse(updatedUser)
        });
      });
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
    password: String(req.body.password || ''),
    confirm_password: String(req.body.confirm_password || ''),
    bank_name: cleanText(req.body.bank_name, 100),
    account_type: cleanText(req.body.account_type, 40),
    account_number: cleanText(req.body.account_number, 80),
    accept_program_terms: req.body.accept_program_terms,
    accept_terms: req.body.accept_terms
  };

  if (!payload.full_name || !payload.document_number || !payload.phone || !payload.email || !payload.city || !payload.ally_type || !payload.password || !payload.confirm_password || payload.accept_terms !== true) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos y aceptar el tratamiento de datos.' });
  }
  if (payload.password !== payload.confirm_password) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
  }
  const passwordError = validatePasswordStrength(payload.password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  if (!isValidEmail(payload.email)) {
    return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido.' });
  }
  if (!isOneOf(payload.ally_type, ALLY_TYPES)) {
    return res.status(400).json({ error: 'El tipo de aliado seleccionado no es válido.' });
  }

  pgAll(`SELECT id, role FROM users WHERE email = $1`, [payload.email], (roleErr, existingUsers) => {
    if (roleErr) return res.status(500).json({ error: 'No fue posible validar el correo.' });
    const roleError = validateEmailRoleAvailability(existingUsers, payload.email, 'ally');
    if (roleError) return res.status(409).json({ error: roleError });

  const createdAt = getTimestamp();
  pgRun(`INSERT INTO allies (full_name, document_number, phone, email, city, ally_type, how_known, bank_name, account_type, account_number, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12)
    RETURNING id`,
    [payload.full_name, payload.document_number, payload.phone, payload.email, payload.city, payload.ally_type, payload.how_known, payload.bank_name, payload.account_type, payload.account_number, createdAt, createdAt], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Ya existe un aliado registrado con esa cédula.' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Error interno al guardar el aliado.' });
    }

    pgRun(`INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'ally', 'active', $5, $6)
      ON CONFLICT (email, role) DO NOTHING`, [payload.full_name, payload.document_number, payload.email, hashPassword(payload.password), createdAt, createdAt], function () {
      pgGet(`SELECT id FROM users WHERE email = $1 AND role = 'ally'`, [payload.email], (userErr, user) => {
        if (!userErr && user) {
          pgRun(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, how_known, bank_name, account_type, account_number, referral_code, commission_balance, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12)
            ON CONFLICT (user_id) DO NOTHING`, [
            user.id,
            payload.document_number,
            payload.phone,
            payload.city,
            payload.ally_type,
            payload.how_known,
            payload.bank_name,
            payload.account_type,
            payload.account_number,
            generateReferralCode(payload.full_name, payload.document_number),
            createdAt,
            createdAt
          ]);
        }
      });
    });

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

    createAdminNotification({
      notification_type: 'new_ally',
      title: 'Nuevo aliado registrado',
      description: `${payload.full_name} se registró como aliado desde la landing. Ciudad: ${payload.city}. Tipo: ${payload.ally_type}.`,
      entity_type: 'ally',
      entity_id: this.lastID,
      contact_name: payload.full_name,
      contact_phone: payload.phone,
      contact_email: payload.email,
      whatsapp_message: `Hola ${payload.full_name}, bienvenido al programa de aliados de Orjuela Abogados. Queremos confirmar tu registro.`
    });

    res.status(201).json({ message: 'Tu registro como aliado fue recibido correctamente. Ya puedes ingresar al portal de aliados con tu correo y contraseña.' });
  });
  });
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

  pgGet(`SELECT u.id, u.full_name, u.status
    FROM partners p
    JOIN users u ON u.id = p.user_id
    WHERE p.document_id = $1 AND u.email = $2
    UNION
    SELECT u.id, u.full_name, u.status
    FROM allies a
    JOIN users u ON u.email = a.email AND u.role = 'ally'
    WHERE a.document_number = $3 AND a.email = $4`, [payload.ally_document_number, payload.ally_email, payload.ally_document_number, payload.ally_email], (err, ally) => {
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
    pgRun(`INSERT INTO referrals (ally_id, referred_full_name, referred_phone, referred_email, referred_city, legal_area, case_description, urgency, file_notes, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Nuevo referido', $10, $11)
      RETURNING id`,
      [ally.id, payload.referred_full_name, payload.referred_phone, payload.referred_email || '', payload.referred_city, payload.legal_area, payload.case_description, payload.urgency, payload.file_notes, createdAt, createdAt], function (insertErr) {
      if (insertErr) {
        console.error(insertErr);
        return res.status(500).json({ error: 'Error interno al guardar el referido.' });
      }
      const referralId = this.lastID;

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

      createAdminNotification({
        notification_type: 'new_referral',
        title: 'Nuevo referido recibido',
        description: `${ally.full_name} registró a ${payload.referred_full_name}. Área: ${payload.legal_area}. Ciudad: ${payload.referred_city}.`,
        entity_type: 'referral',
        entity_id: referralId,
        contact_name: payload.referred_full_name,
        contact_phone: payload.referred_phone,
        contact_email: payload.referred_email,
        whatsapp_message: `Hola ${payload.referred_full_name}, te contactamos de Orjuela Abogados. Recibimos tu solicitud por medio de ${ally.full_name} y queremos orientarte.`
      });

      createCommissionRows(referralId, ally.id, (commissionErr) => {
        if (commissionErr) console.error('[referrals] Error creando comisiones:', commissionErr);
        res.status(201).json({ message: 'Referido enviado correctamente. Quedó asociado al perfil del aliado y el equipo de Orjuela Abogados fue notificado.', id: referralId });
      });
    });
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
  pgRun(`INSERT INTO leads (name, phone, email, case_type, source, status, assigned_to, notes, referrer_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'Nuevo', $6, $7, $8, $9, $10)`,
    [payload.name, payload.phone, payload.email, payload.case_type, payload.source, payload.assigned_to, payload.notes, payload.referrer_id, createdAt, createdAt], function (err) {
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

    createAdminNotification({
      notification_type: 'new_lead',
      title: 'Nuevo cliente potencial',
      description: `${payload.name} solicitó contacto por ${payload.case_type}. Fuente: ${payload.source}.`,
      entity_type: 'lead',
      entity_id: this.lastID,
      contact_name: payload.name,
      contact_phone: payload.phone,
      contact_email: payload.email,
      whatsapp_message: `Hola ${payload.name}, te contactamos de Orjuela Abogados. Recibimos tu solicitud sobre ${payload.case_type}.`
    });

    res.status(201).json({ message: 'Tu solicitud fue recibida. El equipo de Orjuela Abogados te contactará pronto.' });
  });
});

const distFolder = path.join(__dirname, 'dist', 'abogados-asociados');
const browserFolder = path.join(distFolder, 'browser');
const staticFolder = fs.existsSync(browserFolder) ? browserFolder : distFolder;
if (fs.existsSync(staticFolder)) {
  app.use(express.static(staticFolder, {
    setHeaders: (res, filePath) => {
      if (/\.(html|js|css|json|txt|svg)$/i.test(filePath)) {
        res.charset = 'utf-8';
        const contentType = res.getHeader('Content-Type');
        if (typeof contentType === 'string' && !/charset=/i.test(contentType)) {
          res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
        }
      }
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(staticFolder, 'index.html'));
  });
}

dbReady
  .then(() => {
    if (QA_DEMO_DATA) {
      seedQaData();
    }

    if (SEED_ACCESS_USERS) {
      seedProductionAccessUsers();
    }

    app.listen(PORT, () => {
      console.log(`API server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('[db] No fue posible inicializar PostgreSQL:', error);
    process.exit(1);
  });



