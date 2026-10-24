import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT) || 3000;
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET belum diatur. Salin .env.example menjadi .env dan isi secret.');
  process.exit(1);
}

app.listen(port, () => {
  console.log(`TruthCheck API berjalan di http://localhost:${port}`);
});
