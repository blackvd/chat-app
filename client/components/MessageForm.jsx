import React, { useEffect, useId, useRef, useState } from 'react';

export default function MessageForm({ roomId, socket, onSend }) {
  const id = useId();
  const [content, setContent] = useState('');
  const [pending, setPending] = useState(false);
  const [connected, setConnected] = useState(!!socket?.connected);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const sending = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current++;
    sending.current = false;
    setPending(false);
    setContent('');
    setError('');
    setStatus('');
    const connect = () => setConnected(true);
    const disconnect = () => setConnected(false);
    setConnected(!!socket?.connected);
    socket?.on('connect', connect);
    socket?.on('disconnect', disconnect);
    socket?.on('connect_error', disconnect);
    return () => {
      generation.current++;
      socket?.off('connect', connect);
      socket?.off('disconnect', disconnect);
      socket?.off('connect_error', disconnect);
    };
  }, [socket, roomId]);

  function handleSubmit(event) {
    event.preventDefault();
    if (sending.current) return;
    setError('');
    setStatus('');
    const message = content.trim();
    if (!message || message.length > 5000) {
      setError('Enter a message between 1 and 5,000 characters.');
      return;
    }
    if (!socket?.connected) {
      setError('Connect to the server before sending.');
      return;
    }
    sending.current = true;
    setPending(true);
    const currentGeneration = generation.current;
    socket.timeout(10000).emit('message:send', { roomId, content: message }, (err, result) => {
      if (currentGeneration !== generation.current) return;
      sending.current = false;
      setPending(false);
      if (err) {
        setError('Delivery was not confirmed. Your message may have been sent; check before retrying.');
        return;
      }
      if (!result?.ok || !result.message?._id) {
        setError(result?.error || 'Unable to confirm the message. Please check before retrying.');
        return;
      }
      setContent('');
      setStatus('Message sent.');
      onSend?.(result.message);
    });
  }

  return (
    <form className="message-form" onSubmit={handleSubmit} aria-busy={pending}>
      <label htmlFor={`${id}-message`}>Message</label>
      <textarea id={`${id}-message`} name="message" rows={3} required maxLength={5000}
        value={content} disabled={pending} aria-describedby={`${id}-status`}
        onChange={(event) => { setContent(event.target.value); setStatus(''); setError(''); }} />
      <div id={`${id}-status`}>
        {!connected && <p role="status">Messaging is disconnected. Reconnect or log in again to send.</p>}
        {error && <p className="login-error" role="alert">{error}</p>}
        {status && <p role="status">{status}</p>}
      </div>
      <button type="submit" disabled={pending || !connected || !content.trim()}>
        {pending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
