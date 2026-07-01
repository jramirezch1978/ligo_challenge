import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../api/types';

export function LoginPage() {
  const { login } = useAuth();
  const { notify } = useToast();
  const [username, setUsername] = useState('senior.backend');
  const [password, setPassword] = useState('Password123');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await login(username, password);
      notify('success', 'Sesion iniciada correctamente');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'No se pudo iniciar sesion';
      notify('error', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <span className="brand-mark">L</span>
          <div>
            <h1>Ligo Wallet</h1>
            <p>Transaction Service</p>
          </div>
        </div>

        <label className="field">
          <span>Usuario</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>

        <label className="field">
          <span>Contrasena</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p className="login-card__hint">Credenciales demo: senior.backend / Password123</p>
      </form>
    </div>
  );
}
