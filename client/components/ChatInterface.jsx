import React from 'react';
import OnlineUsers from './OnlineUsers';
import RoomMessages from './RoomMessages';

export default function ChatInterface({ room, socket, currentUserId, onlineUsers = [], presenceStatus }) {
  return (
    <section className="chat-interface" aria-label={`Chat in ${room.name}`}>
      <details className="conversation-members"><summary>Online members ({onlineUsers.length})</summary><OnlineUsers users={onlineUsers} roomName={room.name} status={presenceStatus} /></details>
      {room.isMember
        ? <RoomMessages key={room._id} roomId={room._id} socket={socket} currentUserId={currentUserId} />
        : <p>Join this room to read and send messages.</p>}
    </section>
  );
}
