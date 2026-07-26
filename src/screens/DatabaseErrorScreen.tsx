import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useDbStore } from '../stores/dbStore';
import { formatBackupDate } from '../db/backup';

export default function DatabaseErrorScreen() {
  const { error, backup, initialize, restore } = useDbStore();
  const [busy, setBusy] = useState(false);

  async function handleRetry() {
    setBusy(true);
    try {
      await initialize();
    } finally {
      setBusy(false);
    }
  }

  function handleRestore() {
    if (!backup) return;
    Alert.alert(
      'Restore from Backup',
      `This replaces the current database with the snapshot from ${formatBackupDate(
        backup.createdAt
      )} (${backup.sessionCount} sessions, ${backup.setCount} sets). Anything recorded after that point is lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await restore();
            } catch (err) {
              Alert.alert('Restore Failed', String(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Couldn't open your data</Text>
        <Text style={styles.body}>
          The app couldn't start the workout database. Your data has not been deleted — it's still on
          this device.
        </Text>

        <View style={styles.errorCard}>
          <Text style={styles.errorLabel}>Details</Text>
          <Text style={styles.errorText}>{error ?? 'Unknown error'}</Text>
        </View>

        <TouchableOpacity
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={handleRetry}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Try Again</Text>}
        </TouchableOpacity>

        {backup ? (
          <>
            <TouchableOpacity
              style={[styles.button, styles.restoreButton, busy && styles.buttonDisabled]}
              onPress={handleRestore}
              disabled={busy}
            >
              <Text style={styles.buttonText}>Restore from Backup</Text>
            </TouchableOpacity>
            <Text style={styles.caption}>
              Snapshot from {formatBackupDate(backup.createdAt)} — {backup.sessionCount} sessions,{' '}
              {backup.setCount} sets.
            </Text>
          </>
        ) : (
          <Text style={styles.caption}>
            No backup snapshot is available yet. A snapshot is saved each time the app starts
            successfully.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    padding: 24,
    justifyContent: 'center',
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#666',
    lineHeight: 21,
    marginBottom: 20,
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  errorLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#333',
    fontFamily: 'Courier',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  restoreButton: {
    backgroundColor: '#FF9500',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  caption: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 19,
  },
});
