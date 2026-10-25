import { createRoot } from 'react-dom/client';
import { ROOM_CODE } from '@sp/engine/protocol';
import '../styles.css';
import { App } from './App';
import { CreateRoom, OnlineGame, RoomProblem } from './Online';

// ?create=1 makes a room, ?room=CODE joins one, anything else is a practice game.
const params = new URLSearchParams(location.search);
const code = params.get('room')?.trim().toUpperCase();

// No StrictMode: game steps are streamed once, and a double-mounted
// table would miss the deal.
createRoot(document.getElementById('root')!).render(
  params.has('create') ? <CreateRoom /> : code ? ROOM_CODE.test(code) ? <OnlineGame code={code} /> : <RoomProblem code="ROOM_NOT_FOUND" /> : <App />,
);
