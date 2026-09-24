import React from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import CreateChatRoomForm from './components/CreateChatRoomForm';
import ChatRoomList from './components/ChatRoomList';

export default function App() {
  return (
    <>
    <header className="app-header">
      <Link className="app-brand" to="/chatRooms"><span className="app-brand-mark" aria-hidden="true">c</span>Chat App</Link>
      <nav aria-label="Main navigation"><Link to="/chatRooms">Rooms</Link><Link to="/login">Log in</Link></nav>
    </header>
    <main>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/register" element={<RegisterForm />} />
        <Route path="/chatRooms/new" element={<CreateChatRoomForm />} />
        <Route path="/chatRooms" element={<ChatRoomList />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </main>
    </>
  );
}
