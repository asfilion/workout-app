import React, { useEffect } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { useSettingsStore } from './src/stores/settingsStore';
import { useSessionStore } from './src/stores/sessionStore';

export default function App() {
  const loadSettings = useSettingsStore(s => s.loadSettings);
  const loadActiveSession = useSessionStore(s => s.loadActiveSession);

  useEffect(() => {
    loadSettings();
    loadActiveSession();
  }, []);

  return <AppNavigator />;
}
