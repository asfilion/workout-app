import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WorkoutsStackParamList } from '../../navigation/WorkoutsStack';
import { getDaysForTemplate, upsertWorkoutDay } from '../../db/workouts';
import { getExerciseById } from '../../db/exercises';
import { useSessionStore } from '../../stores/sessionStore';
import ExerciseListEditor from '../../components/ExerciseListEditor';
import { DayOfWeek, Exercise } from '../../types';

const DAY_LABELS: Record<DayOfWeek, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'WorkoutDayDetail'>;

export default function WorkoutDayDetailScreen({ route, navigation }: Props) {
  const { templateId, dayOfWeek, templateName } = route.params;
  const day = dayOfWeek as DayOfWeek;

  const [orderedExercises, setOrderedExercises] = useState<Exercise[]>([]);
  const { activeSession, startSession } = useSessionStore();

  useLayoutEffect(() => {
    navigation.setOptions({ title: DAY_LABELS[day] ?? day });
  }, [navigation, day]);

  useFocusEffect(
    useCallback(() => {
      async function loadDay() {
        const days = await getDaysForTemplate(templateId);
        const found = days.find((d) => d.dayOfWeek === day);
        if (!found || found.orderedExerciseIds.length === 0) {
          setOrderedExercises([]);
          return;
        }
        const exercises = await Promise.all(
          found.orderedExerciseIds.map((id) => getExerciseById(id))
        );
        setOrderedExercises(exercises.filter((e): e is Exercise => e !== null));
      }
      loadDay();
    }, [templateId, day])
  );

  async function handleChange(next: Exercise[]) {
    setOrderedExercises(next);
    await upsertWorkoutDay(
      templateId,
      day,
      next.map((e) => e.id)
    );
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

  return (
    <View style={styles.container}>
      <ExerciseListEditor
        exercises={orderedExercises}
        onChange={handleChange}
        emptyText='No exercises. Tap "Add Exercise" to begin.'
        footer={
          <TouchableOpacity style={styles.startBtn} onPress={handleStartWorkout}>
            <Text style={styles.startBtnText}>Start Workout</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
});
