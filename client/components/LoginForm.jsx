import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './LoginForm.css';

export default function LoginForm({ onLogin }) {
  const id = useId();
  const submitting = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (new TextEncoder().encode(password).length > 72) {
      setError('Password must be at most 72 UTF-8 bytes.');
      return;
    }
    submitting.current = true;
    setPending(true);
    let loggedInUser;
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to log in. Please try again.');
      }
      if (!data?.user) throw new Error('Unexpected server response. Please try again.');
      loggedInUser = data.user;
      setPassword('');
      setUser(loggedInUser);
    } catch (err) {
      setError(err instanceof TypeError
        ? 'Unable to reach the server. Please try again.'
        : err.message);
    } finally {
      submitting.current = false;
      setPending(false);
    }
    if (loggedInUser) onLogin?.(loggedInUser);
  }

  if (user) {
    return <section className="login-card" role="status">Welcome, {user.username}! You are logged in.</section>;
  }

  return (
    <section className="login-card" aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`}>Log in</h1>
      <p>Welcome back to Chat App.</p>
      <form onSubmit={handleSubmit} aria-busy={pending}>
        <label htmlFor={`${id}-email`}>Email</label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="username"
          required maxLength={254} value={email} disabled={pending}
          onChange={(event) => setEmail(event.target.value)} />

        <label htmlFor={`${id}-password`}>Password</label>
        <input id={`${id}-password`} name="password" type="password" autoComplete="current-password"
          required minLength={8} value={password} disabled={pending}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setPassword(event.target.value)} />

        {error && <p className="login-error" id={`${id}-error`} role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button>
      </form>
      {!pending && <Link className="auth-link" to="/register">Create an account</Link>}
    </section>
  );
}
