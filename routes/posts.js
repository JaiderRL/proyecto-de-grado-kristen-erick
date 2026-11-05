const express = require('express');
const { db } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { findPostById, formatPost, postColumns, postJoin } = require('../db/posts');
const {
  cleanCategory,
  cleanContent,
  cleanExcerpt,
  cleanText,
  cleanTitle,
  readingMinutes,
  renderContent,
  toPositiveInteger,
  uniqueSlug
} = require('../utils/content');

const router = express.Router();
const allowedEditableStatuses = new Set(['draft', 'review']);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

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

function normalizeStatus(value) {
  if (typeof value !== 'string') return null;
  const status = value.trim().toLowerCase();
  return allowedEditableStatuses.has(status) ? status : null;
}

function validateCreatePayload(body) {
  const title = cleanTitle(body.title);
  const excerpt = cleanExcerpt(body.excerpt);
  const content = renderContent(body.content, body.contentFormat || 'html');
  const category = body.category === undefined ? 'Seguridad' : cleanCategory(body.category);
  const status = body.status === undefined ? 'draft' : normalizeStatus(body.status);

  if (!title || title.length < 3) return { error: 'El título debe tener entre 3 y 160 caracteres.' };
  if (!excerpt || excerpt.length < 10) return { error: 'El resumen debe tener entre 10 y 500 caracteres.' };
  if (!content) return { error: 'El contenido debe tener entre 20 y 50000 caracteres y no incluir HTML inseguro.' };
  if (!category || category.length < 2) return { error: 'La categoría debe tener entre 2 y 50 caracteres.' };
  if (!status) return { error: 'El estado debe ser draft o review. Solo un administrador puede publicar.' };

  return { value: { category, content, excerpt, status, title, source: body.content, format: body.contentFormat || 'html' } };
}

function validateUpdatePayload(body) {
  const fields = {};

  if (hasOwn(body, 'title')) {
    const title = cleanTitle(body.title);
    if (!title || title.length < 3) return { error: 'El título debe tener entre 3 y 160 caracteres.' };
    fields.title = title;
  }

  if (hasOwn(body, 'excerpt')) {
    const excerpt = cleanExcerpt(body.excerpt);
    if (!excerpt || excerpt.length < 10) return { error: 'El resumen debe tener entre 10 y 500 caracteres.' };
    fields.excerpt = excerpt;
  }

  if (hasOwn(body, 'content')) {
    const content = renderContent(body.content, body.contentFormat || 'html');
    if (!content) return { error: 'El contenido debe tener entre 20 y 50000 caracteres y no incluir HTML inseguro.' };
    fields.content = content;
    fields.source_content = body.content;
    fields.content_format = body.contentFormat || 'html';
    fields.reading_minutes = readingMinutes(content);
  }

  if (hasOwn(body, 'category')) {
    const category = cleanCategory(body.category);
    if (!category || category.length < 2) return { error: 'La categoría debe tener entre 2 y 50 caracteres.' };
    fields.category = category;
  }

  if (hasOwn(body, 'status')) {
    const status = normalizeStatus(body.status);
    if (!status) return { error: 'El estado debe ser draft o review. Solo un administrador puede publicar.' };
    fields.status = status;
  }

  if (Object.keys(fields).length === 0) {
    return { error: 'Incluye al menos un campo editable para actualizar el artículo.' };
  }

  return { value: fields };
}

router.get('/mine', requireAuth, (req, res, next) => {
  try {
    const limit = toPositiveInteger(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset);
    const status = req.query.status || 'all';
    if (!['all', 'draft', 'review', 'published'].includes(status)) return res.status(400).json({ error: 'Estado no válido.' });
    const statusClause = status === 'all' ? '' : ' AND p.status = ?';
    const parameters = status === 'all' ? [req.user.id] : [req.user.id, status];
    const rows = db.prepare(`
      SELECT ${postColumns}
      ${postJoin}
      WHERE p.author_id = ? ${statusClause}
      ORDER BY p.updated_at DESC, p.id DESC
      LIMIT ? OFFSET ?
    `).all(...parameters, limit, offset);

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM posts p WHERE p.author_id = ? ${statusClause}`).get(...parameters);
    const stats = db.prepare(`SELECT status, COUNT(*) AS total FROM posts WHERE author_id = ? GROUP BY status`).all(req.user.id);
    return res.json({ posts: rows.map((post) => formatPost(post, { includeContent: false, editorial: true })), pagination: { total, limit, offset }, stats });
  } catch (error) {
    return next(error);
  }
});

router.get('/mine/:id', requireAuth, (req, res, next) => {
  try {
    const id = parsePostId(req.params.id);
    if (!id) return res.status(400).json({ error: 'El identificador del artículo no es válido.' });

    const post = findPostById(db, id);
    if (!post) return res.status(404).json({ error: 'No se encontró el artículo.' });
    if (post.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo puedes consultar tus propios artículos no públicos.' });
    }

    return res.json({ post: formatPost(post, { editorial: true }) });
  } catch (error) {
    return next(error);
  }
});

router.post('/preview', requireAuth, (req, res) => {
  const content = renderContent(req.body.content, req.body.contentFormat || 'markdown');
  if (!content) return res.status(400).json({ error: 'Escribe al menos 20 caracteres de contenido (máximo 50000).' });
  return res.json({ content, readingMinutes: readingMinutes(content) });
});

router.get('/categories', (req, res) => {
  return res.json({ categories: db.prepare("SELECT category AS name, COUNT(*) AS count FROM posts WHERE status = 'published' GROUP BY category ORDER BY category").all() });
});

router.post('/', requireAuth, (req, res, next) => {
  try {
    const validation = validateCreatePayload(req.body || {});
    if (validation.error) return res.status(400).json({ error: validation.error });

    const { category, content, excerpt, status, title, source, format } = validation.value;
    const slug = uniqueSlug(db, title);
    const result = db.prepare(`
      INSERT INTO posts (
        author_id, author_name, title, slug, excerpt, content,
        category, reading_minutes, status, source_content, content_format
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      req.user.name,
      title,
      slug,
      excerpt,
      content,
      category,
      readingMinutes(content),
      status,
      source,
      format
    );

    const post = findPostById(db, result.lastInsertRowid);
    db.prepare('INSERT INTO editorial_events (post_id, actor_id, action) VALUES (?, ?, ?)').run(post.id, req.user.id, status === 'review' ? 'Enviado a revisión' : 'Borrador creado');
    return res.status(201).json({ post: formatPost(post, { editorial: true }) });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requireAuth, (req, res, next) => {
  try {
    const id = parsePostId(req.params.id);
    if (!id) return res.status(400).json({ error: 'El identificador del artículo no es válido.' });

    const existing = db.prepare('SELECT id, author_id, status, version FROM posts WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'No se encontró el artículo.' });
    if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo puedes editar tus propios artículos.' });
    }
    if (existing.status === 'published') {
      return res.status(409).json({ error: 'No se puede editar un artículo ya publicado.' });
    }
    if (req.body.version !== undefined && req.body.version !== existing.version) return res.status(409).json({ error: 'Este artículo cambió en otra sesión. Vuelve a abrirlo antes de guardar.' });

    const validation = validateUpdatePayload(req.body || {});
    if (validation.error) return res.status(400).json({ error: validation.error });

    const assignments = [];
    const values = [];
    for (const [column, value] of Object.entries(validation.value)) {
      assignments.push(`${column} = ?`);
      values.push(value);
    }
    assignments.push('updated_at = CURRENT_TIMESTAMP');
    assignments.push('version = version + 1');
    values.push(id);

    db.prepare(`UPDATE posts SET ${assignments.join(', ')} WHERE id = ?`).run(...values);
    db.prepare('INSERT INTO editorial_events (post_id, actor_id, action) VALUES (?, ?, ?)').run(id, req.user.id, validation.value.status === 'review' ? 'Enviado a revisión' : 'Borrador actualizado');
    const post = findPostById(db, id);
    return res.json({ post: formatPost(post, { editorial: true }) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth, (req, res) => {
  const post = findPostById(db, parsePostId(req.params.id) || 0);
  if (!post) return res.status(404).json({ error: 'No se encontró el artículo.' });
  if (post.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'No puedes eliminar este artículo.' });
  if (post.status !== 'draft') return res.status(409).json({ error: 'Solo se pueden eliminar borradores. Retira el artículo primero.' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  return res.json({ message: 'Borrador eliminado.' });
});

router.get('/', (req, res, next) => {
  try {
    const limit = toPositiveInteger(req.query.limit, 12, 50);
    const offset = parseOffset(req.query.offset);
    const conditions = ["p.status = 'published'"];
    const parameters = [];

    if (req.query.category !== undefined) {
      const category = cleanCategory(req.query.category);
      if (!category) return res.status(400).json({ error: 'La categoría indicada no es válida.' });
      conditions.push('fold(p.category) = fold(?)');
      parameters.push(category);
    }

    if (req.query.q !== undefined) {
      const query = cleanText(req.query.q, 80);
      if (!query) return res.status(400).json({ error: 'La búsqueda debe contener hasta 80 caracteres.' });
      conditions.push("(fold(p.title) LIKE fold(?) ESCAPE '\\' OR fold(p.excerpt) LIKE fold(?) ESCAPE '\\' OR fold(p.category) LIKE fold(?) ESCAPE '\\')");
      const term = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
      parameters.push(term, term, term);
    }

    const where = conditions.join(' AND ');
    const order = req.query.sort === 'oldest' ? 'p.published_at ASC, p.id ASC'
      : req.query.sort === 'newest' ? 'p.published_at DESC, p.id DESC'
        : 'p.featured DESC, p.published_at DESC, p.id DESC';
    const rows = db.prepare(`
      SELECT ${postColumns}
      ${postJoin}
      WHERE ${where}
      ORDER BY ${order}
      LIMIT ? OFFSET ?
    `).all(...parameters, limit, offset);
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM posts p WHERE ${where}`).get(...parameters);

    return res.json({
      posts: rows.map((post) => formatPost(post, { includeContent: false })),
      pagination: { limit, offset, total }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:slug', (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!/^[a-z0-9-]{1,180}$/.test(slug)) {
      return res.status(400).json({ error: 'El identificador del artículo no es válido.' });
    }

    const post = db.prepare(`
      SELECT ${postColumns}
      ${postJoin}
      WHERE p.slug = ? AND p.status = 'published'
    `).get(slug);
    if (!post) return res.status(404).json({ error: 'No se encontró el artículo.' });

    return res.json({ post: formatPost(post) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
