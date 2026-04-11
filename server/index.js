import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Eta } from 'eta';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './db/client.js';
import { sessionMiddleware } from './middleware/session.js';
import { createRouter } from './router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const eta = new Eta({
  views: path.join(ROOT, 'views'),
  cache: process.env.NODE_ENV === 'production',
});

const app = express();

// Expose eta on app so routes can call res.render
app.use((req, res, next) => {
  res.render = async (template, data = {}) => {
    const html = await eta.renderAsync(template, {
      user: req.user ?? null,
      ...data,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  };
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.static(path.join(ROOT, 'public')));

app.use('/', createRouter());

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).send('<h1>Internal Server Error</h1>');
});

const PORT = process.env.PORT || 3000;

migrate()
  .then(() => app.listen(PORT, () => console.log(`UpList → http://localhost:${PORT}`)))
  .catch(err => { console.error('[boot]', err); process.exit(1); });
