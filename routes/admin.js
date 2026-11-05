const express = require('express');
const { db } = require('../db/database');
const { findPostById, formatPost, postColumns, postJoin } = require('../db/posts');
const { requireAuth, requireRole } = require('../middleware/auth');
const { toPositiveInteger, cleanText } = require('../utils/content');

const router = express.Router();
const allowedStatuses = new Set(['draft', 'review', 'published', 'all']);

function parsePostId(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseOffset(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 100000);
}

router.use(requireAuth, requireRole('admin'));

router.get('/stats', (req, res, next) => {
  try {
    const { pendingPosts } = db.prepare(`
      SELECT COUNT(*) AS pendingPosts FROM posts WHERE status = 'review'
    `).get();
    const { publishedPosts } = db.prepare(`
      SELECT COUNT(*) AS publishedPosts FROM posts WHERE status = 'published'
    `).get();
    const { writerCount } = db.prepare(`
      SELECT COUNT(*) AS writerCount FROM users WHERE role = 'writer'
    `).get();

    const { pendingComments } = db.prepare("SELECT COUNT(*) AS pendingComments FROM comments WHERE status = 'pending'").get();
    const { subscriberCount } = db.prepare('SELECT COUNT(*) AS subscriberCount FROM subscriptions WHERE active = 1').get();
    return res.json({ pendingPosts, publishedPosts, writerCount, pendingComments, subscriberCount });
  } catch (error) {
    return next(error);
  }
});

router.get('/posts', (req, res, next) => {
  try {
    const status = String(req.query.status || 'review').trim().toLowerCase();
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: 'El estado solicitado no es válido.' });
    }

    const limit = toPositiveInteger(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset);
    const where = status === 'all' ? '' : 'WHERE p.status = ?';
    const parameters = status === 'all' ? [] : [status];
    const rows = db.prepare(`
      SELECT ${postColumns}
      ${postJoin}
      ${where}
      ORDER BY
        CASE p.status WHEN 'review' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
        p.updated_at DESC,
        p.id DESC
      LIMIT ? OFFSET ?
    `).all(...parameters, limit, offset);

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM posts p ${where}`).get(...parameters);
    return res.json({ posts: rows.map((post) => formatPost(post, { includeContent: false, editorial: true })), pagination: { total, limit, offset } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/posts/:id/publish', (req, res, next) => {
  try {
    const id = parsePostId(req.params.id);
    if (!id) return res.status(400).json({ error: 'El identificador del artículo no es válido.' });

    const existing = db.prepare('SELECT id, status, version FROM posts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'No se encontró el artículo.' });
    if (existing.status === 'published') {
      return res.status(409).json({ error: 'El artículo ya está publicado.' });
    }
    if (existing.status !== 'review') {
      return res.status(409).json({ error: 'Solo se pueden publicar artículos en revisión.' });
    }
    if (req.body.version !== undefined && req.body.version !== existing.version) return res.status(409).json({ error: 'El artículo cambió. Ábrelo de nuevo antes de publicarlo.' });

    db.prepare(`
      UPDATE posts
      SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, review_note = '', version = version + 1
      WHERE id = ?
    `).run(id);
    db.prepare('INSERT INTO editorial_events (post_id, actor_id, action) VALUES (?, ?, ?)').run(id, req.user.id, 'Publicado');

    return res.json({ post: formatPost(findPostById(db, id)) });
  } catch (error) {
    return next(error);
  }
});

router.get('/posts/:id', (req, res) => {
  const post = findPostById(db, parsePostId(req.params.id) || 0);
  if (!post) return res.status(404).json({ error: 'No se encontró el artículo.' });
  const events = db.prepare(`SELECT e.action, e.note, e.created_at AS createdAt, u.name AS actor
    FROM editorial_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.post_id = ? ORDER BY e.id DESC LIMIT 30`).all(post.id);
  return res.json({ post: formatPost(post, { editorial: true }), events });
});

router.patch('/posts/:id/return', (req, res) => {
  const post = findPostById(db, parsePostId(req.params.id) || 0);
  if (!post) return res.status(404).json({ error: 'No se encontró el artículo.' });
  if (!['review', 'published'].includes(post.status)) return res.status(409).json({ error: 'El artículo ya es un borrador.' });
  if (req.body.version !== undefined && req.body.version !== post.version) return res.status(409).json({ error: 'El artículo cambió. Vuelve a abrirlo.' });
  const note = cleanText(req.body.note, 1000);
  if (!note || note.length < 5) return res.status(400).json({ error: 'Indica el motivo de la devolución (5 a 1000 caracteres).' });
  db.transaction(() => {
    db.prepare("UPDATE posts SET status = 'draft', review_note = ?, featured = 0, updated_at = CURRENT_TIMESTAMP, version = version + 1 WHERE id = ?").run(note, post.id);
    db.prepare('INSERT INTO editorial_events (post_id, actor_id, action, note) VALUES (?, ?, ?, ?)').run(post.id, req.user.id, 'Devuelto a borrador', note);
  })();
  return res.json({ post: formatPost(findPostById(db, post.id), { editorial: true }) });
});

router.patch('/posts/:id/feature', (req, res) => {
  const post = findPostById(db, parsePostId(req.params.id) || 0);
  if (!post || post.status !== 'published') return res.status(404).json({ error: 'Solo puedes destacar artículos publicados.' });
  if (typeof req.body.featured !== 'boolean') return res.status(400).json({ error: 'Indica si se debe destacar.' });
  db.transaction(() => {
    if (req.body.featured) db.prepare('UPDATE posts SET featured = 0').run();
    db.prepare('UPDATE posts SET featured = ? WHERE id = ?').run(Number(req.body.featured), post.id);
  })();
  return res.json({ message: 'Portada actualizada.' });
});

router.get('/users', (req, res) => {
  const limit = toPositiveInteger(req.query.limit, 20, 100);
  const offset = parseOffset(req.query.offset);
  const users = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.active, u.created_at AS createdAt,
    (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS postCount FROM users u ORDER BY u.id DESC LIMIT ? OFFSET ?`).all(limit, offset);
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM users').get();
  return res.json({ users, pagination: { total, limit, offset } });
});

router.patch('/users/:id', (req, res) => {
  const id = parsePostId(req.params.id);
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id || 0);
  if (!user) return res.status(404).json({ error: 'Cuenta no encontrada.' });
  if (user.id === req.user.id || user.role === 'admin') return res.status(409).json({ error: 'Las cuentas de administración no pueden suspenderse desde este panel.' });
  if (typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'Indica el estado de la cuenta.' });
  db.transaction(() => {
    db.prepare('UPDATE users SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(Number(req.body.active), id);
    if (!req.body.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  })();
  return res.json({ message: req.body.active ? 'Cuenta activada.' : 'Cuenta suspendida y sesiones cerradas.' });
});

router.get('/comments', (req, res) => {
  const limit = toPositiveInteger(req.query.limit, 20, 100);
  const offset = parseOffset(req.query.offset);
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const comments = db.prepare(`SELECT c.id, c.content, c.status, c.created_at AS createdAt, u.name AS author, p.title AS postTitle
    FROM comments c JOIN users u ON u.id = c.user_id JOIN posts p ON p.id = c.post_id WHERE c.status = ? ORDER BY c.id DESC LIMIT ? OFFSET ?`).all(status, limit, offset);
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM comments WHERE status = ?').get(status);
  return res.json({ comments, pagination: { total, limit, offset } });
});

router.patch('/comments/:id', (req, res) => {
  if (!['approved', 'rejected'].includes(req.body.status)) return res.status(400).json({ error: 'Estado de moderación no válido.' });
  const result = db.prepare('UPDATE comments SET status = ? WHERE id = ?').run(req.body.status, parsePostId(req.params.id) || 0);
  if (!result.changes) return res.status(404).json({ error: 'Comentario no encontrado.' });
  return res.json({ message: 'Comentario moderado.' });
});

router.get('/subscriptions', (req, res) => {
  const subscriptions = db.prepare('SELECT id, email, active, created_at AS createdAt FROM subscriptions ORDER BY id DESC').all();
  return res.json({ subscriptions });
});

module.exports = router;
