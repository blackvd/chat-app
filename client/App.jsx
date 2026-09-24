import React, { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import CreateChatRoomForm from './components/CreateChatRoomForm';
import ChatRoomList from './components/ChatRoomList';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  // null while unknown; the session cookie is httpOnly, so ask a protected endpoint.
  const [loggedIn, setLoggedIn] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/chatRooms?page=1&limit=1', { credentials: 'include', signal: controller.signal })
      .then((response) => {
        if (response.status === 401) setLoggedIn(false);
        else if (response.ok) setLoggedIn(true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [location.pathname]);

  async function logOut() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setLoggedIn(false);
      navigate('/login');
    } catch {
      // Keep the current state; the user can retry.
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
    <header className="app-header">
      <Link className="app-brand" to="/chatRooms"><span className="app-brand-mark" aria-hidden="true">c</span>NouchiChat</Link>
      <nav aria-label="Main navigation">
        <Link to="/chatRooms">Rooms</Link>
        {loggedIn === false && <Link to="/login">Log in</Link>}
        {loggedIn && <button type="button" className="nav-logout" disabled={loggingOut} onClick={logOut}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
          </svg>
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>}
      </nav>
    </header>
    <main>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginForm onLogin={() => setLoggedIn(true)} />} />
        <Route path="/register" element={<RegisterForm />} />
        <Route path="/chatRooms/new" element={<CreateChatRoomForm />} />
        <Route path="/chatRooms" element={<ChatRoomList />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </main>
    </>
  );
}
