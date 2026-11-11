import React, { useState } from 'react';
import { AuthService } from '../services/authService';
import { LogIn, Loader2, AlertCircle, Mail, Phone, KeyRound, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';

type Screen = 'login' | 'recover-contact' | 'recover-otp' | 'recover-success';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.8rem',
  borderRadius: '6px',
  border: '1px solid #1E293B',
  background: '#1E293B',
  color: '#F8FAFC',
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#94A3B8',
  marginBottom: '0.4rem',
  fontSize: '0.875rem',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(13,21,39,0.92)',
  padding: '2rem',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '380px',
  boxShadow: '0 0 40px rgba(20,184,166,0.2)',
  backdropFilter: 'blur(8px)',
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: '6px',
  border: 'none',
  background: '#14B8A6',
  color: '#0A0F1D',
  fontWeight: 700,
  fontSize: '0.95rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#14B8A6',
  cursor: 'pointer',
  fontSize: '0.85rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: 0,
};

function Alert({ msg, type = 'error' }: { msg: string; type?: 'error' | 'success' }) {
  return (
    <div style={{
      background: type === 'success' ? '#065f46' : '#7f1d1d',
      color: '#F8FAFC',
      padding: '0.75rem',
      borderRadius: '8px',
      marginBottom: '1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.875rem',
    }}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      <span>{msg}</span>
    </div>
  );
}

export const LoginPage: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  // ── Login state ───────────────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // ── Recovery state ────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>('login');
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [recToken, setRecToken] = useState('');
  const [recOtpHint, setRecOtpHint] = useState('');   // demo: shown in UI
  const [recoveredUser, setRecoveredUser] = useState('');
  const [recoveredPass, setRecoveredPass] = useState('');
  const [recLoading, setRecLoading] = useState(false);
  const [recMsg, setRecMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setLoginError('Both fields are required'); return; }
    setLoginLoading(true); setLoginError(null);
    const res = await AuthService.login(username, password);
    setLoginLoading(false);
    if (res.success) onSuccess();
    else setLoginError(res.error ?? 'Invalid username or password');
  };

  const handleRecoverRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) { setRecMsg({ text: 'Enter your email or phone number.', type: 'error' }); return; }
    setRecLoading(true); setRecMsg(null);
    const res = await AuthService.recoverRequest(contact.trim());
    setRecLoading(false);
    if (res.success && res.token) {
      setRecToken(res.token);
      setRecOtpHint(res.otp ?? '');   // demo: show OTP directly
      setRecMsg({ text: res.message ?? 'Recovery code sent!', type: 'success' });
      setScreen('recover-otp');
    } else {
      // Even if no match, show generic success (anti-enumeration)
      setRecMsg({ text: 'If this contact is registered, a code has been sent.', type: 'success' });
    }
  };

  const handleRecoverVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) { setRecMsg({ text: 'Enter the recovery code.', type: 'error' }); return; }
    setRecLoading(true); setRecMsg(null);
    const res = await AuthService.recoverVerify(recToken, otp.trim());
    setRecLoading(false);
    if (res.success) {
      setRecoveredUser(res.username ?? '');
      setRecoveredPass(res.password ?? '');
      setScreen('recover-success');
    } else {
      setRecMsg({ text: res.error ?? 'Verification failed.', type: 'error' });
    }
  };

  const goLogin = () => {
    setScreen('login'); setRecMsg(null);
    setContact(''); setOtp(''); setRecToken(''); setRecOtpHint('');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0F1D',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>

      {/* ── LOGIN SCREEN ─────────────────────────────────────────────────── */}
      {screen === 'login' && (
        <form onSubmit={handleLogin} style={cardStyle}>
          <h2 style={{ color: '#F8FAFC', marginBottom: '0.5rem', fontSize: '1.5rem', textAlign: 'center', fontWeight: 800 }}>
            Welcome Back
          </h2>
          <p style={{ color: '#64748B', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            MaintIQ · Predictive Maintenance
          </p>

          {loginError && <Alert msg={loginError} />}

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="username" style={labelStyle}>Username</label>
            <input id="username" type="text" value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loginLoading} style={inputStyle} autoComplete="username" />
          </div>

          <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <input id="password" type={showPwd ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loginLoading}
              style={{ ...inputStyle, paddingRight: '2.5rem' }}
              autoComplete="current-password" />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              style={{ position: 'absolute', right: '0.7rem', top: '2.1rem', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 0 }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button type="submit" disabled={loginLoading} style={{ ...primaryBtn, opacity: loginLoading ? 0.7 : 1 }}>
            {loginLoading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            {loginLoading ? 'Signing in…' : 'Sign In'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <button type="button" onClick={() => { setScreen('recover-contact'); setRecMsg(null); }} style={ghostBtn}>
              <KeyRound size={14} /> Forgot credentials?
            </button>
          </div>
        </form>
      )}

      {/* ── RECOVERY – ENTER CONTACT ──────────────────────────────────────── */}
      {screen === 'recover-contact' && (
        <form onSubmit={handleRecoverRequest} style={cardStyle}>
          <button type="button" onClick={goLogin} style={{ ...ghostBtn, marginBottom: '1.25rem' }}>
            <ArrowLeft size={14} /> Back to Login
          </button>
          <h2 style={{ color: '#F8FAFC', marginBottom: '0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>
            Recover Account
          </h2>
          <p style={{ color: '#64748B', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            Enter the email address or phone number linked to your account. We'll send a recovery code.
          </p>

          {recMsg && <Alert msg={recMsg.text} type={recMsg.type} />}

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Email or Phone Number</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}><Mail size={16} /></span>
              <input type="text" value={contact} onChange={e => setContact(e.target.value)}
                placeholder="name@example.com  or  0000000000"
                style={{ ...inputStyle, flex: 1 }} disabled={recLoading} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem', background: '#0F172A', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', color: '#94A3B8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <Mail size={13} /> <span>Email recovery</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Phone size={13} /> <span>Phone number recovery</span>
            </div>
          </div>

          <button type="submit" disabled={recLoading} style={{ ...primaryBtn, opacity: recLoading ? 0.7 : 1 }}>
            {recLoading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
            {recLoading ? 'Sending Code…' : 'Send Recovery Code'}
          </button>
        </form>
      )}

      {/* ── RECOVERY – ENTER OTP ─────────────────────────────────────────── */}
      {screen === 'recover-otp' && (
        <form onSubmit={handleRecoverVerify} style={cardStyle}>
          <button type="button" onClick={() => { setScreen('recover-contact'); setRecMsg(null); }} style={{ ...ghostBtn, marginBottom: '1.25rem' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <h2 style={{ color: '#F8FAFC', marginBottom: '0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>
            Enter Recovery Code
          </h2>
          <p style={{ color: '#64748B', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
            A 6-digit code was sent to <strong style={{ color: '#94A3B8' }}>{contact}</strong>. Enter it below (valid for 10 minutes).
          </p>

          {/* Demo hint – remove in production */}
          {recOtpHint && (
            <div style={{ background: '#1e3a5f', border: '1px solid #2563eb', borderRadius: '8px', padding: '0.6rem 0.8rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#93c5fd' }}>
              🛠 <strong>Demo mode:</strong> your code is <strong style={{ fontSize: '1.1rem', letterSpacing: '0.15em' }}>{recOtpHint}</strong>
            </div>
          )}

          {recMsg && <Alert msg={recMsg.text} type={recMsg.type} />}

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>6-digit Recovery Code</label>
            <input type="text" inputMode="numeric" maxLength={6} value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000" style={{ ...inputStyle, letterSpacing: '0.3em', fontSize: '1.3rem', textAlign: 'center' }}
              disabled={recLoading} autoFocus />
          </div>

          <button type="submit" disabled={recLoading} style={{ ...primaryBtn, opacity: recLoading ? 0.7 : 1 }}>
            {recLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
            {recLoading ? 'Verifying…' : 'Verify Code'}
          </button>
        </form>
      )}

      {/* ── RECOVERY – SUCCESS ───────────────────────────────────────────── */}
      {screen === 'recover-success' && (
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <CheckCircle2 size={48} color="#14B8A6" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ color: '#F8FAFC', fontSize: '1.3rem', fontWeight: 800 }}>Account Recovered!</h2>
            <p style={{ color: '#64748B', fontSize: '0.85rem', marginTop: '0.3rem' }}>Your credentials are shown below.</p>
          </div>

          <div style={{ background: '#0F172A', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Username</span>
              <span style={{ color: '#F8FAFC', fontWeight: 700, fontFamily: 'monospace' }}>{recoveredUser}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B', fontSize: '0.85rem' }}>Password</span>
              <span style={{ color: '#14B8A6', fontWeight: 700, fontFamily: 'monospace' }}>{recoveredPass}</span>
            </div>
          </div>

          <button onClick={() => { setUsername(recoveredUser); setPassword(recoveredPass); goLogin(); }}
            style={primaryBtn}>
            <LogIn size={18} /> Go to Login
          </button>
        </div>
      )}
    </div>
  );
};
