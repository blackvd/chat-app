import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './LoginForm.css';
import './ChatRoomList.css';

const pageSize = 20;

export default function ChatRoomList() {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRooms() {
      setLoading(true);
      setError('');
      setNeedsLogin(false);
      try {
        const response = await fetch(`/api/chatRooms?page=${page}&limit=${pageSize}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setNeedsLogin(true);
          throw new Error('Please log in to view available chat rooms.');
        }
        if (!response.ok) throw new Error(data?.error || 'Unable to load chat rooms. Please try again.');
        if (!Array.isArray(data?.rooms) || !data.rooms.every((room) =>
          room && typeof room._id === 'string' && typeof room.name === 'string')) {
          throw new Error('Unexpected server response. Please try again.');
        }
        setRooms(data.rooms);
      } catch (err) {
        if (controller.signal.aborted) return;
        setRooms([]);
        setError(err instanceof TypeError ? 'Unable to reach the server. Please try again.' : err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadRooms();
    return () => controller.abort();
  }, [page, refresh]);

  function changePage(nextPage) {
    setLoading(true);
    setPage(nextPage);
  }

  return (
    <section className="login-card room-list" aria-labelledby="rooms-title">
      <h1 id="rooms-title">Available chat rooms</h1>
      <Link className="auth-link" to="/chatRooms/new">Create a chat room</Link>
      <div aria-busy={loading}>
        {loading && <p role="status">Loading chat rooms…</p>}
        {!loading && error && <p className="login-error" role="alert">{error}</p>}
        {!loading && !error && (rooms.length ? (
          <ul>{rooms.map((room) => <li key={room._id}>{room.name}</li>)}</ul>
        ) : <p role="status">{page === 1 ? 'No chat rooms yet. Create the first one!' : 'No more chat rooms on this page.'}</p>)}
      </div>
      {needsLogin ? <Link className="auth-link" to="/login">Log in</Link> : (
        <nav className="room-list-actions" aria-label="Chat room pages">
          <button type="button" disabled={loading || page === 1} onClick={() => changePage(page - 1)}>Previous</button>
          <span>Page {page}</span>
          <button type="button" disabled={loading || !!error || rooms.length < pageSize || page >= 10000}
            onClick={() => changePage(page + 1)}>Next</button>
          <button type="button" disabled={loading} onClick={() => {
            setLoading(true);
            setRefresh((value) => value + 1);
          }}>{error ? 'Retry' : 'Refresh'}</button>
        </nav>
      )}
    </section>
  );
}
