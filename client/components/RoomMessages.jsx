import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import MessageForm from './MessageForm';
import MessageItem from './MessageItem';

function mergeMessages(current, incoming) {
  const messages = new Map(current.map((message) => [message._id, message]));
  incoming.forEach((message) => messages.set(message._id, message));
  return [...messages.values()].sort((a, b) => a._id.localeCompare(b._id));
}

export default function RoomMessages({ roomId, socket, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [before, setBefore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const request = useRef(null);
  const list = useRef(null);
  const followLatest = useRef(true);
  const previousPosition = useRef(null);
  const seen = useRef(new Set());
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [connected, setConnected] = useState(!!socket?.connected);

  function showLatest() {
    followLatest.current = true;
    setHasNewMessages(false);
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }

  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    if (previousPosition.current) {
      const { height, top } = previousPosition.current;
      element.scrollTop = top + element.scrollHeight - height;
      previousPosition.current = null;
    } else if (followLatest.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

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
      if (cursor && list.current) {
        previousPosition.current = { height: list.current.scrollHeight, top: list.current.scrollTop };
        followLatest.current = false;
      }
      data.messages.forEach((message) => seen.current.add(message._id));
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
        if (!seen.current.has(message._id) && !followLatest.current) setHasNewMessages(true);
        seen.current.add(message._id);
        setMessages((current) => mergeMessages(current, [message]));
      }
    };
    const reload = () => {
      setConnected(!!socket?.connected);
      followLatest.current = true;
      previousPosition.current = null;
      seen.current.clear();
      setHasNewMessages(false);
      setMessages([]);
      setBefore(null);
      loadHistory();
    };
    // Listen first so messages arriving during the history request are retained.
    socket?.on('message:new', receive);
    socket?.on('connect', reload);
    const disconnected = () => setConnected(false);
    socket?.on('disconnect', disconnected);
    socket?.on('connect_error', disconnected);
    reload();
    return () => {
      request.current?.abort();
      socket?.off('message:new', receive);
      socket?.off('connect', reload);
      socket?.off('disconnect', disconnected);
      socket?.off('connect_error', disconnected);
    };
  }, [roomId, socket, retry]);

  return (
    <section className="room-messages" aria-label="Room messages">
      <h2 className="visually-hidden">Messages</h2>
      <p className={`live-status${connected ? '' : ' live-status-off'}`} role="status">{connected ? 'Live messages connected' : 'Live messages disconnected. History is shown below.'}</p>
      {before && <button className="load-older" type="button" disabled={loading} onClick={() => loadHistory(before)}>Load older messages</button>}
      {loading && <p role="status">Loading messages…</p>}
      {error && <div><p className="login-error" role="alert">{error}</p>
        <button type="button" disabled={loading} onClick={() => setRetry((value) => value + 1)}>Reload messages</button>
      </div>}
      {!loading && !error && messages.length === 0 && <p className="messages-empty">Ça dit quoi ? Send the first message.</p>}
      <ol ref={list} className="message-list" role="log" aria-label="Message history" aria-live="polite" tabIndex={0}
        onScroll={() => {
          const element = list.current;
          followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
          if (followLatest.current) setHasNewMessages(false);
        }}>
        {messages.map((message) => (
          <MessageItem key={message._id} message={message} currentUserId={currentUserId} />
        ))}
      </ol>
      {hasNewMessages && <button className="jump-latest" type="button" onClick={showLatest}>New messages — jump to latest</button>}
      <MessageForm roomId={roomId} socket={socket}
        onSend={(message) => {
          seen.current.add(message._id);
          showLatest();
          setMessages((current) => mergeMessages(current, [message]));
        }} />
    </section>
  );
}
