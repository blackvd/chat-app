import React from 'react';

export default function OnlineUsers({ users = [], roomName, status }) {
  if (status) return <p role="status">{status}</p>;
  return (
    <div className="online-users" aria-live="polite">
      <p>Online members: {users.length}</p>
      {users.length ? (
        <ul aria-label={`Online members in ${roomName}`}>
          {users.map((user) => <li key={user.id}>{user.username}</li>)}
        </ul>
      ) : <p>No members online.</p>}
    </div>
  );
}
