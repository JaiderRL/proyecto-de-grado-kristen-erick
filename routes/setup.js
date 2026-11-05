const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../db/database');
const { isProduction, bcryptRounds } = require('../config');
const { cleanName, normalizeEmail, validPassword } = require('../utils/content');
const { setAuthCookie, toPublicUser } = require('../middleware/auth');

const router = express.Router();
const needsSetup = () => !db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
const isLocal = (req) => !isProduction && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
  && ['localhost', '127.0.0.1', '[::1]'].includes(req.hostname)
  && !req.get('x-forwarded-for') && !req.get('forwarded');

router.get('/', (req, res) => res.json({ required: needsSetup(), allowed: isLocal(req) }));
router.post('/', async (req, res, next) => {
  try {
    if (!isLocal(req)) return res.status(403).json({ error: 'La configuración inicial solo está disponible desde este equipo en modo local. Usa seed:admin en producción.' });
    if (!needsSetup()) return res.status(409).json({ error: 'La administración ya está configurada.' });
    const name = cleanName(req.body.name);
    const email = normalizeEmail(req.body.email);
    if (!name || name.length < 2 || !email || !validPassword(req.body.password)) return res.status(400).json({ error: 'Introduce un nombre, correo válido y contraseña de 8 a 72 bytes.' });
    const hash = await bcrypt.hash(req.body.password, bcryptRounds);
    const result = db.transaction(() => {
      if (!needsSetup()) return null;
      return db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run(name, email, hash);
    })();
    if (!result) return res.status(409).json({ error: 'La administración ya está configurada.' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    setAuthCookie(res, user);
    return res.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Ese correo ya tiene una cuenta. Usa otro correo para administración.' });
    return next(error);
  }
});
module.exports = router;
