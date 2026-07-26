import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ExercisesStackParamList } from '../../navigation/ExercisesStack';
import { getHistoryForExercise } from '../../db/sessions';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatWeight } from '../../utils/units';
import { formatDateTime } from '../../utils/time';
import { SessionSetEntry, DayOfWeek } from '../../types';

// dayOfWeek is null for ad hoc and standalone workouts, which belong to no weekday.
type HistoryEntry = SessionSetEntry & { workoutName: string; dayOfWeek: DayOfWeek | null };

type Props = NativeStackScreenProps<ExercisesStackParamList, 'ExerciseDetail'>;

export default function ExerciseDetailScreen({ route, navigation }: Props) {
  const { exerciseId, exerciseName } = route.params;
  const { unit } = useSettingsStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: exerciseName });
  }, [navigation, exerciseName]);

  useFocusEffect(
    useCallback(() => {
      getHistoryForExercise(exerciseId).then(setHistory);
    }, [exerciseId])
  );

  function renderItem({ item }: { item: HistoryEntry }) {
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.dateText}>{formatDateTime(item.loggedAt)}</Text>
          <Text style={styles.workoutText}>
            {item.workoutName} — {item.dayOfWeek}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.weightText}>{formatWeight(item.weight, unit)}</Text>
          <Text style={styles.repsText}>{item.reps} reps</Text>
        </View>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  rowLeft: {
    flex: 1,
  },
  dateText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  workoutText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  weightText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
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
});
