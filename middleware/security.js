function sameOriginForWrites(req, res, next) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  if (req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ error: 'No se permiten solicitudes desde otro sitio.' });
  }

  const origin = req.get('origin');
  if (!origin) return next();

  const expectedOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin !== expectedOrigin) {
    return res.status(403).json({ error: 'No se permiten solicitudes desde otro origen.' });
  }

  return next();
}

module.exports = { sameOriginForWrites };
