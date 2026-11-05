const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const configuredSecret = process.env.JWT_SECRET;
let jwtSecret = configuredSecret;

if (!jwtSecret || jwtSecret.includes('replace-with-')) {
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET debe configurarse con un valor aleatorio en produccion.');
  }

  const secretFile = path.join(__dirname, 'data', '.session-secret');
  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  try {
    fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  jwtSecret = fs.readFileSync(secretFile, 'utf8').trim();
}

const configuredDatabasePath = process.env.DATABASE_PATH || 'data/byteguard.db';
if (nodeEnv === 'production' && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en produccion.');
}
const configuredRounds = Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const bcryptRounds = Number.isInteger(configuredRounds)
  ? Math.min(14, Math.max(10, configuredRounds))
  : 12;

module.exports = {
  bcryptRounds,
  cookieName: 'byteguard_token',
  databasePath: path.isAbsolute(configuredDatabasePath)
    ? configuredDatabasePath
    : path.resolve(__dirname, configuredDatabasePath),
  isProduction: nodeEnv === 'production',
  jwtExpiresIn: '7d',
  jwtSecret,
  nodeEnv,
  port: Number.parseInt(process.env.PORT || '3000', 10) || 3000,
  projectRoot: __dirname
};
