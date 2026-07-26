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
import { getDaysForTemplate } from '../../db/workouts';
import { getExerciseById } from '../../db/exercises';
import { getLastSetForExercise as dbGetLastSet } from '../../db/sessions';
import { convertWeight, convertToLb, formatWeight } from '../../utils/units';
import { Exercise, SessionSetEntry } from '../../types';
import TimerDisplay from '../../components/TimerDisplay';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'ActiveSession'>;

interface ExerciseWithLastSet {
  exercise: Exercise;
  lastSetInSession: SessionSetEntry | undefined;
}

export default function ActiveSessionScreen({ navigation }: Props) {
  const { activeSession, sets, lastSetLoggedAt, logSet, endSession, loadActiveSession } =
    useSessionStore();
  const { unit } = useSettingsStore();

  const [exerciseRows, setExerciseRows] = useState<ExerciseWithLastSet[]>([]);

  // Log Set Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');

  async function loadExercises() {
    if (!activeSession) return;
    // Still resolved through the template here; step 4 of the plan switches this
    // over to the session's own exercise list. Sessions without a template or a
    // weekday cannot be reached from the UI yet.
    if (!activeSession.workoutTemplateId || !activeSession.dayOfWeek) {
      setExerciseRows([]);
      return;
    }
    const days = await getDaysForTemplate(activeSession.workoutTemplateId);
    const day = days.find((d) => d.dayOfWeek === activeSession.dayOfWeek);
    if (!day || day.orderedExerciseIds.length === 0) {
      setExerciseRows([]);
      return;
    }
    const exercises = await Promise.all(
      day.orderedExerciseIds.map((id) => getExerciseById(id))
    );
    const validExercises = exercises.filter((e): e is Exercise => e !== null);
    const rows: ExerciseWithLastSet[] = validExercises.map((exercise) => {
      const lastSet = [...sets]
        .reverse()
        .find((s) => s.exerciseId === exercise.id);
      return { exercise, lastSetInSession: lastSet };
    });
    setExerciseRows(rows);
  }

  useFocusEffect(
    useCallback(() => {
      loadActiveSession();
    }, [])
  );

  useEffect(() => {
    loadExercises();
  }, [activeSession, sets]);

  async function openLogSetModal(exercise: Exercise) {
    setSelectedExercise(exercise);
    // Prefill weight from last set for this exercise (globally, not just this session)
    const lastSet = await dbGetLastSet(exercise.id);
    if (lastSet) {
      const displayWeight = convertWeight(lastSet.weight, unit);
      setWeightInput(String(displayWeight));
      setRepsInput(String(lastSet.reps));
    } else {
      setWeightInput('');
      setRepsInput('');
    }
    setModalVisible(true);
  }

  async function handleLogSet() {
    if (!selectedExercise || !activeSession) return;
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
    await logSet(selectedExercise.id, selectedExercise.name, weightInLb, repsVal);
    setModalVisible(false);
    setSelectedExercise(null);
    setWeightInput('');
    setRepsInput('');
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
    Alert.alert(
      'Cancel Workout',
      'Are you sure you want to cancel this workout?',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Cancel Workout',
          style: 'destructive',
          onPress: async () => {
            await endSession('canceled');
            navigation.goBack();
          },
        },
      ]
    );
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

  function renderExerciseRow({ item }: { item: ExerciseWithLastSet }) {
    const { exercise, lastSetInSession } = item;
    return (
      <View style={styles.exerciseRow}>
        <View style={styles.exerciseTopRow}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{exercise.recommendedMaxReps} reps</Text>
          </View>
        </View>
        {lastSetInSession && (
          <Text style={styles.lastSetText}>
            Last: {formatWeight(lastSetInSession.weight, unit)} × {lastSetInSession.reps} reps
          </Text>
        )}
        <TouchableOpacity
          style={styles.logSetBtn}
          onPress={() => openLogSetModal(exercise)}
        >
          <Text style={styles.logSetBtnText}>Log Set</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sticky timer header */}
      <View style={styles.timerHeader}>
        <TimerDisplay label="Total Time" startTimestamp={activeSession.startedAt} />
        <View style={styles.timerDivider} />
        <TimerDisplay label="Since Last Set" startTimestamp={lastSetLoggedAt} />
      </View>

      {/* Session info */}
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionName}>{activeSession.workoutNameSnapshot}</Text>
        <Text style={styles.sessionDay}>{activeSession.dayOfWeek}</Text>
      </View>

      <FlatList
        data={exerciseRows}
        keyExtractor={(item) => item.exercise.id}
        renderItem={renderExerciseRow}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No exercises scheduled for this day.</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <TouchableOpacity style={styles.endBtn} onPress={handleEndWorkout}>
              <Text style={styles.endBtnText}>End Workout</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelWorkout}>
              <Text style={styles.cancelBtnText}>Cancel Workout</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Log Set Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedExercise?.name ?? 'Log Set'}
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

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => {
                  setModalVisible(false);
                  setSelectedExercise(null);
                  setWeightInput('');
                  setRepsInput('');
                }}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalSaveBtn]}
                onPress={handleLogSet}
              >
                <Text style={styles.modalSaveBtnText}>Save</Text>
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
  lastSetText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
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
  footer: {
    padding: 16,
    gap: 12,
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
});
