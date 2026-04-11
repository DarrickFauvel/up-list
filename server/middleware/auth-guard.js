export function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.headers.accept?.includes('text/event-stream') ||
        req.headers['content-type']?.includes('application/json')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.redirect(`/auth/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}
