import React from 'react';

export default function MessageItem({ message, currentUserId }) {
  const username = message.sender?.username || 'Deleted user';
  const own = !!currentUserId && message.sender?.id === currentUserId;
  const initials = username.trim().split(/\s+/).slice(0, 2)
    .map((part) => Array.from(part)[0] || '').join('').toUpperCase();
  const date = message.createdAt ? new Date(message.createdAt) : null;
  const validDate = date && !Number.isNaN(date.getTime());

  return (
    <li className={`chat-message${own ? ' chat-message-own' : ''}`}>
      <span className="message-avatar" aria-hidden="true">{message.sender ? initials : '?'}</span>
      <div className="message-bubble">
        <div className="message-header">
          <strong>{username}{own && <span className="message-you"> (You)</span>}</strong>
          {validDate ? (
            <time dateTime={date.toISOString()} title={date.toLocaleString()}
              aria-label={`Sent ${date.toLocaleString()}`}>
              {date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </time>
          ) : <span className="message-time-missing">Time unavailable</span>}
        </div>
        <p>{message.content}</p>
      </div>
    </li>
  );
}
