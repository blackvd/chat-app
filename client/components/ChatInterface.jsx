import React from 'react';
import OnlineUsers from './OnlineUsers';
import RoomMessages from './RoomMessages';

export default function ChatInterface({ room, socket, currentUserId, onlineUsers = [], presenceStatus }) {
  return (
    <section aria-label={`Chat in ${room.name}`}>
      <OnlineUsers users={onlineUsers} roomName={room.name} status={presenceStatus} />
      {room.isMember
        ? <RoomMessages key={room._id} roomId={room._id} socket={socket} currentUserId={currentUserId} />
        : <p>Join this room to read and send messages.</p>}
    </section>
  );
}
