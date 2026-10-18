// سيرفر التطوير المحلي فقط (npm run dev). على Vercel بيتم استخدام api/ بدلًا منه.
import express from 'express';
import path from 'path';
import { adminConfigured, bearerOf, checkAdmin, firebaseApiKey, handleGet, handlePost, resolveAdmin, verifyBearer } from './server/logic.js';
import { createFileStorage } from './server/fileStorage.js';
import { createFirestoreStorage, serviceAccountFromEnv } from './server/firestoreStorage.js';

try {
  process.loadEnvFile('.env'); // تحميل .env محليًا (Node 20.12+)
} catch {
  /* مفيش .env */
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const sa = serviceAccountFromEnv();
const storage = sa ? createFirestoreStorage(sa) : createFileStorage(); // Firestore لو FIREBASE_SERVICE_ACCOUNT مضبوط، وإلا data/tournament.json

app.use(express.json({ limit: '1mb' }));

const header = (req: express.Request, name: string) => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v ?? null;
};
const ctxOf = async (req: express.Request) => {
  const bearer = bearerOf(header(req, 'authorization'));
  return {
    isAdmin: await resolveAdmin({ key: header(req, 'x-admin-key'), bearer }),
    token: header(req, 'x-user-token'),
    uid: (await verifyBearer(bearer))?.uid ?? null,
  };
};

app.get('/api/tournament/data', async (req, res) => {
  try {
    const r = await handleGet(storage, await ctxOf(req));
    res.status(r.status).json(r.json);
  } catch (err) {
    console.error('Load error:', err);
    res.status(500).json({ error: 'Failed to load tournament data' });
  }
});

app.post('/api/tournament/data', async (req, res) => {
  try {
    const r = await handlePost(storage, req.body, await ctxOf(req));
    res.status(r.status).json(r.json);
  } catch (err) {
    console.error('Save error:', err);
    res.status(500).json({ error: 'Failed to update tournament data' });
  }
});

app.post('/api/tournament/auth', async (req, res) => {
  const r = await checkAdmin({
    key: typeof req.body?.key === 'string' ? req.body.key : null,
    bearer: bearerOf(header(req, 'authorization')),
  });
  res.status(r.ok ? 200 : r.reason === 'not_configured' ? 503 : 401).set('Cache-Control', 'no-store').json(r);
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    if (!adminConfigured()) console.log(firebaseApiKey() ? 'تنبيه: ADMIN_EMAILS غير مضبوط، دخول المنظم مقفول.' : 'تنبيه: ADMIN_KEY غير مضبوط، لوحة المنظم مفتوحة محليًا.');
  });
}

startServer();
