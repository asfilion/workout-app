import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ExercisesStackParamList } from '../../navigation/ExercisesStack';
import { getHistoryForExercise, updateSet, deleteSet } from '../../db/sessions';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSessionStore } from '../../stores/sessionStore';
import { formatWeight, convertWeight, convertToLb } from '../../utils/units';
import { formatDateTime } from '../../utils/time';
import { SessionSetEntry, DayOfWeek } from '../../types';

// dayOfWeek is null for ad hoc and standalone workouts, which belong to no weekday.
type HistoryEntry = SessionSetEntry & { workoutName: string; dayOfWeek: DayOfWeek | null };

type Props = NativeStackScreenProps<ExercisesStackParamList, 'ExerciseDetail'>;

export default function ExerciseDetailScreen({ route, navigation }: Props) {
  const { exerciseId, exerciseName } = route.params;
  const { unit } = useSettingsStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: exerciseName });
  }, [navigation, exerciseName]);

  const load = useCallback(async () => {
    setHistory(await getHistoryForExercise(exerciseId));
  }, [exerciseId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /**
   * History can reach into the workout currently underway, so the store has to
   * be re-read after an edit or its copy of the sets goes stale.
   */
  async function refresh() {
    await load();
    if (useSessionStore.getState().activeSession) {
      await useSessionStore.getState().loadActiveSession();
    }
  }

  function openEdit(entry: HistoryEntry) {
    setEditing(entry);
    setWeightInput(String(convertWeight(entry.weight, unit)));
    setRepsInput(String(entry.reps));
  }

  async function handleSave() {
    if (!editing) return;
    const weightVal = parseFloat(weightInput);
    const repsVal = parseInt(repsInput, 10);
    if (isNaN(weightVal) || weightVal <= 0) {
      Alert.alert('Error', 'Please enter a valid weight.');
      return;
    }
    if (isNaN(repsVal) || repsVal < 1) {
      Alert.alert('Error', 'Please enter a valid number of reps.');
      return;
    }
    await updateSet(editing.id, convertToLb(weightVal, unit), repsVal);
    setEditing(null);
    await refresh();
  }

  function handleDelete() {
    if (!editing) return;
    const target = editing;
    Alert.alert('Delete Set', 'Remove this set from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSet(target.id);
          setEditing(null);
          await refresh();
        },
      },
    ]);
  }

  function renderItem({ item }: { item: HistoryEntry }) {
    return (
      <TouchableOpacity style={styles.row} onPress={() => openEdit(item)}>
        <View style={styles.rowLeft}>
          <Text style={styles.dateText}>{formatDateTime(item.loggedAt)}</Text>
          <Text style={styles.workoutText}>
            {/* Ad hoc and standalone workouts have no weekday to show. */}
            {item.dayOfWeek ? `${item.workoutName} — ${item.dayOfWeek}` : item.workoutName}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.weightText}>{formatWeight(item.weight, unit)}</Text>
          <Text style={styles.repsText}>{item.reps} reps</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No history yet for this exercise.</Text>
          </View>
        }
      />

      <Modal visible={editing !== null} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Set</Text>
            <Text style={styles.modalSubtitle}>
              {editing ? formatDateTime(editing.loggedAt) : ''}
            </Text>

            <Text style={styles.inputLabel}>Weight ({unit})</Text>
            <TextInput
              style={styles.textInput}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              autoFocus
            />

            <Text style={styles.inputLabel}>Reps</Text>
            <TextInput
              style={styles.textInput}
              value={repsInput}
              onChangeText={setRepsInput}
              keyboardType="number-pad"
            />

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>Delete Set</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setEditing(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLeft: {
    flex: 1,
  },
  dateText: {
    fontSize: 15,
    color: '#333',
  },
  workoutText: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  weightText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  repsText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  deleteBtn: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
  },
  deleteBtnText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelBtn: {
    backgroundColor: '#f0f0f0',
  },
  cancelBtnText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#007AFF',
  },
  saveBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
