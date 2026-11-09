import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { StartupBoundary } from './components/StartupBoundary';
import './index.css';

createRoot(document.getElementById('root')!, {onCaughtError:()=>console.error('Calendar app-startup-failed')}).render(
  <StrictMode>
    <StartupBoundary><App /></StartupBoundary>
  </StrictMode>,
);
