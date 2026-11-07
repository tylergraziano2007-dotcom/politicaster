import { useState } from 'react';
import LegacyGame from './components/LegacyGame.jsx';
import Lobby from './components/Lobby.jsx';
import Room from './components/Room.jsx';

export default function App() {
  const [screen, setScreen] = useState({ name: 'solo' });

  if (screen.name === 'lobby') {
    return <Lobby onBack={() => setScreen({ name: 'solo' })} onEnter={(room) => setScreen({ name: 'room', ...room })} />;
  }
  if (screen.name === 'room') {
    return <Room code={screen.code} uid={screen.uid} onLeave={() => setScreen({ name: 'lobby' })} />;
  }
  return <LegacyGame onMultiplayer={() => setScreen({ name: 'lobby' })} />;
}
