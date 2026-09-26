import app from '../server/app.js';

export default function handler(req, res) {
  try {
    return app(req, res);
  } catch (err) {
    console.error('[Vercel Serverless Function Crash]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Serverless invocation error' });
    }
  }
}
