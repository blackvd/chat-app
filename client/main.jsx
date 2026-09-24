import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import CreateChatRoomForm from './components/CreateChatRoomForm';
import ChatRoomList from './components/ChatRoomList';
import './style.css';

function App() {
  return (
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
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>,
);
