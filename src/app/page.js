'use client';

import { MqttProvider } from './components/MqttProviderMock';
import Avatar from './components/Avatar';

export default function Home() {
  return (
    <MqttProvider>
        <Avatar />
    </MqttProvider>
  );
}

