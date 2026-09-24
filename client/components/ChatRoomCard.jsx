import React from 'react';
import ChatInterface from './ChatInterface';

export default function ChatRoomCard({
  room, action, needsLogin, onMembershipChange, onlineUsers, presenceStatus, socket, currentUserId,
}) {
  return (
    <li aria-busy={!!action?.pending}>
      <div className="room-membership">
        <span>{room.name}{room.isMember && <small> · Joined</small>}</span>
        <button type="button" disabled={needsLogin || !!action?.pending}
          aria-label={`${room.isMember ? 'Leave' : 'Join'} ${room.name}`} onClick={onMembershipChange}>
          {action?.pending ? (room.isMember ? 'Leaving…' : 'Joining…') : (room.isMember ? 'Leave' : 'Join')}
        </button>
      </div>
      {action?.error && <p className="login-error" role="alert">{action.error}</p>}
      {action?.message && <p role="status">{action.message}</p>}
      <ChatInterface room={room} socket={socket} currentUserId={currentUserId}
        onlineUsers={onlineUsers} presenceStatus={presenceStatus} />
    </li>
  );
}
