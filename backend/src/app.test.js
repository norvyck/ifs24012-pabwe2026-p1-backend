import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const testDirectory = mkdtempSync(path.join(tmpdir(), 'truthcheck-test-'));
process.env.DATABASE_PATH = path.join(testDirectory, 'test.db');
process.env.JWT_SECRET = 'test-secret-yang-cukup-panjang';

const [{ default: app }, { db }] = await Promise.all([
  import('./app.js'),
  import('./db.js'),
]);

let server;
let baseUrl;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  db.close();
  rmSync(testDirectory, { recursive: true, force: true });
});

async function request(url, options = {}) {
  return fetch(`${baseUrl}${url}`, options);
}

function json(body, token) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  };
}

describe('TruthCheck API', () => {
  test('mendaftarkan pengguna, menyimpan hash password, dan menerima login', async () => {
    const registration = await request('/api/auth/register', json({
      name: 'Pengguna Tes',
      email: 'tes@example.com',
      password: 'password-aman',
    }));
    expect(registration.status).toBe(201);
    const registered = await registration.json();
    expect(registered.token).toBeString();
    expect(db.query('SELECT password_hash FROM users WHERE email = ?')
      .get('tes@example.com').password_hash).not.toBe('password-aman');

    const login = await request('/api/auth/login', json({
      email: 'tes@example.com',
      password: 'password-aman',
    }));
    expect(login.status).toBe(200);
    expect((await login.json()).token).toBeString();
  });

  test('mengelola klaim dan bukti, serta menolak suara kedua dari pengguna yang sama', async () => {
    const authResponse = await request('/api/auth/register', json({
      name: 'Pemilik Tes',
      email: 'pemilik@example.com',
      password: 'password-aman',
    }));
    const { token } = await authResponse.json();

    const create = await request('/api/claims', json({
      title: 'Klaim untuk tes',
      description: 'Deskripsi tes',
    }, token));
    expect(create.status).toBe(201);
    const claimId = (await create.json()).claim.id;

    const update = await request(`/api/claims/${claimId}`, {
      ...json({ title: 'Klaim diperbarui', description: 'Deskripsi baru' }, token),
      method: 'PUT',
    });
    expect(update.status).toBe(200);

    const evidence = await request(`/api/claims/${claimId}/evidence`, json({
      content: 'Bukti untuk klaim tes',
      source_url: 'https://example.com/bukti',
    }, token));
    expect(evidence.status).toBe(201);

    const firstVote = await request(`/api/claims/${claimId}/votes`, json({
      vote_type: 'benar',
    }, token));
    expect(firstVote.status).toBe(201);

    const secondVote = await request(`/api/claims/${claimId}/votes`, json({
      vote_type: 'salah',
    }, token));
    expect(secondVote.status).toBe(409);

    const detail = await request(`/api/claims/${claimId}`);
    const claim = (await detail.json()).claim;
    expect(claim.title).toBe('Klaim diperbarui');
    expect(claim.evidence).toHaveLength(1);
    expect(claim.votes).toEqual([
      { vote_type: 'benar', count: 1 },
      { vote_type: 'salah', count: 0 },
      { vote_type: 'menyesatkan', count: 0 },
    ]);

    const myClaimsResponse = await request('/api/me/claims', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(myClaimsResponse.status).toBe(200);
    expect((await myClaimsResponse.json()).claims.map((item) => item.id)).toContain(claimId);

    const myVotesResponse = await request('/api/me/votes', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(myVotesResponse.status).toBe(200);
    const myVotes = (await myVotesResponse.json()).votes;
    expect(myVotes).toHaveLength(1);
    expect(myVotes[0].claim.id).toBe(claimId);
    expect(myVotes[0].vote_type).toBe('benar');

    const deletion = await request(`/api/claims/${claimId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deletion.status).toBe(204);
    expect((await request(`/api/claims/${claimId}`)).status).toBe(404);
  });

  test('melarang pengguna lain mengubah klaim', async () => {
    const ownerResponse = await request('/api/auth/register', json({
      name: 'Pemilik Dua',
      email: 'pemilik-dua@example.com',
      password: 'password-aman',
    }));
    const owner = await ownerResponse.json();
    const claimResponse = await request('/api/claims', json({
      title: 'Klaim pemilik dua',
      description: 'Deskripsi',
    }, owner.token));
    const claimId = (await claimResponse.json()).claim.id;

    const otherResponse = await request('/api/auth/register', json({
      name: 'Pengguna Lain',
      email: 'lain@example.com',
      password: 'password-aman',
    }));
    const other = await otherResponse.json();
    const update = await request(`/api/claims/${claimId}`, {
      ...json({ title: 'Diubah', description: 'Tidak boleh' }, other.token),
      method: 'PUT',
    });
    expect(update.status).toBe(403);
  });

  test('menghitung status dari ambang 5 suara dan mengembalikan hitungan lengkap', async () => {
    const voterIds = Array.from({ length: 5 }, (_, index) => {
      const result = db.query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      ).run(`Pemilih ${index}`, `pemilih-status-${index}@example.com`, 'hash-tes');
      return Number(result.lastInsertRowid);
    });
    const ownerId = db.query('SELECT id FROM users WHERE email = ?')
      .get('ani@example.com').id;

    function createClaimWithVotes(title, voteTypes) {
      const claimResult = db.query(`
        INSERT INTO claims (title, description, created_by)
        VALUES (?, ?, ?)
      `).run(title, 'Klaim untuk menguji status.', ownerId);
      const claimId = Number(claimResult.lastInsertRowid);
      voteTypes.forEach((voteType, index) => {
        db.query(`
          INSERT INTO votes (claim_id, user_id, vote_type)
          VALUES (?, ?, ?)
        `).run(claimId, voterIds[index], voteType);
      });
      return claimId;
    }

    const belowThresholdId = createClaimWithVotes(
      'Status di bawah ambang',
      ['benar', 'benar', 'benar', 'salah'],
    );
    const majorityId = createClaimWithVotes(
      'Status dengan mayoritas',
      ['benar', 'benar', 'benar', 'salah', 'menyesatkan'],
    );
    const tiedId = createClaimWithVotes(
      'Status dengan suara imbang',
      ['benar', 'benar', 'salah', 'salah', 'menyesatkan'],
    );

    const listResponse = await request('/api/claims');
    const claims = (await listResponse.json()).claims;
    const belowThreshold = claims.find((claim) => claim.id === belowThresholdId);
    const majority = claims.find((claim) => claim.id === majorityId);
    const tied = claims.find((claim) => claim.id === tiedId);

    expect(belowThreshold.status).toBe('belum_terbukti');
    expect(belowThreshold.total_votes).toBe(4);
    expect(belowThreshold.votes).toEqual([
      { vote_type: 'benar', count: 3 },
      { vote_type: 'salah', count: 1 },
      { vote_type: 'menyesatkan', count: 0 },
    ]);
    expect(majority.status).toBe('benar');
    expect(majority.total_votes).toBe(5);
    expect(tied.status).toBe('belum_terbukti');

    const detailResponse = await request(`/api/claims/${tiedId}`);
    const detail = (await detailResponse.json()).claim;
    expect(detail.status).toBe('belum_terbukti');
    expect(detail.total_votes).toBe(5);
    expect(detail.votes).toEqual([
      { vote_type: 'benar', count: 2 },
      { vote_type: 'salah', count: 2 },
      { vote_type: 'menyesatkan', count: 1 },
    ]);
  });
});
