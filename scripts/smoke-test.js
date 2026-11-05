const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcrypt');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'byteguard-api-'));
process.env.DATABASE_PATH = path.join(testDirectory, 'byteguard-test.db');
process.env.JWT_SECRET = 'smoke-test-only-secret-1c75b3094a3d69464eeebff4';
process.env.NODE_ENV = 'test';

const { app } = require('../server');
const { db } = require('../db/database');

function jsonRequest(baseUrl, urlPath, { body, cookie, method = 'GET', origin } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;

  return fetch(`${baseUrl}${urlPath}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
    method
  }).then(async (response) => ({
    body: await response.json(),
    response
  }));
}

function expectStatus(result, status) {
  assert.equal(result.response.status, status, JSON.stringify(result.body));
  return result.body;
}

function cookieFrom(response) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'La respuesta no incluyó la cookie de sesión.');
  return setCookie.split(';')[0];
}

async function run() {
  let server;
  try {
    server = await new Promise((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const publicPosts = expectStatus(await jsonRequest(baseUrl, '/api/posts'), 200);
    assert.equal(publicPosts.posts.length, 6);

    const registrationResult = await jsonRequest(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Writer',
        email: 'writer.test@example.com',
        password: 'PasswordSecure9',
        role: 'admin'
      }
    });
    const registration = expectStatus(registrationResult, 201);
    const writerCookie = cookieFrom(registrationResult.response);
    assert.equal(registration.user.role, 'writer');

    const me = expectStatus(await jsonRequest(baseUrl, '/api/auth/me', { cookie: writerCookie }), 200);
    assert.equal(me.user.email, 'writer.test@example.com');

    const created = expectStatus(await jsonRequest(baseUrl, '/api/posts', {
      method: 'POST',
      cookie: writerCookie,
      body: {
        title: 'Prueba segura de API',
        excerpt: 'Este es un resumen de prueba suficientemente largo.',
        content: '<p>Este artículo prueba la persistencia y sanitización de contenido de ByteGuard.</p><script>alert(1)</script>',
        category: 'Seguridad',
        status: 'draft'
      }
    }), 201);
    assert.equal(created.post.status, 'draft');

    const mine = expectStatus(await jsonRequest(baseUrl, '/api/posts/mine', { cookie: writerCookie }), 200);
    assert.equal(mine.posts.length, 1);
    const detail = expectStatus(await jsonRequest(baseUrl, `/api/posts/mine/${created.post.id}`, { cookie: writerCookie }), 200);
    assert.ok(!detail.post.content.includes('<script'));

    expectStatus(await jsonRequest(baseUrl, `/api/posts/${created.post.id}`, {
      method: 'PATCH',
      cookie: writerCookie,
      body: { status: 'review' }
    }), 200);
    expectStatus(await jsonRequest(baseUrl, `/api/posts/${created.post.slug}`), 404);
    expectStatus(await jsonRequest(baseUrl, '/api/admin/posts', { cookie: writerCookie }), 403);

    expectStatus(await jsonRequest(baseUrl, '/api/newsletter', {
      method: 'POST',
      body: { email: 'reader.test@example.com' }
    }), 201);
    expectStatus(await jsonRequest(baseUrl, '/api/newsletter', {
      method: 'POST',
      origin: 'http://evil.example',
      body: { email: 'attacker.test@example.com' }
    }), 403);

    const adminHash = await bcrypt.hash('AdminPassword9', 10);
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, 'admin')
    `).run('Test Admin', 'admin.test@example.com', adminHash);

    const adminLoginResult = await jsonRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: 'admin.test@example.com', password: 'AdminPassword9' }
    });
    const adminLogin = expectStatus(adminLoginResult, 200);
    const adminCookie = cookieFrom(adminLoginResult.response);
    assert.equal(adminLogin.user.role, 'admin');

    const stats = expectStatus(await jsonRequest(baseUrl, '/api/admin/stats', { cookie: adminCookie }), 200);
    assert.equal(stats.pendingPosts, 1);
    assert.equal(stats.publishedPosts, 6);
    assert.equal(stats.writerCount, 1);

    const reviewQueue = expectStatus(await jsonRequest(baseUrl, '/api/admin/posts?status=review', { cookie: adminCookie }), 200);
    assert.equal(reviewQueue.posts.length, 1);
    const published = expectStatus(await jsonRequest(baseUrl, `/api/admin/posts/${created.post.id}/publish`, {
      method: 'PATCH',
      cookie: adminCookie
    }), 200);
    assert.equal(published.post.status, 'published');

    const publicDetail = expectStatus(await jsonRequest(baseUrl, `/api/posts/${created.post.slug}`), 200);
    assert.equal(publicDetail.post.id, created.post.id);

    const logoutResult = await jsonRequest(baseUrl, '/api/auth/logout', {
      method: 'POST',
      cookie: writerCookie
    });
    expectStatus(logoutResult, 200);
    assert.ok(logoutResult.response.headers.get('set-cookie'));
    expectStatus(await jsonRequest(baseUrl, '/api/auth/me'), 401);

    console.info('Prueba de API completada: autenticación, permisos, publicaciones y suscripciones verificados.');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(testDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
