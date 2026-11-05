const { readingMinutes, slugify } = require('../utils/content');
const { supplements, extraPosts } = require('./editorial-content');

const initialPosts = [
  {
    title: 'Tu superficie de ataque es más grande de lo que crees',
    excerpt: 'Una guía práctica para descubrir qué información tuya está expuesta y reducir riesgos sin ser experto.',
    content: '<p>Cada cuenta, dispositivo y servicio que usas deja una pequeña parte de tu vida digital expuesta. Mapear esa superficie de ataque es el primer paso para reducir riesgos.</p><h2>Empieza por tus cuentas</h2><p>Revisa qué servicios conservan datos tuyos, activa la autenticación multifactor y elimina cuentas que ya no uses. No hace falta ser especialista para adoptar hábitos más seguros.</p>',
    category: 'Guía',
    authorName: 'Equipo ByteGuard'
  },
  {
    title: 'Las passkeys llegaron para reemplazar tus contraseñas',
    excerpt: 'Por qué las passkeys reducen el phishing y cómo empezar a usarlas sin complicarte.',
    content: '<p>Las passkeys usan la seguridad de tu dispositivo para iniciar sesión sin memorizar una contraseña. Su diseño evita que una copia falsa de un sitio pueda reutilizar tu credencial.</p><p>Busca el icono de passkey en tus servicios más importantes y guarda siempre un método de recuperación seguro.</p>',
    category: 'Privacidad',
    authorName: 'Equipo ByteGuard'
  },
  {
    title: 'Así se ve un correo de phishing bien hecho',
    excerpt: 'Las señales que todavía permiten detectar un mensaje engañoso antes de hacer clic.',
    content: '<p>El phishing moderno cuida el diseño, el tono y hasta los detalles de una marca conocida. Por eso conviene detenerse antes de abrir enlaces o adjuntos inesperados.</p><p>Verifica el dominio del remitente, entra al servicio desde un marcador propio y confirma solicitudes urgentes por otro canal.</p>',
    category: 'Amenazas',
    authorName: 'Equipo ByteGuard'
  },
  {
    title: '¿Qué sabe una IA sobre ti después de conversar?',
    excerpt: 'Una conversación útil también puede revelar más información personal de la que imaginas.',
    content: '<p>Las herramientas de inteligencia artificial pueden procesar instrucciones, contexto y datos que compartes. Conocer sus políticas ayuda a decidir qué información es apropiada para una consulta.</p><p>Evita incluir secretos, datos de clientes o identificadores personales y revisa si el servicio ofrece controles de historial o entrenamiento.</p>',
    category: 'IA y sociedad',
    authorName: 'Equipo ByteGuard'
  }
];

function seedInitialPosts(db) {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM posts').get();
  db.exec('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  if (db.prepare("SELECT value FROM app_meta WHERE key = 'editorial_content_v2'").get()) return 0;

  const insertPost = db.prepare(`
    INSERT INTO posts (
      title, slug, excerpt, content, category, reading_minutes,
      status, author_name, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, CURRENT_TIMESTAMP)
  `);

  let added = 0;
  const insertAll = db.transaction(() => {
    for (const [index, post] of initialPosts.entries()) {
      const content = post.content + supplements[index];
      if (total > 0) {
        // Only upgrade the untouched bundled examples; preserve user-authored edits.
        db.prepare('UPDATE posts SET content = ?, reading_minutes = ?, version = version + 1 WHERE author_id IS NULL AND slug = ? AND content = ?')
          .run(content, readingMinutes(content), slugify(post.title), post.content);
        continue;
      }
      insertPost.run(
        post.title,
        slugify(post.title),
        post.excerpt,
        content,
        post.category,
        readingMinutes(content),
        post.authorName
      );
      added += 1;
    }
    for (const post of extraPosts) {
      if (db.prepare('SELECT id FROM posts WHERE slug = ?').get(slugify(post.title))) continue;
      insertPost.run(post.title, slugify(post.title), post.excerpt, post.content, post.category, readingMinutes(post.content), 'Equipo ByteGuard');
      added += 1;
    }
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('editorial_content_v2', '1')").run();
  });

  insertAll();
  return added;
}

module.exports = { seedInitialPosts };
