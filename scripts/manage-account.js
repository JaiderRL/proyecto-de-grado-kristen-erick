const readline = require('node:readline');
const { Writable } = require('node:stream');
const bcrypt = require('bcrypt');
const { db } = require('../db/database');
const { bcryptRounds } = require('../config');
const { cleanName, normalizeEmail, validPassword } = require('../utils/content');

let muted = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
const terminal = readline.createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
function ask(prompt, secret = false) {
  return new Promise((resolve) => {
    terminal.question(prompt, (answer) => {
      muted = false;
      if (secret) process.stdout.write('\n');
      resolve(answer);
    });
    muted = secret;
  });
}
terminal.on('SIGINT', () => { muted = false; terminal.close(); db.close(); process.exit(130); });

async function run() {
  const reset = process.argv.includes('--reset');
  console.info(reset ? 'Recuperación local de una cuenta existente.' : 'Crear una cuenta de administración de ByteGuard.');
  const email = normalizeEmail(await ask('Correo de la cuenta: '));
  if (!email) throw new Error('El correo no es válido.');
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (reset && !existing) throw new Error('No existe una cuenta con ese correo.');
  if (!reset && existing) throw new Error('Ese correo ya existe. Usa account:reset si necesitas recuperar el acceso.');
  const name = reset ? null : cleanName(await ask('Nombre visible: '));
  if (!reset && (!name || name.length < 2)) throw new Error('El nombre debe tener de 2 a 80 caracteres.');
  const password = await ask('Nueva contraseña (no se muestra): ', true);
  if (!validPassword(password)) throw new Error('La contraseña debe tener de 8 a 72 bytes.');
  const confirmation = await ask('Repite la contraseña: ', true);
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
  const hash = await bcrypt.hash(password, bcryptRounds);
  db.transaction(() => {
    if (reset) {
      db.prepare('UPDATE users SET password_hash = ?, active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, existing.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
    } else {
      db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run(name, email, hash);
    }
  })();
  console.info(reset ? 'Contraseña actualizada y sesiones anteriores cerradas. Ya puedes iniciar sesión.' : 'Administrador creado. Ya puedes iniciar sesión desde Acceso editorial.');
}
run().catch((error) => { muted = false; console.error(error.message); process.exitCode = 1; }).finally(() => { terminal.close(); db.close(); });
