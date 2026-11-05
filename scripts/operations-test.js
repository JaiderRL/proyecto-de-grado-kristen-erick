const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'byteguard-operations-'));
const root = path.resolve(__dirname, '..');
const databasePath = path.join(directory, 'operations.db');
const env = { ...process.env, NODE_ENV: 'test', DATABASE_PATH: databasePath, JWT_SECRET: crypto.randomBytes(48).toString('hex'), BCRYPT_ROUNDS: '10' };
const password = crypto.randomBytes(16).toString('hex');
const newPassword = crypto.randomBytes(16).toString('hex');
let running;

function accountCommand(reset, secret) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/manage-account.js', ...(reset ? ['--reset'] : [])], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const answers = [ ['Correo de la cuenta: ', 'operator@example.test'], ...(!reset ? [['Nombre visible: ', 'Operador local']] : []), ['Nueva contraseña (no se muestra): ', secret], ['Repite la contraseña: ', secret] ];
    let output = '';
    let step = 0;
    const timeout = setTimeout(() => { child.kill(); reject(new Error('El asistente no respondió.')); }, 10000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (step < answers.length && output.includes(answers[step][0])) child.stdin.write(answers[step++][1] + '\n');
    });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      try {
        assert.equal(code, 0, 'El asistente de cuentas falló.');
        assert.ok(!output.includes(secret), 'La contraseña no debe imprimirse.');
        resolve();
      } catch (error) { reject(error); }
    });
  });
}

function start() {
  return new Promise((resolve, reject) => {
    running = spawn(process.execPath, ['-e', "const {app}=require('./server');const server=app.listen(0,'127.0.0.1',()=>console.log('READY:'+server.address().port));"], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timeout = setTimeout(() => reject(new Error('El servidor no inició.')), 10000);
    running.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/READY:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    running.on('error', reject);
  });
}

async function stop() {
  if (!running) return;
  const child = running;
  running = null;
  await new Promise((resolve) => { child.once('close', resolve); child.kill(); });
}

async function run() {
  try {
    await accountCommand(false, password);
    let base = await start();
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'operator@example.test', password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const create = await fetch(base + '/api/posts', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Persistencia entre procesos', excerpt: 'Este artículo debe persistir después de reiniciar.', content: '<p>Contenido que debe permanecer en disco después de cerrar el proceso.</p>' }) });
    assert.equal(create.status, 201);
    const post = (await create.json()).post;
    await stop();
    base = await start();
    const restored = await fetch(base + `/api/posts/mine/${post.id}`, { headers: { Cookie: cookie } });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).post.title, post.title);
    await accountCommand(true, newPassword);
    assert.equal((await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } })).status, 401);
    const resetLogin = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'operator@example.test', password: newPassword }) });
    assert.equal(resetLogin.status, 200);
    const db = new Database(databasePath, { readonly: true });
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM posts').get().total, 7);
    db.close();
    console.info('Operación: creación y recuperación local de cuentas, contraseña oculta, revocación y persistencia de sesión/artículo tras reiniciar el proceso verificadas.');
  } finally {
    await stop();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
