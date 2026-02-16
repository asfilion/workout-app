import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSettingsStore } from '../../stores/settingsStore';
import { exportSetsCsv } from '../../utils/csv';

export default function SettingsScreen() {
  const { unit, setUnit } = useSettingsStore();
  const [exporting, setExporting] = React.useState(false);

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

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
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
