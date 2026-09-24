import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import ChatRoomCard from './ChatRoomCard';
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
  const [actions, setActions] = useState({});
  const [messageSocket, setMessageSocket] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [presence, setPresence] = useState({});
  const [presenceStatus, setPresenceStatus] = useState('Connecting to live updates…');

  useEffect(() => {
    const socket = io({ withCredentials: true });
    setMessageSocket(socket);
    socket.on('session:user', (user) => setCurrentUserId(user.id));
    socket.on('rooms:presence', (snapshot) => {
      setPresence(snapshot);
      setPresenceStatus('');
    });
    const unavailable = () => {
      setPresence({});
      setPresenceStatus('Live user lists are unavailable. Reconnecting…');
    };
    socket.on('disconnect', unavailable);
    socket.on('connect_error', unavailable);
    socket.on('rooms:presence-error', unavailable);
    return () => socket.disconnect();
  }, []);
  const requests = useRef(new Map());
  const busy = Object.values(actions).some((action) => action.pending);

  useEffect(() => () => {
    requests.current.forEach((controller) => controller.abort());
    requests.current.clear();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRooms() {
      setLoading(true);
      setError('');
      setNeedsLogin(false);
      setActions({});
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
          room && typeof room._id === 'string' && typeof room.name === 'string'
          && typeof room.isMember === 'boolean')) {
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

  async function changeMembership(room) {
    if (loading || needsLogin || requests.current.has(room._id)) return;
    const action = room.isMember ? 'leave' : 'join';
    const controller = new AbortController();
    requests.current.set(room._id, controller);
    setActions((current) => ({ ...current, [room._id]: { pending: true } }));
    try {
      const response = await fetch(`/api/chatRooms/${encodeURIComponent(room._id)}/${action}`, {
        method: 'POST', credentials: 'include', signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        setNeedsLogin(true);
        throw new Error('Please log in again to manage your rooms.');
      }
      if (!response.ok) throw new Error(data?.error || `Unable to ${action} this room. Please try again.`);
      if (data?.room?._id !== room._id) throw new Error('Unexpected server response. Refresh the list to check your membership.');
      setRooms((current) => current.map((item) => item._id === room._id
        ? { ...item, isMember: action === 'join' } : item));
      setActions((current) => ({ ...current, [room._id]: {
        pending: false, message: action === 'join' ? 'You joined this room.' : 'You left this room.',
      } }));
    } catch (err) {
      if (controller.signal.aborted) return;
      setActions((current) => ({ ...current, [room._id]: {
        pending: false,
        error: err instanceof TypeError ? 'Unable to reach the server. Please try again.' : err.message,
      } }));
    } finally {
      requests.current.delete(room._id);
    }
  }

  function changePage(nextPage) {
    setLoading(true);
    setPage(nextPage);
  }

  return (
    <section className="login-card room-list" aria-labelledby="rooms-title">
      <h1 id="rooms-title">Available chat rooms</h1>
      {presenceStatus && <p role="status">{presenceStatus}</p>}
      <Link className="auth-link" to="/chatRooms/new">Create a chat room</Link>
      <div aria-busy={loading}>
        {loading && <p role="status">Loading chat rooms…</p>}
        {!loading && error && <p className="login-error" role="alert">{error}</p>}
        {!loading && !error && (rooms.length ? (
          <ul className="room-cards">{rooms.map((room) => (
            <ChatRoomCard key={room._id} room={room} action={actions[room._id]}
              needsLogin={needsLogin} onMembershipChange={() => changeMembership(room)}
              onlineUsers={presence[room._id] || []} presenceStatus={presenceStatus}
              socket={messageSocket} currentUserId={currentUserId} />
          ))}</ul>
        ) : <p role="status">{page === 1 ? 'No chat rooms yet. Create the first one!' : 'No more chat rooms on this page.'}</p>)}
      </div>
      {needsLogin ? <Link className="auth-link" to="/login">Log in</Link> : (
        <nav className="room-list-actions" aria-label="Chat room pages">
          <button type="button" disabled={loading || busy || page === 1} onClick={() => changePage(page - 1)}>Previous</button>
          <span>Page {page}</span>
          <button type="button" disabled={loading || busy || !!error || rooms.length < pageSize || page >= 10000}
            onClick={() => changePage(page + 1)}>Next</button>
          <button type="button" disabled={loading || busy} onClick={() => {
            setLoading(true);
            setRefresh((value) => value + 1);
          }}>{error ? 'Retry' : 'Refresh'}</button>
        </nav>
      )}
    </section>
  );
}
