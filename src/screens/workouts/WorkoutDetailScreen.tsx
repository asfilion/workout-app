import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WorkoutsStackParamList } from '../../navigation/WorkoutsStack';
import {
  getWorkoutTemplateById,
  getDaysForTemplate,
  getStandaloneDay,
  upsertWorkoutDay,
} from '../../db/workouts';
import { getExerciseById } from '../../db/exercises';
import { useSessionStore } from '../../stores/sessionStore';
import ExerciseListEditor from '../../components/ExerciseListEditor';
import { WorkoutDayTemplate, DayOfWeek, Exercise, ScheduleType } from '../../types';

const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS: Record<DayOfWeek, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday',
};

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'WorkoutDetail'>;

export default function WorkoutDetailScreen({ route, navigation }: Props) {
  const { templateId } = route.params;
  const [templateName, setTemplateName] = useState('Workout');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('weekly');
  const [dayMap, setDayMap] = useState<Record<string, WorkoutDayTemplate>>({});
  const [standaloneExercises, setStandaloneExercises] = useState<Exercise[]>([]);

  const { activeSession, startSession } = useSessionStore();

  useLayoutEffect(() => {
    navigation.setOptions({ title: templateName });
  }, [navigation, templateName]);

  const load = useCallback(async () => {
    const template = await getWorkoutTemplateById(templateId);
    if (!template) return;
    setTemplateName(template.name);
    setScheduleType(template.scheduleType);

    if (template.scheduleType === 'standalone') {
      const day = await getStandaloneDay(templateId);
      const exercises = await Promise.all(
        (day?.orderedExerciseIds ?? []).map((id) => getExerciseById(id))
      );
      setStandaloneExercises(exercises.filter((e): e is Exercise => e !== null));
      return;
    }

    const days = await getDaysForTemplate(templateId);
    const map: Record<string, WorkoutDayTemplate> = {};
    for (const d of days) {
      // A standalone workout's day-independent list has no slot in this grid.
      if (d.dayOfWeek) map[d.dayOfWeek] = d;
    }
    setDayMap(map);
  }, [templateId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleStandaloneChange(next: Exercise[]) {
    setStandaloneExercises(next);
    await upsertWorkoutDay(
      templateId,
      null,
      next.map((e) => e.id)
    );
  }

  async function handleStartStandalone() {
    if (activeSession) {
      Alert.alert(
        'Active Session',
        'You already have an active workout session. End or cancel it first.',
        [{ text: 'OK' }]
      );
      return;
    }
    // No weekday: a standalone workout is not tied to one, and the session
    // records that rather than pretending it happened on a scheduled day.
    await startSession(
      templateId,
      templateName,
      null,
      standaloneExercises.map((e) => ({ exerciseId: e.id, exerciseNameSnapshot: e.name }))
    );
    const started = useSessionStore.getState().activeSession;
    if (started) navigation.navigate('ActiveSession', { sessionId: started.id });
  }

  function renderDay({ item: day }: { item: DayOfWeek }) {
    const exerciseCount = dayMap[day]?.orderedExerciseIds.length ?? 0;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() =>
          navigation.navigate('WorkoutDayDetail', { templateId, dayOfWeek: day, templateName })
        }
      >
        <Text style={styles.dayLabel}>{DAY_LABELS[day]}</Text>
        <Text style={[styles.dayMeta, exerciseCount === 0 && styles.restDay]}>
          {exerciseCount === 0
            ? 'Rest day'
            : `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  if (scheduleType === 'standalone') {
    return (
      <View style={styles.container}>
        <Text style={styles.caption}>Not tied to a day — start it whenever you like.</Text>
        <ExerciseListEditor
          exercises={standaloneExercises}
          onChange={handleStandaloneChange}
          emptyText='No exercises. Tap "Add Exercise" to begin.'
          footer={
            <TouchableOpacity style={styles.startBtn} onPress={handleStartStandalone}>
              <Text style={styles.startBtnText}>Start Workout</Text>
            </TouchableOpacity>
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={ALL_DAYS}
        keyExtractor={(item) => item}
        renderItem={renderDay}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  caption: {
    fontSize: 13,
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  dayLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  dayMeta: {
    fontSize: 14,
    color: '#007AFF',
    marginRight: 8,
  },
  restDay: {
    color: '#999',
  },
  chevron: {
    fontSize: 22,
    color: '#ccc',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 16,
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
