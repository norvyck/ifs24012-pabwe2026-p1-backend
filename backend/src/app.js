import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(currentDirectory, '../../frontend/dist');
app.use(express.static(frontendDist));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new HttpError(400, `${field} wajib diisi dan maksimal ${maxLength} karakter.`);
  }
  return value.trim();
}

function optionalUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) {
    throw new HttpError(400, 'source_url harus berupa URL maksimal 2048 karakter.');
  }
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Protokol tidak didukung.');
  } catch {
    throw new HttpError(400, 'source_url harus berupa URL HTTP atau HTTPS yang valid.');
  }
  return value;
}

function validId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'ID tidak valid.');
  return id;
}

function addVoteSummary(claim, counts) {
  const votes = [
    { vote_type: 'benar', count: counts.benar },
    { vote_type: 'salah', count: counts.salah },
    { vote_type: 'menyesatkan', count: counts.menyesatkan },
  ];
  const totalVotes = votes.reduce((total, vote) => total + vote.count, 0);
  const highestCount = Math.max(...votes.map((vote) => vote.count));
  const leaders = votes.filter((vote) => vote.count === highestCount);
  const status = totalVotes < 5 || leaders.length !== 1
    ? 'belum_terbukti'
    : leaders[0].vote_type;

  return { ...claim, status, total_votes: totalVotes, votes };
}

function getVoteCounts(claimId) {
  return db.query(`
    SELECT
      COUNT(CASE WHEN vote_type = 'benar' THEN 1 END) AS benar,
      COUNT(CASE WHEN vote_type = 'salah' THEN 1 END) AS salah,
      COUNT(CASE WHEN vote_type = 'menyesatkan' THEN 1 END) AS menyesatkan
    FROM votes
    WHERE claim_id = ?
  `).get(claimId);
}

function getClaim(id) {
  const claim = db.query(`
    SELECT claims.id, claims.title, claims.description, claims.source_url,
           claims.created_by, users.name AS author, claims.created_at, claims.updated_at
    FROM claims
    JOIN users ON users.id = claims.created_by
    WHERE claims.id = ?
  `).get(id);
  return claim ? addVoteSummary(claim, getVoteCounts(id)) : null;
}

function authenticate(req, res, next) {
  const token = req.get('authorization')?.startsWith('Bearer ')
    ? req.get('authorization').slice(7)
    : null;
  if (!token) return next(new HttpError(401, 'Token autentikasi diperlukan.'));
  if (!process.env.JWT_SECRET) return next(new Error('JWT_SECRET belum diatur.'));

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return next(new HttpError(401, 'Token tidak valid atau sudah kedaluwarsa.'));
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const name = requireText(req.body.name, 'name', 100);
    const email = requireText(req.body.email, 'email', 254).toLowerCase();
    const password = requireText(req.body.password, 'password', 128);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Format email tidak valid.');
    }
    if (password.length < 8) throw new HttpError(400, 'Password minimal 8 karakter.');
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET belum diatur.');

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
    ).run(name, email, passwordHash);
    const user = { id: Number(result.lastInsertRowid), name, email };
    res.status(201).json({
      user,
      token: jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      }),
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return next(new HttpError(409, 'Email sudah terdaftar.'));
    }
    return next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const identifier = requireText(req.body.email || req.body.username, 'email atau username', 254).toLowerCase();
    const password = requireText(req.body.password, 'password', 128);
    const user = db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = ? OR LOWER(name) = ?',
    ).get(identifier, identifier);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, 'Email atau password salah.');
    }
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET belum diatur.');

    const publicUser = { id: user.id, name: user.name, email: user.email };
    res.json({
      user: publicUser,
      token: jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/claims', (req, res) => {
  const rows = db.query(`
    SELECT claims.id, claims.title, claims.description, claims.source_url,
           claims.created_by, users.name AS author, claims.created_at, claims.updated_at,
           COUNT(CASE WHEN votes.vote_type = 'benar' THEN 1 END) AS benar,
           COUNT(CASE WHEN votes.vote_type = 'salah' THEN 1 END) AS salah,
           COUNT(CASE WHEN votes.vote_type = 'menyesatkan' THEN 1 END) AS menyesatkan
    FROM claims
    JOIN users ON users.id = claims.created_by
    LEFT JOIN votes ON votes.claim_id = claims.id
    GROUP BY claims.id
    ORDER BY claims.created_at DESC, claims.id DESC
  `).all();
  const claims = rows.map(({ benar, salah, menyesatkan, ...claim }) =>
    addVoteSummary(claim, { benar, salah, menyesatkan }));
  res.json({ claims });
});

app.get('/api/me/claims', authenticate, (req, res) => {
  const rows = db.query(`
    SELECT claims.id, claims.title, claims.description, claims.source_url,
           claims.created_by, users.name AS author, claims.created_at, claims.updated_at,
           COUNT(CASE WHEN votes.vote_type = 'benar' THEN 1 END) AS benar,
           COUNT(CASE WHEN votes.vote_type = 'salah' THEN 1 END) AS salah,
           COUNT(CASE WHEN votes.vote_type = 'menyesatkan' THEN 1 END) AS menyesatkan
    FROM claims
    JOIN users ON users.id = claims.created_by
    LEFT JOIN votes ON votes.claim_id = claims.id
    WHERE claims.created_by = ?
    GROUP BY claims.id
    ORDER BY claims.created_at DESC, claims.id DESC
  `).all(req.user.id);
  const claims = rows.map(({ benar, salah, menyesatkan, ...claim }) =>
    addVoteSummary(claim, { benar, salah, menyesatkan }));
  res.json({ claims });
});

app.get('/api/me/votes', authenticate, (req, res) => {
  const votes = db.query(`
    SELECT votes.id, votes.claim_id, votes.vote_type, votes.created_at AS voted_at,
           claims.title, claims.description, claims.source_url, claims.created_by,
           users.name AS author,
           COUNT(CASE WHEN all_votes.vote_type = 'benar' THEN 1 END) AS benar,
           COUNT(CASE WHEN all_votes.vote_type = 'salah' THEN 1 END) AS salah,
           COUNT(CASE WHEN all_votes.vote_type = 'menyesatkan' THEN 1 END) AS menyesatkan
    FROM votes
    JOIN claims ON claims.id = votes.claim_id
    JOIN users ON users.id = claims.created_by
    LEFT JOIN votes AS all_votes ON all_votes.claim_id = claims.id
    WHERE votes.user_id = ?
    GROUP BY votes.id
    ORDER BY votes.created_at DESC, votes.id DESC
  `).all(req.user.id).map(({ benar, salah, menyesatkan, ...vote }) => ({
    ...vote,
    claim: addVoteSummary({
      id: vote.claim_id,
      title: vote.title,
      description: vote.description,
      source_url: vote.source_url,
      created_by: vote.created_by,
      author: vote.author,
    }, { benar, salah, menyesatkan }),
  }));
  res.json({ votes });
});

app.get('/api/claims/:id', (req, res, next) => {
  try {
    const id = validId(req.params.id);
    const claim = getClaim(id);
    if (!claim) throw new HttpError(404, 'Klaim tidak ditemukan.');
    claim.evidence = db.query(`
      SELECT evidence.id, evidence.user_id, users.name AS author, evidence.content,
             evidence.source_url, evidence.created_at
      FROM evidence
      JOIN users ON users.id = evidence.user_id
      WHERE evidence.claim_id = ?
      ORDER BY evidence.created_at DESC, evidence.id DESC
    `).all(id);
    res.json({ claim });
  } catch (error) {
    next(error);
  }
});

app.post('/api/claims', authenticate, (req, res, next) => {
  try {
    const title = requireText(req.body.title, 'title', 200);
    const description = requireText(req.body.description, 'description', 5000);
    const sourceUrl = optionalUrl(req.body.source_url);
    const result = db.query(`
      INSERT INTO claims (title, description, source_url, created_by)
      VALUES (?, ?, ?, ?)
    `).run(title, description, sourceUrl, req.user.id);
    res.status(201).json({ claim: getClaim(Number(result.lastInsertRowid)) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/claims/:id', authenticate, (req, res, next) => {
  try {
    const id = validId(req.params.id);
    const claim = getClaim(id);
    if (!claim) throw new HttpError(404, 'Klaim tidak ditemukan.');
    if (claim.created_by !== req.user.id) {
      throw new HttpError(403, 'Hanya pembuat klaim yang dapat mengubahnya.');
    }

    const title = requireText(req.body.title, 'title', 200);
    const description = requireText(req.body.description, 'description', 5000);
    const sourceUrl = optionalUrl(req.body.source_url);
    db.query(`
      UPDATE claims
      SET title = ?, description = ?, source_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, sourceUrl, id);
    res.json({ claim: getClaim(id) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/claims/:id', authenticate, (req, res, next) => {
  try {
    const id = validId(req.params.id);
    const claim = getClaim(id);
    if (!claim) throw new HttpError(404, 'Klaim tidak ditemukan.');
    if (claim.created_by !== req.user.id) {
      throw new HttpError(403, 'Hanya pembuat klaim yang dapat menghapusnya.');
    }
    db.query('DELETE FROM claims WHERE id = ?').run(id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/claims/:id/evidence', authenticate, (req, res, next) => {
  try {
    const claimId = validId(req.params.id);
    if (!getClaim(claimId)) throw new HttpError(404, 'Klaim tidak ditemukan.');
    const content = requireText(req.body.content, 'content', 5000);
    const sourceUrl = optionalUrl(req.body.source_url);
    const result = db.query(`
      INSERT INTO evidence (claim_id, user_id, content, source_url)
      VALUES (?, ?, ?, ?)
    `).run(claimId, req.user.id, content, sourceUrl);
    const evidence = db.query(`
      SELECT evidence.id, evidence.claim_id, evidence.user_id, users.name AS author,
             evidence.content, evidence.source_url, evidence.created_at
      FROM evidence
      JOIN users ON users.id = evidence.user_id
      WHERE evidence.id = ?
    `).get(Number(result.lastInsertRowid));
    res.status(201).json({ evidence });
  } catch (error) {
    next(error);
  }
});

app.post('/api/claims/:id/votes', authenticate, (req, res, next) => {
  try {
    const claimId = validId(req.params.id);
    if (!getClaim(claimId)) throw new HttpError(404, 'Klaim tidak ditemukan.');
    const voteType = req.body.vote_type;
    if (!['benar', 'salah', 'menyesatkan'].includes(voteType)) {
      throw new HttpError(400, 'vote_type harus benar, salah, atau menyesatkan.');
    }
    const result = db.query(`
      INSERT INTO votes (claim_id, user_id, vote_type)
      VALUES (?, ?, ?)
    `).run(claimId, req.user.id, voteType);
    res.status(201).json({
      vote: {
        id: Number(result.lastInsertRowid),
        claim_id: claimId,
        user_id: req.user.id,
        vote_type: voteType,
      },
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return next(new HttpError(409, 'Anda sudah memberikan suara untuk klaim ini.'));
    }
    return next(error);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
});

app.get('*', (req, res, next) => {
  const indexPath = path.join(frontendDist, 'index.html');
  if (existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return next();
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Body JSON tidak valid.' });
  }
  console.error(error);
  return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

export default app;
