const fs = require('node:fs');
const path = require('node:path');
const { db } = require('../db/database');

async function run() {
  const directory = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `byteguard-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  try {
    await db.backup(file);
    console.info(`Copia de seguridad creada: ${file}`);
  } finally { db.close(); }
}
run().catch((error) => { console.error('No se pudo crear la copia:', error.message); process.exitCode = 1; });
