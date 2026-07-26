import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import ExercisePicker from './ExercisePicker';
import { moveUp, moveDown, removeAt } from '../utils/ordering';
import { Exercise } from '../types';

interface Props {
  exercises: Exercise[];
  /** Called with the whole new order; the parent persists it. */
  onChange: (next: Exercise[]) => void;
  emptyText?: string;
  /** Rendered under the list, above Add Exercise — e.g. a Start Workout button. */
  footer?: React.ReactNode;
}

/**
 * The ordered exercise list behind both kinds of workout: a weekly day and a
 * standalone workout's single day-independent list. Those differ only in what
 * the parent persists to, so the editing itself lives here once.
 *
 * The active session deliberately does not use this. Its rows carry logged sets
 * and a Log Set action, and its items are session exercises rather than library
 * ones — sharing would mean parameterising this into something less clear than
 * either version.
 */
export default function ExerciseListEditor({
  exercises,
  onChange,
  emptyText = 'No exercises yet.',
  footer,
}: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);

  function handleAdd(exercise: Exercise) {
    if (exercises.some((e) => e.id === exercise.id)) return;
    onChange([...exercises, exercise]);
    setPickerVisible(false);
  }

  function renderRow({ item, index }: { item: Exercise; index: number }) {
    const isFirst = index === 0;
    const isLast = index === exercises.length - 1;
    return (
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.recommendedMaxReps} reps</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.arrowBtn, isFirst && styles.arrowBtnDisabled]}
            onPress={() => onChange(moveUp(exercises, index))}
            disabled={isFirst}
          >
            <Text style={[styles.arrowText, isFirst && styles.arrowTextDisabled]}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowBtn, isLast && styles.arrowBtnDisabled]}
            onPress={() => onChange(moveDown(exercises, index))}
            disabled={isLast}
          >
            <Text style={[styles.arrowText, isLast && styles.arrowTextDisabled]}>▼</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => onChange(removeAt(exercises, index))}
          >
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <TouchableOpacity style={styles.addBtn} onPress={() => setPickerVisible(true)}>
              <Text style={styles.addBtnText}>+ Add Exercise</Text>
            </TouchableOpacity>
            {footer}
          </View>
        }
      />

      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleAdd}
        disabledIds={exercises.map((e) => e.id)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeBtnText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 16,
  },
  empty: {
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
});
