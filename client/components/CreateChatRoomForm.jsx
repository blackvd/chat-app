import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './LoginForm.css';

export default function CreateChatRoomForm({ onCreate }) {
  const id = useId();
  const submitting = useRef(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [room, setRoom] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    setNeedsLogin(false);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setError('Enter a room name between 1 and 100 characters.');
      return;
    }

    submitting.current = true;
    setPending(true);
    let createdRoom;
    try {
      const response = await fetch('/api/chatRooms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        setNeedsLogin(true);
        throw new Error('Please log in to create a chat room.');
      }
      if (!response.ok) throw new Error(data?.error || 'Unable to create the room. Please try again.');
      if (!data?.room?._id) throw new Error('Unexpected server response. Please try again.');
      createdRoom = data.room;
      setRoom(createdRoom);
      setName('');
    } catch (err) {
      setError(err instanceof TypeError
        ? 'Unable to reach the server. Please try again.'
        : err.message);
    } finally {
      submitting.current = false;
      setPending(false);
    }
    if (createdRoom) onCreate?.(createdRoom);
  }

  if (room) {
    return (
      <section className="login-card">
        <h1>Room created</h1>
        <p role="status">You created “{room.name}” and joined as its first member.</p>
        <button type="button" onClick={() => setRoom(null)}>Create another room</button>
        <Link className="auth-link" to="/chatRooms">Browse chat rooms</Link>
      </section>
    );
  }

  return (
    <section className="login-card" aria-labelledby={`${id}-title`}>
      <h1 id={`${id}-title`}>Create a chat room</h1>
      <p>Choose a name for your conversation.</p>
      <form onSubmit={handleSubmit} aria-busy={pending}>
        <label htmlFor={`${id}-name`}>Room name</label>
        <input id={`${id}-name`} name="name" type="text" required maxLength={100}
          value={name} disabled={pending} aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => setName(event.target.value)} />
        {error && <p id={`${id}-error`} className="login-error" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? 'Creating room…' : 'Create room'}</button>
      </form>
      {needsLogin && <Link className="auth-link" to="/login">Log in</Link>}
      <Link className="auth-link" to="/chatRooms">Back to chat rooms</Link>
    </section>
  );
}
