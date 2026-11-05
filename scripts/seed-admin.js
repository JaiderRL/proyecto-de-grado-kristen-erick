const bcrypt = require('bcrypt');
const { bcryptRounds } = require('../config');
const { db } = require('../db/database');
const { cleanName, normalizeEmail, validPassword } = require('../utils/content');

async function seedAdmin() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  const name = cleanName(process.env.ADMIN_NAME || 'Administrador ByteGuard');

  if (!email || !validPassword(password) || !name || name.length < 2) {
    console.error('Faltan datos válidos. Define ADMIN_EMAIL, ADMIN_PASSWORD (8-72 bytes) y opcionalmente ADMIN_NAME.');
    process.exitCode = 1;
    return;
  }

  const existingUser = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
  if (existingUser) {
    console.error(
      existingUser.role === 'admin'
        ? 'Ya existe un administrador con ese correo.'
        : 'Ese correo ya pertenece a un escritor; no se promoverá automáticamente por seguridad.'
    );
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, 'admin')
  `).run(name, email, passwordHash);

  console.info(`Administrador creado para ${email}. No se imprimió ni almacenó la contraseña en texto plano.`);
}

seedAdmin()
  .catch((error) => {
    console.error('No se pudo crear el administrador.', error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
