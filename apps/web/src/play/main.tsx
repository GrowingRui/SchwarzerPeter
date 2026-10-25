import { createRoot } from 'react-dom/client';
import '../styles.css';
import { App } from './App';

// No StrictMode: the game host streams each step once, and a double-mounted
// table would miss the deal.
createRoot(document.getElementById('root')!).render(<App />);
