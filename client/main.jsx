import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import './style.css';

function App() {
  const [registering, setRegistering] = useState(false);
  return (
    <main>
      {registering
        ? <RegisterForm onShowLogin={() => setRegistering(false)} />
        : <LoginForm onShowRegister={() => setRegistering(true)} />}
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>,
);
