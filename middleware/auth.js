const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { cookieName, isProduction, jwtExpiresIn, jwtSecret } = require('../config');
const { db } = require('../db/database');

const cookieBaseOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/'
};

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio || '',
    createdAt: user.created_at
  };
}

function createToken(user) {
  const sessionId = randomUUID();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sessionId, user.id, Date.now() + 7 * 24 * 60 * 60 * 1000);
  return jwt.sign(
    { role: user.role },
    jwtSecret,
    {
      algorithm: 'HS256',
      audience: 'byteguard-web',
      expiresIn: jwtExpiresIn,
      issuer: 'byteguard-api',
      jwtid: sessionId,
      subject: String(user.id)
    }
  );
}

function setAuthCookie(res, user) {
  const token = createToken(user);
  res.cookie(cookieName, token, {
    ...cookieBaseOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie(cookieName, cookieBaseOptions);
}

function requireAuth(req, res, next) {
  const token = req.cookies[cookieName];
  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesión para continuar.' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      audience: 'byteguard-web',
      issuer: 'byteguard-api'
    });
    const userId = Number.parseInt(payload.sub, 10);

    if (!Number.isSafeInteger(userId)) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'La sesión no es válida.' });
    }

    const user = db.prepare(`
      SELECT id, name, email, role, bio, created_at
      FROM users
      WHERE id = ? AND active = 1
    `).get(userId);

    const session = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ? AND expires_at > ?')
      .get(payload.jti || '', userId, Date.now());
    if (!user || !session) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'La sesión ya no es válida.' });
    }

    req.user = user;
    req.sessionId = payload.jti;
    return next();
  } catch (error) {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'La sesión expiró o no es válida.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
    }
    return next();
  };
}

module.exports = {
  clearAuthCookie,
  requireAuth,
  requireRole,
  setAuthCookie,
  toPublicUser
};
