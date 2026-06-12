// Xounds Studio — unified dev/prod server.
// Serves the Vite app and proxies heavy audio jobs (stem separation,
// reference mastering) to the Python sidecar services.

import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import cors from 'cors';
import 'dotenv/config';

const PORT = Number(process.env.PORT) || 3000;
const upload = multer({ dest: 'uploads/' });

interface Sidecar {
  /** Mount point under /api */
  route: string;
  /** Base URL of the Python service */
  baseUrl: string;
  /** POST endpoint on the sidecar that starts a job */
  startPath: string;
  /** Multer fields expected on the start request */
  fields: { name: string; maxCount: number }[];
}

const SIDECARS: Sidecar[] = [
  {
    route: 'separate',
    baseUrl: process.env.AUDIO_SEPARATOR_URL || 'http://localhost:8000',
    startPath: '/separate',
    fields: [{ name: 'audio', maxCount: 1 }],
  },
  {
    route: 'master',
    baseUrl: process.env.AUDIO_MATCHER_URL || 'http://localhost:8001',
    startPath: '/master',
    fields: [
      { name: 'target', maxCount: 1 },
      { name: 'reference', maxCount: 1 },
    ],
  },
];

function cleanupFiles(files: Express.Multer.File[]) {
  for (const f of files) {
    try {
      if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    } catch {
      /* best effort */
    }
  }
}

function mountSidecar(app: express.Express, sc: Sidecar) {
  // Start a job: forward multipart upload(s) to the sidecar.
  app.post(`/api/${sc.route}`, upload.fields(sc.fields), async (req: Request, res: Response) => {
    const fileMap = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const received = sc.fields.flatMap((f) => fileMap[f.name] ?? []);
    const missing = sc.fields.filter((f) => !fileMap[f.name]?.length);
    if (missing.length) {
      cleanupFiles(received);
      return res.status(400).json({ error: `Missing file field(s): ${missing.map((m) => m.name).join(', ')}` });
    }
    try {
      const formData = new FormData();
      for (const field of sc.fields) {
        const file = fileMap[field.name][0];
        // The mastering sidecar expects its own field names; the separator expects "file".
        const sidecarField = sc.route === 'separate' ? 'file' : field.name;
        formData.append(sidecarField, fs.createReadStream(file.path), file.originalname);
      }
      const response = await axios.post(`${sc.baseUrl}${sc.startPath}`, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
      });
      // Normalize snake_case job_id from Python to camelCase for the client.
      res.json({ ...response.data, jobId: response.data.job_id });
    } catch (err) {
      console.error(`[${sc.route}] start failed:`, err instanceof Error ? err.message : err);
      res.status(502).json({ error: `${sc.route} service unavailable` });
    } finally {
      cleanupFiles(received);
    }
  });

  // Poll job status.
  app.get(`/api/${sc.route}/status/:jobId`, async (req, res) => {
    try {
      const response = await axios.get(`${sc.baseUrl}/status/${encodeURIComponent(req.params.jobId)}`);
      res.json(response.data);
    } catch (err) {
      console.error(`[${sc.route}] status failed:`, err instanceof Error ? err.message : err);
      res.status(502).json({ error: `Failed to check ${sc.route} status` });
    }
  });

  // Stream a result file back to the client.
  app.get(`/api/${sc.route}/download/:jobId/:filename`, async (req, res) => {
    try {
      const safeName = path.basename(req.params.filename);
      const response = await axios.get(
        `${sc.baseUrl}/download/${encodeURIComponent(req.params.jobId)}/${encodeURIComponent(safeName)}`,
        { responseType: 'stream' },
      );
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      response.data.pipe(res);
    } catch (err) {
      console.error(`[${sc.route}] download failed:`, err instanceof Error ? err.message : err);
      res.status(502).json({ error: `Failed to download ${sc.route} result` });
    }
  });
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

  for (const sc of SIDECARS) mountSidecar(app, sc);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    const dist = path.resolve(__dirname);
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`Xounds Studio running at http://localhost:${PORT} (${isProd ? 'prod' : 'dev'})`);
  });
}

startServer();
