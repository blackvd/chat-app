import React, { useEffect, useRef, useState } from 'react';
import MessageForm from './MessageForm';

function mergeMessages(current, incoming) {
  const messages = new Map(current.map((message) => [message._id, message]));
  incoming.forEach((message) => messages.set(message._id, message));
  return [...messages.values()].sort((a, b) => a._id.localeCompare(b._id));
}

export default function RoomMessages({ roomId, socket }) {
  const [messages, setMessages] = useState([]);
  const [before, setBefore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const request = useRef(null);

  async function loadHistory(cursor) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ limit: '50' });
      if (cursor) query.set('before', cursor);
      const response = await fetch(`/api/chatRooms/${encodeURIComponent(roomId)}/messages?${query}`, {
        credentials: 'include', signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data?.error || 'Unable to load messages.');
      if (!Array.isArray(data?.messages) || !data.messages.every((message) =>
        message && typeof message._id === 'string' && message.chatRoom === roomId && typeof message.content === 'string')) {
        throw new Error('Unexpected message history response.');
      }
      setMessages((current) => mergeMessages(current, data.messages));
      setBefore(data.nextBefore || null);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof TypeError
        ? 'Unable to reach the server. Please retry.' : err.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const receive = (message) => {
      if (message?.chatRoom === roomId && typeof message._id === 'string' && typeof message.content === 'string') {
        setMessages((current) => mergeMessages(current, [message]));
      }
    };
    const reload = () => {
      setMessages([]);
      setBefore(null);
      loadHistory();
    };
    // Listen first so messages arriving during the history request are retained.
    socket?.on('message:new', receive);
    socket?.on('connect', reload);
    reload();
    return () => {
      request.current?.abort();
      socket?.off('message:new', receive);
      socket?.off('connect', reload);
    };
  }, [roomId, socket, retry]);

  return (
    <section className="room-messages" aria-label="Room messages">
      <h2>Messages</h2>
      {before && <button type="button" disabled={loading} onClick={() => loadHistory(before)}>Load older messages</button>}
      {loading && <p role="status">Loading messages…</p>}
      {error && <div><p className="login-error" role="alert">{error}</p>
        <button type="button" disabled={loading} onClick={() => setRetry((value) => value + 1)}>Reload messages</button>
      </div>}
      {!loading && !error && messages.length === 0 && <p>No messages yet. Start the conversation!</p>}
      <ol className="message-list" role="log" aria-label="Message history" aria-live="polite" tabIndex={0}>
        {messages.map((message) => (
          <li key={message._id}>
            <strong>{message.sender?.username || 'Deleted user'}</strong>
            {message.createdAt && <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>}
            <p>{message.content}</p>
          </li>
        ))}
      </ol>
      <MessageForm roomId={roomId} socket={socket}
        onSend={(message) => setMessages((current) => mergeMessages(current, [message]))} />
    </section>
  );
}
