const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.resolve(__dirname, 'data', 'orjuela.db');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const ALLY_TYPES = ['persona_natural', 'empresa', 'inmobiliaria', 'contador', 'asesor_comercial', 'otro'];
const ALLY_STATUSES = ['pending', 'active', 'inactive'];
const LEGAL_AREAS = ['derecho_civil', 'derecho_laboral', 'derecho_comercial', 'derecho_inmobiliario', 'derecho_familia', 'cobranza', 'otro'];
const REFERRAL_STATUSES = ['new', 'contacted', 'in_progress', 'won', 'rejected'];

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
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ally_id INTEGER NOT NULL,
      referred_full_name TEXT NOT NULL,
      referred_phone TEXT NOT NULL,
      referred_email TEXT,
      referred_city TEXT NOT NULL,
      legal_area TEXT NOT NULL,
      case_description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (ally_id) REFERENCES allies(id)
    )`);
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

function normalizeDocument(value) {
  return cleanText(value, 40).replace(/[^\dA-Za-z-]/g, '');
}

function normalizeEmail(value) {
  return cleanText(value, 180).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

function authorizeAdmin(req, res, next) {
  const password = (req.headers['x-admin-password'] || '').toString();
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/allies', (req, res) => {
  const payload = {
    full_name: cleanText(req.body.full_name),
    document_number: normalizeDocument(req.body.document_number),
    phone: cleanText(req.body.phone, 60),
    email: normalizeEmail(req.body.email),
    city: cleanText(req.body.city, 100),
    ally_type: cleanText(req.body.ally_type, 40),
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
  const stmt = db.prepare(`INSERT INTO allies (full_name, document_number, phone, email, city, ally_type, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`);

  stmt.run(payload.full_name, payload.document_number, payload.phone, payload.email, payload.city, payload.ally_type, createdAt, createdAt, function (err) {
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
    const stmt = db.prepare(`INSERT INTO referrals (ally_id, referred_full_name, referred_phone, referred_email, referred_city, legal_area, case_description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`);

    stmt.run(ally.id, payload.referred_full_name, payload.referred_phone, payload.referred_email || '', payload.referred_city, payload.legal_area, payload.case_description, createdAt, createdAt, function (insertErr) {
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
        <p><strong>Descripción:</strong> ${escapeHtml(payload.case_description)}</p>
        <p><strong>Fecha:</strong> ${createdAt}</p>
      `);

      res.status(201).json({ message: 'Referido enviado correctamente. El equipo de Orjuela Abogados se pondrá en contacto con la persona referida.' });
    });
    stmt.finalize();
  });
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
