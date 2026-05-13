const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');

dotenv.config();

const DB_FILE = process.env.DB_FILE || path.resolve(__dirname, '..', 'data', 'orjuela.db');
const now = new Date().toISOString();
const db = new sqlite3.Database(DB_FILE);

const accessUsers = [
  {
    fullName: 'Usuario Prueba',
    documentId: '12345678',
    email: 'cliente@orjuela.com',
    password: 'Cliente123!',
    role: 'client'
  },
  {
    fullName: 'Usuario Prueba',
    documentId: '12345678',
    email: 'aliado@orjuela.com',
    password: 'Aliado123!',
    role: 'ally'
  },
  {
    fullName: 'Usuario Prueba',
    documentId: '12345678',
    email: 'admin@orjuela.com',
    password: 'Admin123!',
    role: 'admin'
  }
];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function upsertUser(user) {
  const existingUser = await get(`SELECT id FROM users WHERE email = ?`, [user.email]);
  const passwordHash = hashPassword(user.password);

  if (existingUser) {
    await run(`UPDATE users
      SET full_name = ?, document_id = ?, password_hash = ?, role = ?, status = 'active', updated_at = ?
      WHERE id = ?`, [user.fullName, user.documentId, passwordHash, user.role, now, existingUser.id]);
    return existingUser.id;
  }

  const inserted = await run(`INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`, [user.fullName, user.documentId, user.email, passwordHash, user.role, now, now]);
  return inserted.lastID;
}

async function seed() {
  const safeMigrations = [
    `ALTER TABLE users ADD COLUMN document_id TEXT`,
    `ALTER TABLE partners ADD COLUMN occupation TEXT`,
    `ALTER TABLE partners ADD COLUMN referral_code TEXT`,
    `ALTER TABLE partners ADD COLUMN invited_by_partner_id INTEGER`,
    `ALTER TABLE partners ADD COLUMN created_at TEXT`,
    `ALTER TABLE partners ADD COLUMN updated_at TEXT`
  ];

  for (const migration of safeMigrations) {
    await run(migration).catch(() => {});
  }

  for (const user of accessUsers) {
    const userId = await upsertUser(user);

    if (user.role === 'client') {
      await run(`INSERT INTO auth_clients (user_id, document_id, assigned_lawyer)
        VALUES (?, ?, 'Equipo Orjuela')
        ON CONFLICT(user_id) DO UPDATE SET
          document_id = excluded.document_id,
          assigned_lawyer = excluded.assigned_lawyer`, [userId, user.documentId]);

      await run(`INSERT INTO clients (name, document_id, phone, email, created_at)
        SELECT ?, ?, '3000000000', ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM clients WHERE email = ?)`,
        [user.fullName, user.documentId, user.email, now, user.email]);
    }

    if (user.role === 'ally') {
      await run(`INSERT INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, referral_code, commission_balance, created_at, updated_at)
        VALUES (?, ?, '3000000000', 'Bogota', 'Independiente', 'Orjuela Abogados', 'Usuario de prueba', 'Usuario de prueba', 'ORJUELAPRUEBA', 0, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          document_id = excluded.document_id,
          phone = excluded.phone,
          city = excluded.city,
          partner_type = excluded.partner_type,
          company = excluded.company,
          how_known = excluded.how_known,
          occupation = excluded.occupation,
          referral_code = excluded.referral_code,
          updated_at = excluded.updated_at`, [userId, user.documentId, now, now]);
    }

    console.log(`ok ${user.email} role=${user.role}`);
  }
}

seed()
  .then(() => {
    console.log(`Access users seeded in ${DB_FILE}`);
    db.close();
  })
  .catch((error) => {
    console.error(error);
    db.close(() => process.exit(1));
  });
