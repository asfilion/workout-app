import React, { useState, useCallback, useLayoutEffect } from 'react';
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
import { getDaysForTemplate, upsertWorkoutDay } from '../../db/workouts';
import { getAllExercises, searchExercises, getExerciseById } from '../../db/exercises';
import { useSessionStore } from '../../stores/sessionStore';
import { DayOfWeek, Exercise } from '../../types';

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'WorkoutDayDetail'>;

export default function WorkoutDayDetailScreen({ route, navigation }: Props) {
  const { templateId, dayOfWeek, templateName } = route.params;
  const day = dayOfWeek as DayOfWeek;

  const [orderedExercises, setOrderedExercises] = useState<Exercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerExercises, setPickerExercises] = useState<Exercise[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');

  const { activeSession, startSession } = useSessionStore();

  useLayoutEffect(() => {
    const DAY_LABELS: Record<DayOfWeek, string> = {
      Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
      Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
    };
    navigation.setOptions({ title: DAY_LABELS[day] ?? day });
  }, [navigation, day]);

  async function loadDay() {
    const days = await getDaysForTemplate(templateId);
    const found = days.find((d) => d.dayOfWeek === day);
    if (found && found.orderedExerciseIds.length > 0) {
      const exercises = await Promise.all(
        found.orderedExerciseIds.map((id) => getExerciseById(id))
      );
      setOrderedExercises(exercises.filter((e): e is Exercise => e !== null));
    } else {
      setOrderedExercises([]);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadDay();
    }, [templateId, day])
  );

  async function persistOrder(exercises: Exercise[]) {
    const ids = exercises.map((e) => e.id);
    await upsertWorkoutDay(templateId, day, ids);
  }

  async function handleRemove(exerciseId: string) {
    const updated = orderedExercises.filter((e) => e.id !== exerciseId);
    setOrderedExercises(updated);
    await persistOrder(updated);
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const updated = [...orderedExercises];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setOrderedExercises(updated);
    await persistOrder(updated);
  }

  async function handleMoveDown(index: number) {
    if (index === orderedExercises.length - 1) return;
    const updated = [...orderedExercises];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setOrderedExercises(updated);
    await persistOrder(updated);
  }

  async function openPicker() {
    setPickerQuery('');
    const all = await getAllExercises();
    setPickerExercises(all);
    setPickerVisible(true);
  }

  async function handlePickerSearch(text: string) {
    setPickerQuery(text);
    if (text.trim()) {
      const results = await searchExercises(text.trim());
      setPickerExercises(results);
    } else {
      const all = await getAllExercises();
      setPickerExercises(all);
    }
  }

  async function handleAddExercise(exercise: Exercise) {
    if (orderedExercises.find((e) => e.id === exercise.id)) {
      Alert.alert('Already Added', `${exercise.name} is already in this day.`);
      return;
    }
    const updated = [...orderedExercises, exercise];
    setOrderedExercises(updated);
    await persistOrder(updated);
    setPickerVisible(false);
  }

  async function handleStartWorkout() {
    if (activeSession) {
      Alert.alert(
        'Active Session',
        'You already have an active workout session. End or cancel it first.',
        [{ text: 'OK' }]
      );
      return;
    }
    await startSession(
      templateId,
      templateName,
      day,
      orderedExercises.map((e) => ({ exerciseId: e.id, exerciseNameSnapshot: e.name }))
    );
    const updatedSession = useSessionStore.getState().activeSession;
    if (updatedSession) {
      navigation.navigate('ActiveSession', { sessionId: updatedSession.id });
    }
  }

  function renderExerciseRow({ item, index }: { item: Exercise; index: number }) {
    return (
      <View style={styles.exerciseRow}>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{item.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.recommendedMaxReps} reps</Text>
          </View>
        </View>
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
            onPress={() => handleMoveUp(index)}
            disabled={index === 0}
          >
            <Text style={[styles.arrowText, index === 0 && styles.arrowTextDisabled]}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowBtn, index === orderedExercises.length - 1 && styles.arrowBtnDisabled]}
            onPress={() => handleMoveDown(index)}
            disabled={index === orderedExercises.length - 1}
          >
            <Text style={[styles.arrowText, index === orderedExercises.length - 1 && styles.arrowTextDisabled]}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemove(item.id)}
          >
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orderedExercises}
        keyExtractor={(item) => item.id}
        renderItem={renderExerciseRow}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No exercises. Tap "Add Exercise" to begin.</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <TouchableOpacity style={styles.addExerciseBtn} onPress={openPicker}>
              <Text style={styles.addExerciseBtnText}>+ Add Exercise</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startBtn} onPress={handleStartWorkout}>
              <Text style={styles.startBtnText}>Start Workout</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal visible={pickerVisible} animationType="slide">
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Text style={styles.pickerClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <TextInput
              style={styles.pickerSearch}
              placeholder="Search exercises..."
              placeholderTextColor="#999"
              value={pickerQuery}
              onChangeText={handlePickerSearch}
              clearButtonMode="while-editing"
            />
            <FlatList
              data={pickerExercises}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => handleAddExercise(item)}
                >
                  <Text style={styles.pickerExerciseName}>{item.name}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.recommendedMaxReps} reps</Text>
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No exercises found.</Text>
                </View>
              }
            />
          </KeyboardAvoidingView>
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
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  exerciseInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseName: {
    fontSize: 16,
    color: '#333',
    flexShrink: 1,
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
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrowBtn: {
    padding: 6,
  },
  arrowBtnDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    fontSize: 14,
    color: '#007AFF',
  },
  arrowTextDisabled: {
    color: '#ccc',
  },
  removeBtn: {
    padding: 6,
    marginLeft: 4,
  },
  removeBtnText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
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
  footer: {
    padding: 16,
    gap: 12,
  },
  addExerciseBtn: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addExerciseBtnText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  startBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  pickerClose: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  pickerSearch: {
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    fontSize: 16,
    color: '#333',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  pickerExerciseName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
});
