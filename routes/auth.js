const express = require('express');
const bcrypt = require('bcrypt');
const { bcryptRounds } = require('../config');
const { db } = require('../db/database');
const {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  toPublicUser
} = require('../middleware/auth');
const { cleanName, cleanText, normalizeEmail, validPassword } = require('../utils/content');

const router = express.Router();
const dummyPasswordHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function invalidRegistration(res) {
  return res.status(400).json({
    error: 'Revisa tus datos: nombre de 2 a 80 caracteres, correo válido y contraseña de 8 a 72 bytes.'
  });
}

router.post('/register', async (req, res, next) => {
  try {
    const name = cleanName(req.body.name);
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!name || name.length < 2 || !email || !validPassword(password)) {
      return invalidRegistration(res);
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    }

    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    let result;
    try {
      result = db.prepare(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, 'writer')
      `).run(name, email, passwordHash);
    } catch (error) {
      if (error.code && error.code.startsWith('SQLITE_CONSTRAINT')) {
        return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
      }
      throw error;
    }

    const user = db.prepare(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE id = ?
    `).get(result.lastInsertRowid);

    setAuthCookie(res, user);
    return res.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !validPassword(password)) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const user = db.prepare(`
      SELECT id, name, email, password_hash, role, bio, active, created_at
      FROM users
      WHERE email = ?
    `).get(email);
    const passwordMatches = await bcrypt.compare(
      password,
      user ? user.password_hash : dummyPasswordHash
    );

    if (!user || !passwordMatches || !user.active) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    setAuthCookie(res, user);
    return res.json({ user: toPublicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: toPublicUser(req.user) });
});

router.patch('/profile', requireAuth, (req, res) => {
  const name = cleanName(req.body.name);
  const bio = req.body.bio === '' ? '' : cleanText(req.body.bio, 300);
  if (!name || name.length < 2 || bio === null) return res.status(400).json({ error: 'Revisa tu nombre y biografía (hasta 300 caracteres).' });
  db.prepare('UPDATE users SET name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, bio, req.user.id);
  return res.json({ user: toPublicUser({ ...req.user, name, bio }) });
});

router.patch('/password', requireAuth, async (req, res, next) => {
  try {
    if (!validPassword(req.body.password) || !validPassword(req.body.currentPassword)) {
      return res.status(400).json({ error: 'La contraseña debe tener de 8 a 72 bytes.' });
    }
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!await bcrypt.compare(req.body.currentPassword, user.password_hash)) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
    const hash = await bcrypt.hash(req.body.password, bcryptRounds);
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, req.user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
    })();
    setAuthCookie(res, req.user);
    return res.json({ message: 'Contraseña actualizada. Las otras sesiones se cerraron.' });
  } catch (error) { return next(error); }
});

router.post('/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
  clearAuthCookie(res);
  return res.json({ message: 'Sesión cerrada.' });
});

module.exports = router;
