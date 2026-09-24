import React from 'react';
import { createRoot } from 'react-dom/client';
import LoginForm from './components/LoginForm';
import './style.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode><main><LoginForm /></main></React.StrictMode>,
);
