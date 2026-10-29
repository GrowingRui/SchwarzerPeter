import { createRoot } from 'react-dom/client';
import { ROOM_CODE } from '@sp/engine/protocol';
import '../styles.css';
import { App } from './App';
import { CreateRoom, OnlineGame, QuickMatch, RoomProblem } from './Online';

// ?create=1 makes a room, ?room=CODE joins one, ?quick=1 finds a quick-match
// table (&go=1: straight away), anything else is a practice game.
const params = new URLSearchParams(location.search);
const code = params.get('room')?.trim().toUpperCase();

function Screen() {
  if (code) return ROOM_CODE.test(code) ? <OnlineGame code={code} /> : <RoomProblem code="ROOM_NOT_FOUND" />;
  if (params.has('create')) return <CreateRoom />;
  if (params.has('quick')) return <QuickMatch auto={params.has('go')} />;
  return <App />;
}

// No StrictMode: game steps are streamed once, and a double-mounted
// table would miss the deal.
createRoot(document.getElementById('root')!).render(<Screen />);
