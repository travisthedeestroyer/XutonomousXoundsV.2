import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import cors from 'cors';

const upload = multer({ dest: 'uploads/' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Ensure uploads directory exists
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }

  // API Route for Audio Separation
  app.post('/api/separate', upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      // The URL of your Python FastAPI sidecar
      // In production, this would be the URL of your deployed Python service
      const separatorUrl = process.env.AUDIO_SEPARATOR_URL || 'http://localhost:8000';

      // Forward the file to the Python service
      const formData = new FormData();
      formData.append('file', fs.createReadStream(req.file.path), req.file.originalname);

      console.log(`Sending file to audio separator at ${separatorUrl}/separate`);
      
      const response = await axios.post(`${separatorUrl}/separate`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      // Clean up the local uploaded file
      fs.unlinkSync(req.file.path);

      // Normalize snake_case job_id from Python service to camelCase for the client
      res.json({ ...response.data, jobId: response.data.job_id });
    } catch (error: any) {
      console.error('Error in separation:', error.message);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Failed to process audio separation' });
    }
  });

  // API Route to check status
  app.get('/api/separate/status/:jobId', async (req, res) => {
    try {
      const separatorUrl = process.env.AUDIO_SEPARATOR_URL || 'http://localhost:8000';
      const response = await axios.get(`${separatorUrl}/status/${req.params.jobId}`);
      res.json(response.data);
    } catch (error: any) {
      console.error('Error checking status:', error.message);
      res.status(500).json({ error: 'Failed to check status' });
    }
  });

  // API Route to download stem
  app.get('/api/separate/download/:jobId/:filename', async (req, res) => {
    try {
      const separatorUrl = process.env.AUDIO_SEPARATOR_URL || 'http://localhost:8000';
      const safeFilename = path.basename(req.params.filename);
      const response = await axios.get(`${separatorUrl}/download/${req.params.jobId}/${safeFilename}`, {
        responseType: 'stream'
      });

      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      response.data.pipe(res);
    } catch (error: any) {
      console.error('Error downloading stem:', error.message);
      res.status(500).json({ error: 'Failed to download stem' });
    }
  });

  // API Route for Matchering
  app.post('/api/master', upload.fields([{ name: 'target', maxCount: 1 }, { name: 'reference', maxCount: 1 }]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (!files || !files.target || !files.reference) {
        return res.status(400).json({ error: 'Target and reference audio files are required' });
      }

      const targetFile = files.target[0];
      const referenceFile = files.reference[0];

      const matcheringUrl = process.env.AUDIO_MATCHER_URL || 'http://localhost:8001';

      const formData = new FormData();
      formData.append('target', fs.createReadStream(targetFile.path), targetFile.originalname);
      formData.append('reference', fs.createReadStream(referenceFile.path), referenceFile.originalname);

      console.log(`Sending files to matchering at ${matcheringUrl}/master`);
      
      const response = await axios.post(`${matcheringUrl}/master`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      // Clean up local files
      fs.unlinkSync(targetFile.path);
      fs.unlinkSync(referenceFile.path);

      // Normalize snake_case job_id from Python service to camelCase for the client
      res.json({ ...response.data, jobId: response.data.job_id });
    } catch (error: any) {
      console.error('Error in mastering:', error.message);
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (files?.target?.[0] && fs.existsSync(files.target[0].path)) fs.unlinkSync(files.target[0].path);
      if (files?.reference?.[0] && fs.existsSync(files.reference[0].path)) fs.unlinkSync(files.reference[0].path);
      res.status(500).json({ error: 'Failed to process audio mastering' });
    }
  });

  // API Route to check mastering status
  app.get('/api/master/status/:jobId', async (req, res) => {
    try {
      const matcheringUrl = process.env.AUDIO_MATCHER_URL || 'http://localhost:8001';
      const response = await axios.get(`${matcheringUrl}/status/${req.params.jobId}`);
      res.json(response.data);
    } catch (error: any) {
      console.error('Error checking mastering status:', error.message);
      res.status(500).json({ error: 'Failed to check mastering status' });
    }
  });

  // API Route to download mastered result
  app.get('/api/master/download/:jobId/:filename', async (req, res) => {
    try {
      const matcheringUrl = process.env.AUDIO_MATCHER_URL || 'http://localhost:8001';
      const safeFilename = path.basename(req.params.filename);
      const response = await axios.get(`${matcheringUrl}/download/${req.params.jobId}/${safeFilename}`, {
        responseType: 'stream'
      });

      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      response.data.pipe(res);
    } catch (error: any) {
      console.error('Error downloading mastered file:', error.message);
      res.status(500).json({ error: 'Failed to download mastered file' });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
