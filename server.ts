import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { router as apiRouter } from './server/routes';

async function startServer() {
  const app = express();
  // Support dynamic PORT assigned by Render, Cloud Run, or local default 3000
  const PORT = Number(process.env.PORT) || 3000;

  // CORS Middleware for external deployments (e.g. Render, custom domain, mobile web)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Middleware for parsing JSON with support for customer photos (base64)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'mustari-gps-backend', time: new Date().toISOString() });
  });

  // Mount API routes BEFORE Vite middleware
  app.use('/api', apiRouter);

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Məkan Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
