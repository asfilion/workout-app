import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WorkoutsStackParamList } from '../../navigation/WorkoutsStack';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getAllExercises, searchExercises, getExerciseById } from '../../db/exercises';
import { getLastSetForExercise as dbGetLastSet } from '../../db/sessions';
import { convertWeight, convertToLb, formatWeight } from '../../utils/units';
import { Exercise, SessionExercise, SessionSetEntry } from '../../types';
import TimerDisplay from '../../components/TimerDisplay';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'ActiveSession'>;

interface ExerciseRow {
  entry: SessionExercise;
  /** From the exercise record, which may have been archived since. */
  recommendedMaxReps: number | null;
  setsThisSession: SessionSetEntry[];
}

export default function ActiveSessionScreen({ navigation }: Props) {
  const {
    activeSession,
    sessionExercises,
    sets,
    lastSetLoggedAt,
    logSet,
    updateSet,
    deleteSet,
    addExercise,
    removeExercise,
    endSession,
    loadActiveSession,
  } = useSessionStore();
  const { unit } = useSettingsStore();

  const [rows, setRows] = useState<ExerciseRow[]>([]);

  // Log / edit set modal
  const [setModalVisible, setSetModalVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState<SessionExercise | null>(null);
  const [editingSet, setEditingSet] = useState<SessionSetEntry | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');

  // Add exercise picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerExercises, setPickerExercises] = useState<Exercise[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadActiveSession();
    }, [])
  );

  // The list comes from the session, not the template, so a session with no
  // template or no weekday works the same as any other.
  useEffect(() => {
    let canceled = false;
    async function build() {
      const built = await Promise.all(
        sessionExercises.map(async (entry) => {
          const exercise = await getExerciseById(entry.exerciseId);
          return {
            entry,
            recommendedMaxReps: exercise?.recommendedMaxReps ?? null,
            setsThisSession: sets.filter((s) => s.exerciseId === entry.exerciseId),
          };
        })
      );
      if (!canceled) setRows(built);
    }
    build();
    return () => {
      canceled = true;
    };
  }, [sessionExercises, sets]);

  async function openLogSetModal(entry: SessionExercise) {
    setModalTarget(entry);
    setEditingSet(null);
    // Prefill from the last set for this exercise anywhere, not just this session.
    const lastSet = await dbGetLastSet(entry.exerciseId);
    setWeightInput(lastSet ? String(convertWeight(lastSet.weight, unit)) : '');
    setRepsInput(lastSet ? String(lastSet.reps) : '');
    setSetModalVisible(true);
  }

  function openEditSetModal(entry: SessionExercise, target: SessionSetEntry) {
    setModalTarget(entry);
    setEditingSet(target);
    setWeightInput(String(convertWeight(target.weight, unit)));
    setRepsInput(String(target.reps));
    setSetModalVisible(true);
  }

  function closeSetModal() {
    setSetModalVisible(false);
    setModalTarget(null);
    setEditingSet(null);
    setWeightInput('');
    setRepsInput('');
  }

  async function handleSaveSet() {
    if (!modalTarget || !activeSession) return;
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
    const weightInLb = convertToLb(weightVal, unit);
    if (editingSet) {
      await updateSet(editingSet.id, weightInLb, repsVal);
    } else {
      await logSet(modalTarget.exerciseId, modalTarget.exerciseNameSnapshot, weightInLb, repsVal);
    }
    closeSetModal();
  }

  function handleDeleteSet() {
    if (!editingSet) return;
    Alert.alert('Delete Set', 'Remove this set from the workout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSet(editingSet.id);
          closeSetModal();
        },
      },
    ]);
  }

  async function openPicker() {
    setPickerQuery('');
    setPickerExercises(await getAllExercises());
    setPickerVisible(true);
  }

  async function handlePickerSearch(text: string) {
    setPickerQuery(text);
    setPickerExercises(text.trim() ? await searchExercises(text.trim()) : await getAllExercises());
  }

  async function handlePickExercise(exercise: Exercise) {
    await addExercise(exercise.id, exercise.name);
    setPickerVisible(false);
  }

  function handleRemoveExercise(row: ExerciseRow) {
    const loggedNote =
      row.setsThisSession.length > 0
        ? ` The ${row.setsThisSession.length} set${
            row.setsThisSession.length === 1 ? '' : 's'
          } you already logged will be kept.`
        : '';
    Alert.alert(
      'Remove Exercise',
      `Remove ${row.entry.exerciseNameSnapshot} from this workout?${loggedNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeExercise(row.entry.id),
        },
      ]
    );
  }

  function handleEndWorkout() {
    Alert.alert('End Workout', 'Mark this workout as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Workout',
        onPress: async () => {
          await endSession('completed');
          navigation.goBack();
        },
      },
    ]);
  }

  function handleCancelWorkout() {
    Alert.alert('Cancel Workout', 'Are you sure you want to cancel this workout?', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'Cancel Workout',
        style: 'destructive',
        onPress: async () => {
          await endSession('canceled');
          navigation.goBack();
        },
      },
    ]);
  }

  if (!activeSession) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No active session.</Text>
        </View>
      </View>
    );
  }

  function renderExerciseRow({ item }: { item: ExerciseRow }) {
    return (
      <View style={styles.exerciseRow}>
        <View style={styles.exerciseTopRow}>
          <Text style={styles.exerciseName}>{item.entry.exerciseNameSnapshot}</Text>
          {item.recommendedMaxReps !== null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.recommendedMaxReps} reps</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => handleRemoveExercise(item)} hitSlop={8}>
            <Text style={styles.removeExercise}>✕</Text>
          </TouchableOpacity>
        </View>

        {item.setsThisSession.length > 0 && (
          <View style={styles.setList}>
            {item.setsThisSession.map((s, index) => (
              <TouchableOpacity
                key={s.id}
                style={styles.setChip}
                onPress={() => openEditSetModal(item.entry, s)}
              >
                <Text style={styles.setChipText}>
                  {index + 1}. {formatWeight(s.weight, unit)} × {s.reps}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.logSetBtn} onPress={() => openLogSetModal(item.entry)}>
          <Text style={styles.logSetBtnText}>Log Set</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.timerHeader}>
        <TimerDisplay label="Total Time" startTimestamp={activeSession.startedAt} />
        <View style={styles.timerDivider} />
        <TimerDisplay label="Since Last Set" startTimestamp={lastSetLoggedAt} />
      </View>

      <View style={styles.sessionInfo}>
        <Text style={styles.sessionName}>{activeSession.workoutNameSnapshot}</Text>
        {activeSession.dayOfWeek && <Text style={styles.sessionDay}>{activeSession.dayOfWeek}</Text>}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.entry.id}
        renderItem={renderExerciseRow}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No exercises yet.</Text>
            <Text style={styles.emptySubtext}>Tap Add Exercise to build your workout.</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <TouchableOpacity style={styles.addBtn} onPress={openPicker}>
              <Text style={styles.addBtnText}>+ Add Exercise</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.endBtn} onPress={handleEndWorkout}>
              <Text style={styles.endBtnText}>End Workout</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelWorkout}>
              <Text style={styles.cancelBtnText}>Cancel Workout</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal visible={setModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingSet ? 'Edit Set' : (modalTarget?.exerciseNameSnapshot ?? 'Log Set')}
            </Text>

            <Text style={styles.inputLabel}>Weight ({unit})</Text>
            <TextInput
              style={styles.textInput}
              placeholder={`Weight in ${unit}`}
              placeholderTextColor="#999"
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              autoFocus
            />

            <Text style={styles.inputLabel}>Reps</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Reps"
              placeholderTextColor="#999"
              value={repsInput}
              onChangeText={setRepsInput}
              keyboardType="number-pad"
            />

            {editingSet && (
              <TouchableOpacity style={styles.deleteSetBtn} onPress={handleDeleteSet}>
                <Text style={styles.deleteSetBtnText}>Delete Set</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={closeSetModal}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalSaveBtn]} onPress={handleSaveSet}>
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.modalTitle}>Add Exercise</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.pickerClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Search exercises"
              placeholderTextColor="#999"
              value={pickerQuery}
              onChangeText={handlePickerSearch}
            />
            <FlatList
              data={pickerExercises}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerRow} onPress={() => handlePickExercise(item)}>
                  <Text style={styles.pickerName}>{item.name}</Text>
                  <Text style={styles.pickerMeta}>{item.recommendedMaxReps} reps</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  timerHeader: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  timerDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  sessionInfo: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  sessionDay: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  exerciseRow: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  exerciseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  exerciseName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  badge: {
    backgroundColor: '#e8f0fe',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  removeExercise: {
    fontSize: 16,
    color: '#c7c7cc',
    paddingHorizontal: 4,
  },
  setList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  setChip: {
    backgroundColor: '#f2f2f7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  setChipText: {
    fontSize: 13,
    color: '#333',
  },
  logSetBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  logSetBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 4,
  },
  footer: {
    padding: 16,
    gap: 12,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  endBtn: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  endBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
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
  deleteSetBtn: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 8,
  },
  deleteSetBtnText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  modalCancelBtn: {
    backgroundColor: '#f0f0f0',
  },
  modalCancelBtnText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#007AFF',
  },
  modalSaveBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerClose: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 16,
  },
  pickerList: {
    marginTop: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  pickerName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  pickerMeta: {
    fontSize: 13,
    color: '#999',
  },
});
