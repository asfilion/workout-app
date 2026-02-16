import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WorkoutsStackParamList } from '../../navigation/WorkoutsStack';
import { getWorkoutTemplateById, getDaysForTemplate } from '../../db/workouts';
import { WorkoutDayTemplate, DayOfWeek } from '../../types';

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
  const [dayMap, setDayMap] = useState<Record<string, WorkoutDayTemplate>>({});

  useLayoutEffect(() => {
    navigation.setOptions({ title: templateName });
  }, [navigation, templateName]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [template, days] = await Promise.all([
          getWorkoutTemplateById(templateId),
          getDaysForTemplate(templateId),
        ]);
        if (template) setTemplateName(template.name);
        const map: Record<string, WorkoutDayTemplate> = {};
        for (const d of days) {
          map[d.dayOfWeek] = d;
        }
        setDayMap(map);
      }
      load();
    }, [templateId])
  );

  function renderDay({ item: day }: { item: DayOfWeek }) {
    const dayTemplate = dayMap[day];
    const exerciseCount = dayTemplate ? dayTemplate.orderedExerciseIds.length : 0;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() =>
          navigation.navigate('WorkoutDayDetail', {
            templateId,
            dayOfWeek: day,
            templateName,
          })
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
});
