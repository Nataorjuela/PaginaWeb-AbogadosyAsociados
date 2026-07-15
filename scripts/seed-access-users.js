const crypto = require('crypto');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const now = new Date().toISOString();

if (!DATABASE_URL) {
  console.error('DATABASE_URL es obligatorio para sembrar usuarios en PostgreSQL.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: !/localhost|127\.0\.0\.1/i.test(DATABASE_URL) ? { rejectUnauthorized: false } : false
});

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

async function upsertUser(user) {
  const passwordHash = hashPassword(user.password);
  const result = await pool.query(
    `INSERT INTO users (full_name, document_id, email, password_hash, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
      ON CONFLICT (email, role) DO UPDATE SET
        full_name = excluded.full_name,
        document_id = excluded.document_id,
        password_hash = excluded.password_hash,
        status = 'active',
        updated_at = excluded.updated_at
      RETURNING id`,
    [user.fullName, user.documentId, user.email, passwordHash, user.role, now, now]
  );
  return result.rows[0].id;
}

async function seed() {
  for (const user of accessUsers) {
    const userId = await upsertUser(user);

    if (user.role === 'client') {
      await pool.query(
        `INSERT INTO auth_clients (user_id, document_id, assigned_lawyer)
          VALUES ($1, $2, 'Equipo Orjuela')
          ON CONFLICT (user_id) DO UPDATE SET
            document_id = excluded.document_id,
            assigned_lawyer = excluded.assigned_lawyer`,
        [userId, user.documentId]
      );

      await pool.query(
        `INSERT INTO clients (name, document_id, phone, email, created_at)
          SELECT $1, $2, '3000000000', $3, $4
          WHERE NOT EXISTS (SELECT 1 FROM clients WHERE email = $5)`,
        [user.fullName, user.documentId, user.email, now, user.email]
      );
    }

    if (user.role === 'ally') {
      await pool.query(
        `INSERT INTO partners (user_id, document_id, phone, city, partner_type, company, how_known, occupation, referral_code, commission_balance, created_at, updated_at)
          VALUES ($1, $2, '3000000000', 'Bogota', 'Independiente', 'Orjuela Abogados', 'Usuario de prueba', 'Usuario de prueba', 'ORJUELAPRUEBA', 0, $3, $4)
          ON CONFLICT (user_id) DO UPDATE SET
            document_id = excluded.document_id,
            phone = excluded.phone,
            city = excluded.city,
            partner_type = excluded.partner_type,
            company = excluded.company,
            how_known = excluded.how_known,
            occupation = excluded.occupation,
            referral_code = excluded.referral_code,
            updated_at = excluded.updated_at`,
        [userId, user.documentId, now, now]
      );
    }

    console.log(`ok ${user.email} role=${user.role}`);
  }
}

seed()
  .then(async () => {
    console.log('Access users seeded in PostgreSQL.');
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
