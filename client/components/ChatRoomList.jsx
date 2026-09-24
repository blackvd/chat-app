import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import ChatInterface from './ChatInterface';
import './ChatWorkspace.css';
import './LoginForm.css';
import './ChatRoomList.css';

const pageSize = 20;

export default function ChatRoomList() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [search, setSearch] = useState('');
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
  // Last message and unread count per room, collected from live messages during this session.
  const [activity, setActivity] = useState({});
  const selectedRoomId = useRef(null);
  const currentUser = useRef(null);
  selectedRoomId.current = selectedRoom?._id || null;
  currentUser.current = currentUserId;

  useEffect(() => {
    if (!messageSocket) return;
    const receive = (message) => {
      if (typeof message?.chatRoom !== 'string' || typeof message.content !== 'string') return;
      const own = !!currentUser.current && message.sender?.id === currentUser.current;
      setActivity((current) => {
        const previous = current[message.chatRoom];
        const unread = message.chatRoom === selectedRoomId.current || own ? 0 : (previous?.unread || 0) + 1;
        return { ...current, [message.chatRoom]: {
          preview: message.content, sender: own ? 'You' : message.sender?.username, at: message.createdAt, unread,
        } };
      });
    };
    messageSocket.on('message:new', receive);
    return () => messageSocket.off('message:new', receive);
  }, [messageSocket]);

  function selectRoom(room) {
    setSelectedRoom(room);
    setActivity((current) => current[room._id]?.unread
      ? { ...current, [room._id]: { ...current[room._id], unread: 0 } } : current);
  }

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
        setSelectedRoom((selected) => {
          const updated = data.rooms.find((room) => room._id === selected?._id);
          return updated ? (updated.isMember ? updated : null) : selected;
        });
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
      setSelectedRoom((selected) => action === 'join' ? { ...room, isMember: true } : (selected?._id === room._id ? null : selected));
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

  const visibleRooms = rooms.filter((room) => room.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  return (
    <section className={`login-card chat-workspace${selectedRoom ? ' conversation-open' : ''}`} aria-label="NouchiChat workspace">
      <aside className="chat-sidebar" aria-label="Chat rooms">
        <header className="sidebar-header">
          <div className="sidebar-title"><h1>Chats</h1>
            <Link className="sidebar-create" to="/chatRooms/new">+ New room</Link></div>
          <label className="visually-hidden" htmlFor="room-search">Filter rooms on this page</label>
          <input id="room-search" type="search" placeholder="Find a room…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </header>
        <div className="sidebar-rooms" aria-busy={loading}>
          {loading && <p role="status">Loading chat rooms…</p>}
          {!loading && error && <p className="login-error" role="alert">{error}</p>}
          {!loading && !error && <ul>{visibleRooms.map((room) => (
            <li key={room._id} className={selectedRoom?._id === room._id ? 'room-row selected' : 'room-row'}>
              <button className="room-select" type="button" disabled={!room.isMember}
                aria-pressed={selectedRoom?._id === room._id} onClick={() => selectRoom(room)}>
                <span className="room-avatar" aria-hidden="true">
                  {Array.from(room.name.trim())[0]?.toUpperCase() || '#'}
                  {!presenceStatus && (presence[room._id] || []).length > 0 && <span className="room-activity-dot" />}
                </span>
                <span className="room-row-body">
                  <span className="room-row-top">
                    <strong>{room.name}</strong>
                    {room.isMember && activity[room._id]?.at && <time dateTime={activity[room._id].at}>
                      {new Date(activity[room._id].at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </time>}
                  </span>
                  <span className="room-row-meta">
                    {room.isMember && activity[room._id]
                      ? `${activity[room._id].sender ? `${activity[room._id].sender}: ` : ''}${activity[room._id].preview}`
                      : `${room.isMember ? 'Joined' : 'Not joined'} · ${presenceStatus ? 'Presence unavailable' : `${(presence[room._id] || []).length} online`}`}
                  </span>
                </span>
                {room.isMember && activity[room._id]?.unread > 0 && <span className="room-unread"
                  aria-label={`${activity[room._id].unread} unread`}>{activity[room._id].unread > 99 ? '99+' : activity[room._id].unread}</span>}
              </button>
              {!room.isMember && <button className="room-join" type="button" disabled={needsLogin || !!actions[room._id]?.pending}
                onClick={() => changeMembership(room)} aria-label={`Join ${room.name}`}>
                {actions[room._id]?.pending ? 'Joining…' : 'Join'}
              </button>}
              {actions[room._id]?.error && <p className="login-error" role="alert">{actions[room._id].error}</p>}
            </li>
          ))}</ul>}
          {!loading && !error && !visibleRooms.length && <p role="status">{search ? 'No matching rooms on this page.' : 'No rooms on this page. Create a room or try the previous page.'}</p>}
        </div>
        <footer className="sidebar-footer">
          {needsLogin ? <Link to="/login">Log in</Link> : <nav className="room-list-actions" aria-label="Chat room pages">
            <button type="button" disabled={loading || busy || page === 1} onClick={() => changePage(page - 1)}>Previous</button>
            <span>Page {page}</span>
            <button type="button" disabled={loading || busy || !!error || rooms.length < pageSize || page >= 10000} onClick={() => changePage(page + 1)}>Next</button>
            <button type="button" disabled={loading || busy} onClick={() => { setLoading(true); setRefresh((value) => value + 1); }}>{error ? 'Retry' : 'Refresh'}</button>
          </nav>}
        </footer>
      </aside>
      <div className="conversation-panel">
        {selectedRoom ? <>
          <header className="conversation-header">
            <button className="back-to-chats" type="button" onClick={() => setSelectedRoom(null)} aria-label="Back to chats">←<span> Chats</span></button>
            <div className="conversation-title"><h2>{selectedRoom.name}</h2><small>Joined · {presenceStatus ? 'Presence unavailable' : `${(presence[selectedRoom._id] || []).length} online`}</small></div>
            <button className="leave-room" type="button" disabled={loading || needsLogin || !!actions[selectedRoom._id]?.pending} onClick={() => changeMembership(selectedRoom)}>
              {actions[selectedRoom._id]?.pending ? 'Leaving…' : 'Leave room'}
            </button>
          </header>
          {actions[selectedRoom._id]?.error && <p className="login-error" role="alert">{actions[selectedRoom._id].error}</p>}
          {needsLogin && <Link className="auth-link" to="/login">Log in again</Link>}
          <ChatInterface key={selectedRoom._id} room={selectedRoom} socket={messageSocket} currentUserId={currentUserId}
            onlineUsers={presence[selectedRoom._id] || []} presenceStatus={presenceStatus} />
        </> : <div className="conversation-empty">
          <span className="conversation-empty-icon" aria-hidden="true">💬</span>
          <h2>NouchiChat</h2>
          <p className="conversation-empty-tagline">Choisis un maquis… euh, un chat 😄</p>
          <p>Select a conversation from the sidebar to start chatting.</p>
        </div>}
      </div>
    </section>
  );
}
