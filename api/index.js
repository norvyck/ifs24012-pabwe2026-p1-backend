import app from '../backend/src/app.js';

if (!process.env.JWT_SECRET) {
  console.warn('[TruthCheck] Peringatan: JWT_SECRET belum diatur di environment variables Vercel.');
}

export default app;
