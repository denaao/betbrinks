'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function LoginPage() {
  const router = useRouter();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/admin/backoffice-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: cpf.replace(/\D/g, ''),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : (data.message || 'Erro ao fazer login.');
        throw new Error(msg);
      }

      const res = data.data || data;

      localStorage.setItem('admin_token', res.token);
      localStorage.setItem('admin_user', JSON.stringify(res.user));
      localStorage.setItem('admin_role', JSON.stringify({
        isAdmin: res.isAdmin,
        isAffiliate: res.isAffiliate,
        isOwner: res.isOwner || false,
        affiliates: res.affiliates || [],
      }));

      if (res.isAffiliate && !res.isAdmin && !res.isOwner) {
        router.push('/affiliate');
      } else if (res.isAdmin) {
        router.push('/dashboard');
      } else {
        router.push('/dashboard/owner');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #0B1120 0%, #141E30 50%, #1A2540 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle background glow */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,149,106,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '420px', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <img
            src="/logo.png"
            alt="BetBrinks"
            style={{
              width: '160px',
              height: '160px',
              margin: '0 auto 20px',
              borderRadius: '28px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))',
            }}
          />
          <p style={{ color: 'rgba(196,149,106,0.6)', fontSize: '13px', fontWeight: '500', letterSpacing: '1px' }}>
            PAINEL ADMINISTRATIVO
          </p>
        </div>

        {/* Login Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(26,37,64,0.8) 0%, rgba(20,30,48,0.9) 100%)',
            borderRadius: '20px',
            padding: '36px 32px',
            border: '1px solid rgba(196,149,106,0.12)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#FCA5A5',
                  fontSize: '13px',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                CPF
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                required
                style={{
                  width: '100%',
                  height: '52px',
                  background: 'rgba(15,23,42,0.6)',
                  border: '1.5px solid rgba(196,149,106,0.2)',
                  borderRadius: '12px',
                  padding: '0 16px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(196,149,106,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(196,149,106,0.2)')}
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                SENHA
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                required
                style={{
                  width: '100%',
                  height: '52px',
                  background: 'rgba(15,23,42,0.6)',
                  border: '1.5px solid rgba(196,149,106,0.2)',
                  borderRadius: '12px',
                  padding: '0 16px',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(196,149,106,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(196,149,106,0.2)')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '52px',
                background: loading
                  ? 'rgba(196,149,106,0.4)'
                  : 'linear-gradient(135deg, #C4956A 0%, #A87D5A 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: '700',
                fontFamily: 'inherit',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(196,149,106,0.3)',
                letterSpacing: '0.5px',
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.15)',
            fontSize: '12px',
            marginTop: '32px',
          }}
        >
          betbrinks &copy; {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder {
          color: rgba(255,255,255,0.25);
        }
      `}</style>
    </div>
  );
}
