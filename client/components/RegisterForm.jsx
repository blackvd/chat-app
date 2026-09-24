import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './LoginForm.css';

export default function RegisterForm({ onRegister }) {
  const id = useId();
  const submitting = useRef(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    if (username.trim().length < 2) {
      setError('Username must contain at least 2 characters.');
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('Password is too long. Try a shorter password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    submitting.current = true;
    setPending(true);
    let registeredUser;
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Unable to register. Please try again.');
      if (!data?.user) throw new Error('Unexpected server response. Please try again.');
      registeredUser = data.user;
      setPassword('');
      setConfirmPassword('');
      setUser(registeredUser);
    } catch (err) {
      setError(err instanceof TypeError
        ? 'Unable to reach the server. Please try again.'
        : err.message);
    } finally {
      submitting.current = false;
      setPending(false);
    }
    if (registeredUser) onRegister?.(registeredUser);
  }

  if (user) {
    return (
      <section className="login-card">
        <p role="status">Your account is ready, {user.username}! Log in to continue.</p>
        <Link className="auth-link" to="/login">Go to login</Link>
      </section>
    );
  }

  return (
    <section className="login-card" aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`}>Create an account</h1>
      <p>Join NouchiChat. A little closer, wherever you are.</p>
      <form onSubmit={handleSubmit} aria-busy={pending} aria-describedby={error ? `${id}-error` : undefined}>
        <label htmlFor={`${id}-username`}>Username</label>
        <input id={`${id}-username`} name="username" autoComplete="username"
          required minLength={2} maxLength={50} value={username} disabled={pending}
          onChange={(event) => setUsername(event.target.value)} />

        <label htmlFor={`${id}-email`}>Email</label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="email"
          required maxLength={254} value={email} disabled={pending}
          onChange={(event) => setEmail(event.target.value)} />

        <label htmlFor={`${id}-password`}>Password</label>
        <input id={`${id}-password`} name="password" type="password" autoComplete="new-password"
          required minLength={8} value={password} disabled={pending}
          aria-describedby={`${id}-password-help`}
          onChange={(event) => setPassword(event.target.value)} />
        <small id={`${id}-password-help`}>Use at least 8 characters.</small>

        <label htmlFor={`${id}-confirm`}>Confirm password</label>
        <input id={`${id}-confirm`} name="confirmPassword" type="password" autoComplete="new-password"
          required minLength={8} value={confirmPassword} disabled={pending}
          onChange={(event) => setConfirmPassword(event.target.value)} />

        {error && <p className="login-error" id={`${id}-error`} role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</button>
      </form>
      {!pending && <Link className="auth-link" to="/login">Already have an account? Log in</Link>}
    </section>
  );
}
