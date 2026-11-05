const express = require('express');
const { db } = require('../db/database');
const { normalizeEmail } = require('../utils/content');

const router = express.Router();

router.post('/', (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });

    const existing = db.prepare('SELECT id, active FROM subscriptions WHERE email = ?').get(email);
    if (existing) {
      if (!existing.active) {
        db.prepare(`
          UPDATE subscriptions
          SET active = 1, unsubscribed_at = NULL
          WHERE id = ?
        `).run(existing.id);
      }

      return res.json({
        subscription: { email, active: true },
        message: 'Tu suscripción está activa.'
      });
    }

    db.prepare('INSERT INTO subscriptions (email) VALUES (?)').run(email);
    return res.status(201).json({
      subscription: { email, active: true },
      message: 'Tu suscripción fue registrada.'
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
