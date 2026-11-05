const path = require('node:path');
const fs = require('node:fs');
const cookieParser = require('cookie-parser');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { isProduction, port, projectRoot } = require('./config');
const { db } = require('./db/database');
const { sameOriginForWrites } = require('./middleware/security');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const newsletterRoutes = require('./routes/newsletter');
const postRoutes = require('./routes/posts');
const setupRoutes = require('./routes/setup');
const communityRoutes = require('./routes/community');

const app = express();
app.disable('x-powered-by');

if (isProduction) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      baseUri: ["'self'"],
      defaultSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  referrerPolicy: { policy: 'no-referrer' }
}));

app.use(express.json({ limit: '100kb', strict: true }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body === undefined) req.body = {};
  return next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  legacyHeaders: false,
  standardHeaders: true,
  message: { error: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  legacyHeaders: false,
  standardHeaders: true,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de acceso. Inténtalo de nuevo en unos minutos.' }
});

app.use('/api', sameOriginForWrites, apiLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/setup', authLimiter);
app.use('/api/auth/password', authLimiter);

app.get('/api/health', (req, res) => {
  return res.json({ status: 'ok' });
});
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/subscriptions', newsletterRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/community', communityRoutes);

app.use('/api', (req, res) => {
  return res.status(404).json({ error: 'No existe esta ruta de la API.' });
});

const publicFiles = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/styles.css', 'styles.css'],
  ['/script.js', 'script.js'],
  ['/favicon.svg', 'favicon.svg']
]);

for (const [urlPath, fileName] of publicFiles) {
  app.get(urlPath, (req, res, next) => {
    res.sendFile(path.join(projectRoot, fileName), (error) => {
      if (error) next(error);
    });
  });
}

const escapeXml = (value) => String(value).replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
app.get('/articulo/:slug', (req, res, next) => {
  const post = db.prepare("SELECT title, excerpt FROM posts WHERE slug = ? AND status = 'published'").get(req.params.slug);
  fs.readFile(path.join(projectRoot, 'index.html'), 'utf8', (error, html) => {
    if (error) return next(error);
    if (!post) return res.status(404).type('html').send(html);
    const base = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${base}/articulo/${encodeURIComponent(req.params.slug)}`;
    const metadata = `<link rel="canonical" href="${escapeXml(url)}" /><meta property="og:type" content="article" /><meta property="og:title" content="${escapeXml(post.title)}" /><meta property="og:description" content="${escapeXml(post.excerpt)}" /><meta property="og:url" content="${escapeXml(url)}" />`;
    const output = html.replace(/<title>.*?<\/title>/, `<title>${escapeXml(post.title)} — ByteGuard</title>`)
      .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeXml(post.excerpt)}" />`)
      .replace('</head>', metadata + '</head>');
    return res.type('html').send(output);
  });
});
app.get('/sitemap.xml', (req, res) => {
  const base = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
  const posts = db.prepare("SELECT slug FROM posts WHERE status = 'published'").all();
  const entries = ['/', ...posts.map((post) => `/articulo/${post.slug}`)].map((url) => `<url><loc>${escapeXml(base + url)}</loc></url>`).join('');
  return res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`);
});
app.get('/robots.txt', (req, res) => res.type('text').send('User-agent: *\nAllow: /\nDisallow: /api/\n'));
app.get('/feed.xml', (req, res) => {
  const base = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
  const posts = db.prepare("SELECT title, slug, excerpt, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC, id DESC LIMIT 30").all();
  const items = posts.map((post) => `<item><title>${escapeXml(post.title)}</title><link>${escapeXml(base)}/articulo/${post.slug}</link><guid>${escapeXml(base)}/articulo/${post.slug}</guid><description>${escapeXml(post.excerpt)}</description><pubDate>${new Date(post.published_at.replace(' ', 'T') + 'Z').toUTCString()}</pubDate></item>`).join('');
  return res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>ByteGuard</title><link>${escapeXml(base)}</link><description>Ciberseguridad sin ruido</description><language>es</language>${items}</channel></rss>`);
});

app.use((req, res) => {
  return res.status(404).json({ error: 'Recurso no encontrado.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo JSON no es válido.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El contenido enviado es demasiado grande.' });
  }

  console.error('Error no controlado en la API:', error);
  return res.status(500).json({ error: 'Ocurrió un error interno. Inténtalo de nuevo.' });
});

function startServer() {
  const server = app.listen(port, () => {
    console.info(`ByteGuard disponible en http://localhost:${port}`);
  });

  const closeServer = () => {
    server.close(() => db.close());
  };
  process.once('SIGINT', closeServer);
  process.once('SIGTERM', closeServer);
  return server;
}

if (require.main === module) startServer();

module.exports = { app, startServer };
