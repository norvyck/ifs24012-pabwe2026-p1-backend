import { useCallback, useEffect, useState } from 'react';

const choices = [
  { value: 'benar', label: 'Benar', icon: '✓', tone: 'green' },
  { value: 'salah', label: 'Salah', icon: '×', tone: 'red' },
  { value: 'menyesatkan', label: 'Menyesatkan', icon: '!', tone: 'amber' },
];

const statusLabels = {
  belum_terbukti: 'Belum terbukti',
  benar: 'Benar',
  salah: 'Salah',
  menyesatkan: 'Menyesatkan',
};

function VoteCounts({ votes }) {
  const totals = Object.fromEntries((votes || []).map((vote) => [vote.vote_type, vote.count]));
  return (
    <div className="vote-counts">
      {choices.map((choice) => (
        <span className={`vote-count ${choice.tone}`} key={choice.value}>
          {choice.label} <b>{totals[choice.value] || 0}</b>
        </span>
      ))}
    </div>
  );
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem('truthcheck-session')) || null;
  } catch {
    return null;
  }
}

async function api(path, { token, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Permintaan tidak berhasil.');
  return data;
}

function currentRoute() {
  return `${window.location.pathname}${window.location.search}` || '/';
}

function navigate(to) {
  if (currentRoute() !== to) {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  }
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function Header({ user, onLogout }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="/" aria-label="TruthCheck beranda">
          <span className="brand-mark">T</span>
          <span>truth<span className="brand-light">check</span></span>
        </a>
        <nav className="nav-links" aria-label="Navigasi utama">
          <a href="/">Jelajahi</a>
          {user && <a href="/submit">Kirim klaim</a>}
          {user && <a href="/dashboard">Klaim saya</a>}
          {user && <a href="/evidence">Tambah bukti</a>}
          {user && <a href="/votes">Riwayat suara</a>}
        </nav>
        <div className="nav-account">
          {user ? (
            <>
              <a className="user-name" href="/profile" title="Buka profil">Halo, {user.name}</a>
              <button className="button button-small button-outline" onClick={onLogout}>Keluar</button>
            </>
          ) : (
            <>
              <a className="nav-login" href="/auth/login">Masuk</a>
              <a className="button button-small" href="/auth/register">Daftar</a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function ErrorMessage({ children }) {
  if (!children) return null;
  return <div className="form-error" role="alert">{children}</div>;
}

function ClaimList({ claims, loading, error, user }) {
  return (
    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> INFORMASI LEBIH JERNIH, BERSAMA</div>
          <h1>Periksa klaim.<br /><span>Temukan faktanya.</span></h1>
          <p>Ruang kolaboratif untuk menguji informasi lewat bukti dan penilaian komunitas.</p>
          <a className="button hero-button" href={user ? '/submit' : '/auth/login?redirect=%2Fsubmit'}>Mulai kirim klaim <span>↗</span></a>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-stamp"><span>✓</span></div>
          <div className="float-card card-top"><span className="mini-icon green">✓</span><div><b>Fakta diperiksa</b><small>bersama komunitas</small></div></div>
          <div className="float-card card-bottom"><span className="mini-icon amber">✳</span><div><b>Bukti terbuka</b><small>untuk semua orang</small></div></div>
          <span className="sparkle sparkle-one">✳</span>
          <span className="sparkle sparkle-two">✦</span>
        </div>
      </section>

      <section className="claims-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">RUANG DISKUSI</div>
            <h2>Klaim terbaru</h2>
          </div>
          <span className="claim-count">{claims.length} klaim</span>
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {loading ? (
          <div className="empty-state">Memuat klaim...</div>
        ) : claims.length === 0 ? (
          <div className="empty-state">Belum ada klaim. Jadilah yang pertama membagikan klaim untuk diperiksa.</div>
        ) : (
          <div className="claim-grid">
            {claims.map((claim) => (
              <a className="claim-card" href={`/claims/${claim.id}`} key={claim.id}>
                <div className="claim-card-top">
                  <span className="claim-tag">KLAIM KOMUNITAS</span>
                  <span className="card-arrow">↗</span>
                </div>
                <h3>{claim.title}</h3>
                <p>{claim.description}</p>
                <div className="claim-vote-summary">
                  <span className={`status-badge status-${claim.status}`}>
                    {statusLabels[claim.status] || statusLabels.belum_terbukti}
                  </span>
                  <span className="total-votes">{claim.total_votes} suara</span>
                </div>
                <VoteCounts votes={claim.votes} />
                <div className="claim-card-footer">
                  <span className="author-avatar">{claim.author?.charAt(0)?.toUpperCase() || '?'}</span>
                  <span>{claim.author || 'Pengguna'}</span>
                  <span className="footer-divider">·</span>
                  <span>{formatDate(claim.created_at)}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ClaimDetail({ id, user, onRequireLogin }) {
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api(`/api/claims/${id}`);
      setClaim(result.claim);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function vote(voteType) {
    if (!user) {
      onRequireLogin();
      return;
    }
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await api(`/api/claims/${id}/votes`, {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({ vote_type: voteType }),
      });
      setNotice('Suara berhasil dicatat. Terima kasih sudah berpartisipasi.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addEvidence(event) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await api(`/api/claims/${id}/evidence`, {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          content: evidenceText,
          ...(evidenceUrl.trim() ? { source_url: evidenceUrl.trim() } : {}),
        }),
      });
      setEvidenceText('');
      setEvidenceUrl('');
      setNotice('Bukti berhasil ditambahkan.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="page narrow"><div className="empty-state">Memuat detail klaim...</div></main>;
  if (error && !claim) return <main className="page narrow"><ErrorMessage>{error}</ErrorMessage><a className="text-link" href="/">← Kembali ke daftar</a></main>;

  const voteTotals = Object.fromEntries((claim.votes || []).map((item) => [item.vote_type, item.count]));

  return (
    <main className="page narrow">
      <a className="back-link" href="/">← Semua klaim</a>
      <article className="detail-card">
        <div className="eyebrow">KLAIM KOMUNITAS</div>
        <h1>{claim.title}</h1>
        <div className="detail-byline">
          <span className="author-avatar">{claim.author?.charAt(0)?.toUpperCase() || '?'}</span>
          <span>Dikirim oleh <b>{claim.author}</b></span><span>·</span><span>{formatDate(claim.created_at)}</span>
        </div>
        <div className="detail-status">
          <span className={`status-badge status-${claim.status}`}>
            {statusLabels[claim.status] || statusLabels.belum_terbukti}
          </span>
          <span>{claim.total_votes} suara terkumpul</span>
        </div>
        <p className="detail-description">{claim.description}</p>
        {claim.source_url && <a className="source-link" href={claim.source_url} target="_blank" rel="noreferrer">Lihat sumber klaim ↗</a>}
        <div className="vote-panel">
          <div className="vote-panel-heading"><h2>Apa penilaianmu?</h2><span>Suaramu membantu komunitas</span></div>
          <div className="vote-options">
            {choices.map((choice) => (
              <button
                className={`vote-button ${choice.tone}`}
                disabled={busy}
                key={choice.value}
                onClick={() => vote(choice.value)}
              >
                <span className={`vote-icon ${choice.tone}`}>{choice.icon}</span>
                <span>{choice.label}</span>
                <b>{voteTotals[choice.value] || 0}</b>
              </button>
            ))}
          </div>
          {!user && <p className="muted-note">Masuk untuk memberikan suara.</p>}
          <p className="muted-note">Status ditentukan mulai 5 suara. Jika suara terbanyak imbang, klaim tetap belum terbukti.</p>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        {notice && <div className="form-success" role="status">{notice}</div>}
      </article>

      <section className="evidence-section">
        <div className="section-heading">
          <div><div className="eyebrow">REFERENSI &amp; SUMBER</div><h2>Bukti pendukung</h2></div>
          <span className="claim-count">{claim.evidence?.length || 0} bukti</span>
        </div>
        {claim.evidence?.length ? (
          <div className="evidence-list">
            {claim.evidence.map((item) => (
              <article className="evidence-card" key={item.id}>
                <span className="evidence-mark">↗</span>
                <div><p>{item.content}</p>
                  <div className="evidence-meta">{item.author} · {formatDate(item.created_at)}
                    {item.source_url && <> · <a href={item.source_url} target="_blank" rel="noreferrer">Buka sumber</a></>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="empty-state">Belum ada bukti. Tambahkan sumber yang bisa membantu memeriksa klaim ini.</div>}

        {user ? (
          <form className="evidence-form" onSubmit={addEvidence}>
            <h3>Tambahkan bukti</h3>
            <label htmlFor="evidence-content">Ringkasan bukti</label>
            <textarea id="evidence-content" maxLength="5000" required value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} placeholder="Jelaskan bukti atau informasi yang relevan..." />
            <label htmlFor="evidence-url">Tautan sumber <span>(opsional)</span></label>
            <input id="evidence-url" type="url" value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="https://..." />
            <button className="button" disabled={busy}>{busy ? 'Mengirim...' : 'Kirim bukti'}</button>
          </form>
        ) : <div className="login-hint">Ingin menambahkan bukti? <a href="/auth/login">Masuk ke akunmu</a></div>}
      </section>
    </main>
  );
}

function AuthPage({ mode, onAuthenticated }) {
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const usernameVal = event.target.elements.username?.value || form.email;
    const passwordVal = event.target.elements.password?.value || form.password;
    try {
      const response = await api(`/api/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          email: usernameVal,
          username: usernameVal,
          password: passwordVal,
        }),
      });
      onAuthenticated(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-decoration"><span className="auth-star">✳</span><span className="auth-orbit" /><span className="auth-quote">“Informasi yang baik<br />dimulai dari rasa ingin tahu.”</span></div>
      <section className="auth-card">
        <a className="back-link" href="/">← Kembali</a>
        <div className="eyebrow">{isRegister ? 'BERGABUNG DENGAN KOMUNITAS' : 'SENANG MELIHATMU KEMBALI'}</div>
        <h1>{isRegister ? 'Buat akun' : 'Masuk ke akun'}</h1>
        <p className="auth-intro">{isRegister ? 'Mari ikut membangun ruang informasi yang lebih jernih.' : 'Lanjutkan kontribusimu untuk informasi yang lebih baik.'}</p>
        <form className="auth-form" onSubmit={submit}>
          {isRegister && (
            <>
              <label htmlFor="name">Nama</label>
              <input id="name" name="name" autoComplete="name" maxLength="100" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nama lengkap" />
            </>
          )}
          <label htmlFor="username">Email / Username</label>
          <input id="username" name="username" type="text" autoComplete="username email" maxLength="254" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nama@email.com atau username" />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={isRegister ? 8 : undefined} maxLength="128" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={isRegister ? 'Minimal 8 karakter' : 'Masukkan password'} />
          <ErrorMessage>{error}</ErrorMessage>
          <button id="btn-submit" type="submit" className="button auth-submit" disabled={busy}>{busy ? 'Memproses...' : isRegister ? 'Buat akun' : 'Masuk'}</button>
        </form>
        <p className="auth-switch">{isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'} <a href={isRegister ? '/auth/login' : '/auth/register'}>{isRegister ? 'Masuk' : 'Daftar sekarang'}</a></p>
      </section>
    </main>
  );
}

function PrivatePage({ eyebrow, title, children }) {
  return (
    <main className="page narrow">
      <div className="private-heading">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>Ruang pribadi untuk kontribusimu di TruthCheck.</p>
      </div>
      {children}
    </main>
  );
}

function MyClaims({ user }) {
  const [claims, setClaims] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/me/claims', { token: user.token })
      .then((result) => setClaims(result.claims))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user.token]);

  return (
    <PrivatePage eyebrow="KONTRIBUSIMU" title="Klaim saya">
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {loading ? <div className="empty-state">Memuat klaim...</div> : claims.length === 0 ? (
        <div className="empty-state">Kamu belum mengirim klaim. <a className="text-link" href="/submit">Kirim klaim pertama</a></div>
      ) : (
        <div className="private-list">
          {claims.map((claim) => (
            <a className="private-list-card" href={`/claims/${claim.id}`} key={claim.id}>
              <div><h2>{claim.title}</h2><p>{claim.description}</p></div>
              <div className="private-list-meta">
                <span className={`status-badge status-${claim.status}`}>{statusLabels[claim.status]}</span>
                <span>{claim.total_votes} suara</span>
              </div>
              <VoteCounts votes={claim.votes} />
            </a>
          ))}
        </div>
      )}
    </PrivatePage>
  );
}

function MyVotes({ user }) {
  const [votes, setVotes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/me/votes', { token: user.token })
      .then((result) => setVotes(result.votes))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user.token]);

  return (
    <PrivatePage eyebrow="SUARA SAYA" title="Riwayat suara">
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {loading ? <div className="empty-state">Memuat riwayat suara...</div> : votes.length === 0 ? (
        <div className="empty-state">Kamu belum memberikan suara pada klaim.</div>
      ) : (
        <div className="private-list">
          {votes.map((vote) => (
            <a className="private-list-card" href={`/claims/${vote.claim_id}`} key={vote.id}>
              <div><h2>{vote.claim.title}</h2><p>Suaramu: <b>{statusLabels[vote.vote_type]}</b> · {formatDate(vote.voted_at)}</p></div>
              <div className="private-list-meta">
                <span className={`status-badge status-${vote.claim.status}`}>{statusLabels[vote.claim.status]}</span>
                <span>{vote.claim.total_votes} suara</span>
              </div>
              <VoteCounts votes={vote.claim.votes} />
            </a>
          ))}
        </div>
      )}
    </PrivatePage>
  );
}

function MyEvidence({ user }) {
  const [claims, setClaims] = useState([]);
  const [claimId, setClaimId] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/claims')
      .then((result) => {
        setClaims(result.claims);
        if (result.claims.length) setClaimId(String(result.claims[0].id));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api(`/api/claims/${claimId}/evidence`, {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          content,
          ...(sourceUrl.trim() ? { source_url: sourceUrl.trim() } : {}),
        }),
      });
      setContent('');
      setSourceUrl('');
      setNotice('Bukti berhasil ditambahkan.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PrivatePage eyebrow="KONTRIBUSI KOMUNITAS" title="Tambahkan bukti">
      {loading ? <div className="empty-state">Memuat daftar klaim...</div> : claims.length === 0 ? (
        <div className="empty-state">Belum ada klaim yang bisa diberi bukti.</div>
      ) : (
        <form className="evidence-form private-form" onSubmit={submit}>
          <label htmlFor="evidence-claim">Pilih klaim</label>
          <select id="evidence-claim" required value={claimId} onChange={(event) => setClaimId(event.target.value)}>
            {claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.title}</option>)}
          </select>
          <label htmlFor="private-evidence-content">Ringkasan bukti</label>
          <textarea id="private-evidence-content" maxLength="5000" required value={content} onChange={(event) => setContent(event.target.value)} placeholder="Jelaskan bukti yang relevan..." />
          <label htmlFor="private-evidence-url">Tautan sumber <span>(opsional)</span></label>
          <input id="private-evidence-url" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." />
          <ErrorMessage>{error}</ErrorMessage>
          {notice && <div className="form-success" role="status">{notice}</div>}
          <button className="button" disabled={busy}>{busy ? 'Mengirim...' : 'Kirim bukti'}</button>
        </form>
      )}
    </PrivatePage>
  );
}

function Profile({ user }) {
  return (
    <PrivatePage eyebrow="AKUN" title="Profil saya">
      <section className="profile-card">
        <span className="profile-avatar">{user.name?.charAt(0)?.toUpperCase() || '?'}</span>
        <div><h2>{user.name}</h2><p>{user.email}</p></div>
      </section>
      <nav className="profile-links" aria-label="Halaman pribadi">
        <a href="/submit">Kirim klaim <span>↗</span></a>
        <a href="/dashboard">Lihat klaim saya <span>↗</span></a>
        <a href="/evidence">Tambahkan bukti <span>↗</span></a>
        <a href="/votes">Riwayat suara <span>↗</span></a>
      </nav>
    </PrivatePage>
  );
}

function SubmitClaim({ user }) {
  const [form, setForm] = useState({ title: '', description: '', source_url: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <main className="page narrow">
        <div className="empty-state">
          Masuk terlebih dahulu untuk mengirim klaim. <a className="text-link" href="/auth/login?redirect=%2Fsubmit">Masuk ke akun</a>
        </div>
      </main>
    );
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await api('/api/claims', {
        method: 'POST',
        token: user.token,
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          ...(form.source_url.trim() ? { source_url: form.source_url.trim() } : {}),
        }),
      });
      navigate(`/claims/${response.claim.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <a className="back-link" href="/">← Semua klaim</a>
      <section className="form-card">
        <div className="eyebrow">MULAI DISKUSI</div>
        <h1>Kirim sebuah klaim</h1>
        <p className="auth-intro">Bagikan informasi yang ingin diperiksa. Komunitas dapat membantu menambahkan bukti dan penilaian.</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="claim-title">Judul klaim</label>
          <input id="claim-title" maxLength="200" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Tulis klaim secara ringkas" />
          <label htmlFor="claim-description">Konteks klaim</label>
          <textarea id="claim-description" maxLength="5000" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Dari mana klaim ini berasal? Tambahkan konteks..." />
          <label htmlFor="claim-source">Tautan sumber <span>(opsional)</span></label>
          <input id="claim-source" type="url" value={form.source_url} onChange={(event) => setForm({ ...form, source_url: event.target.value })} placeholder="https://..." />
          <ErrorMessage>{error}</ErrorMessage>
          <button className="button auth-submit" disabled={busy}>{busy ? 'Mengirim...' : 'Kirim klaim'}</button>
        </form>
      </section>
    </main>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <a className="brand footer-brand" href="/" aria-label="TruthCheck beranda">
          <span className="brand-mark">T</span>
          <span>truth<span className="brand-light">check</span></span>
        </a>
        <span>Periksa dengan rasa ingin tahu. Putuskan dengan bukti.</span>
      </div>
    </footer>
  );
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  const [user, setUser] = useState(readSession);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  useEffect(() => {
    const onLocationChange = () => setRoute(currentRoute());
    window.addEventListener('popstate', onLocationChange);

    const onLinkClick = (event) => {
      const anchor = event.target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (
        !href ||
        href.startsWith('http:') ||
        href.startsWith('https:') ||
        href.startsWith('//') ||
        href.startsWith('#') ||
        anchor.target === '_blank' ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      if (href.startsWith('/')) {
        event.preventDefault();
        navigate(href);
      }
    };

    document.addEventListener('click', onLinkClick);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
      document.removeEventListener('click', onLinkClick);
    };
  }, []);

  useEffect(() => {
    let active = true;
    api('/api/claims')
      .then((result) => { if (active) setClaims(result.claims); })
      .catch((error) => { if (active) setListError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [route]);

  function authenticateUser(response) {
    const session = { ...response.user, token: response.token };
    localStorage.setItem('truthcheck-session', JSON.stringify(session));
    setUser(session);
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    const target = redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
    navigate(target);
  }

  function logout() {
    localStorage.removeItem('truthcheck-session');
    setUser(null);
    navigate('/');
  }

  function requireLogin() {
    navigate(`/auth/login?redirect=${encodeURIComponent(currentRoute())}`);
  }

  const detail = route.match(/^\/claims\/(\d+)$/);
  const privatePages = ['/submit', '/dashboard', '/evidence', '/votes', '/profile'];
  const isPrivatePage = privatePages.includes(route);
  const page = detail ? (
    <ClaimDetail key={detail[1]} id={detail[1]} user={user} onRequireLogin={requireLogin} />
  ) : route === '/auth/login' || route === '/auth/register' ? (
    <AuthPage mode={route === '/auth/login' ? 'login' : 'register'} onAuthenticated={authenticateUser} />
  ) : isPrivatePage && !user ? (
    <main className="page narrow">
      <div className="empty-state">
        Halaman ini hanya untuk pengguna yang masuk. <a className="text-link" href={`/auth/login?redirect=${encodeURIComponent(route)}`}>Masuk untuk melanjutkan</a>
      </div>
    </main>
  ) : route === '/submit' ? (
    <SubmitClaim user={user} />
  ) : route === '/dashboard' ? (
    <MyClaims user={user} />
  ) : route === '/evidence' ? (
    <MyEvidence user={user} />
  ) : route === '/votes' ? (
    <MyVotes user={user} />
  ) : route === '/profile' ? (
    <Profile user={user} />
  ) : (
    <ClaimList claims={claims} loading={loading} error={listError} user={user} />
  );

  return (
    <>
      <Header user={user} onLogout={logout} />
      {page}
      <Footer />
    </>
  );
}
