import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useDbStore } from '../../stores/dbStore';
import { formatBackupDate } from '../../db/backup';
import { exportSetsCsv } from '../../utils/csv';

export default function SettingsScreen() {
  const { unit, setUnit } = useSettingsStore();
  const { backup, backupNow, restore, refreshBackupInfo } = useDbStore();
  const loadActiveSession = useSessionStore(s => s.loadActiveSession);
  const [exporting, setExporting] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      refreshBackupInfo();
    }, [])
  );

  async function handleExport() {
    setExporting(true);
    try {
      await exportSetsCsv(unit);
    } catch (err) {
      Alert.alert('Export Failed', String(err));
    } finally {
      setExporting(false);
    }
  }

  async function handleBackupNow() {
    setBusy(true);
    try {
      await backupNow();
      Alert.alert('Backup Saved', 'A snapshot of your data has been saved on this device.');
    } catch (err) {
      Alert.alert('Backup Failed', String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleRestore() {
    if (!backup) return;
    Alert.alert(
      'Restore from Backup',
      `This replaces your current data with the snapshot from ${formatBackupDate(
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
              await loadActiveSession();
              Alert.alert('Restored', 'Your data has been restored from the backup.');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weight Unit</Text>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segment, unit === 'lb' && styles.segmentActive]}
            onPress={() => setUnit('lb')}
          >
            <Text style={[styles.segmentText, unit === 'lb' && styles.segmentTextActive]}>
              lb
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, unit === 'kg' && styles.segmentActive]}
            onPress={() => setUnit('kg')}
          >
            <Text style={[styles.segmentText, unit === 'kg' && styles.segmentTextActive]}>
              kg
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data</Text>
        <TouchableOpacity
          style={[styles.button, exporting && styles.buttonDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Export Sets CSV</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup</Text>
        <Text style={styles.caption}>
          {backup
            ? `Last snapshot ${formatBackupDate(backup.createdAt)} — ${backup.sessionCount} sessions, ${backup.setCount} sets. A snapshot is saved automatically each time the app starts.`
            : 'No snapshot saved yet. One is saved automatically each time the app starts.'}
        </Text>
        <TouchableOpacity
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={handleBackupNow}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Back Up Now</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            styles.restoreButton,
            (busy || !backup) && styles.buttonDisabled,
          ]}
          onPress={handleRestore}
          disabled={busy || !backup}
        >
          <Text style={styles.buttonText}>Restore from Backup</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 32,
    backgroundColor: '#fff',
  },
  segmentActive: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  caption: {
    fontSize: 13,
    color: '#999',
    lineHeight: 19,
    marginBottom: 12,
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
});
