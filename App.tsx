import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import DatabaseErrorScreen from './src/screens/DatabaseErrorScreen';
import { useDbStore } from './src/stores/dbStore';
import { useSettingsStore } from './src/stores/settingsStore';
import { useSessionStore } from './src/stores/sessionStore';

export default function App() {
  const status = useDbStore(s => s.status);
  const initialize = useDbStore(s => s.initialize);
  const loadSettings = useSettingsStore(s => s.loadSettings);
  const loadActiveSession = useSessionStore(s => s.loadActiveSession);

  useEffect(() => {
    initialize();
  }, []);

  // Screens query the database as soon as they mount, so nothing loads until the
  // database is confirmed usable.
  useEffect(() => {
    if (status !== 'ready') return;
    loadSettings();
    loadActiveSession();
  }, [status]);

  if (status === 'error') return <DatabaseErrorScreen />;

  if (status === 'initializing') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <AppNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
});
