const express = require('express');
const rateLimit = require('express-rate-limit');
const { db } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { postColumns, postJoin, formatPost } = require('../db/posts');
const { cleanText, toPositiveInteger } = require('../utils/content');

const router = express.Router();
const commentLimiter = rateLimit({ windowMs: 60000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Espera un minuto antes de enviar otro comentario.' } });
const publicPost = (id) => db.prepare("SELECT id FROM posts WHERE id = ? AND status = 'published'").get(id);
router.get('/posts/:id/comments', (req, res) => {
  if (!publicPost(req.params.id)) return res.status(404).json({ error: 'Artículo no disponible.' });
  const limit = 20;
  const page = toPositiveInteger(req.query.page, 1, 10000);
  const comments = db.prepare(`SELECT c.id, c.content, u.name AS author, c.created_at AS createdAt
    FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? AND c.status = 'approved' ORDER BY c.id DESC LIMIT ? OFFSET ?`).all(req.params.id, limit, (page - 1) * limit);
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM comments WHERE post_id = ? AND status = 'approved'").get(req.params.id);
  return res.json({ comments, pagination: { total, limit, offset: (page - 1) * limit } });
});
router.post('/posts/:id/comments', requireAuth, commentLimiter, (req, res) => {
  if (!publicPost(req.params.id)) return res.status(404).json({ error: 'Artículo no disponible.' });
  const content = cleanText(req.body.content, 1500);
  if (!content || content.length < 3) return res.status(400).json({ error: 'El comentario debe tener entre 3 y 1500 caracteres.' });
  db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)').run(req.params.id, req.user.id, content);
  return res.status(201).json({ message: 'Comentario enviado. Será visible después de la moderación.' });
});
router.get('/bookmarks', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT ${postColumns} ${postJoin} JOIN bookmarks b ON b.post_id = p.id
    WHERE b.user_id = ? AND p.status = 'published' ORDER BY b.created_at DESC, p.id DESC`).all(req.user.id);
  return res.json({ posts: rows.map((post) => formatPost(post, { includeContent: false })) });
});
router.put('/bookmarks/:id', requireAuth, (req, res) => {
  if (!publicPost(req.params.id)) return res.status(404).json({ error: 'Artículo no disponible.' });
  db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, post_id) VALUES (?, ?)').run(req.user.id, req.params.id);
  return res.json({ saved: true });
});
router.delete('/bookmarks/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?').run(req.user.id, req.params.id);
  return res.json({ saved: false });
});
module.exports = router;
