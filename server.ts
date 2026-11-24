import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOtpEnvironment, validateStorageEnvironment } from './server/env.ts';
import { createApiRouter } from './server/routes.ts';

export async function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(express.json({ limit: '16kb' }));
  app.use('/api', createApiRouter());

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  return app;
}

const currentFile = fileURLToPath(import.meta.url);
const isDirectExecution =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(currentFile);

if (isDirectExecution) {
  const port = Number(process.env.PORT ?? 3000);
  const otpStatus = validateOtpEnvironment(process.env);
  const storageStatus = validateStorageEnvironment(process.env);
  if (!otpStatus.valid) {
    console.warn(`[CAN Protection] OTP configuration notice: ${otpStatus.error}`);
  }
  if (!storageStatus.valid) {
    console.warn(`[CAN Protection] Storage configuration notice: ${storageStatus.error}`);
  }
  const app = await createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(
      `CAN Protection server listening on http://localhost:${port} (${otpStatus.valid ? otpStatus.providerName : 'OTP misconfigured'}, storage: ${storageStatus.valid ? storageStatus.backend : 'storage misconfigured'})`,
    );
  });
}
