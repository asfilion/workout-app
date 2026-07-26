import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { getAllExercises, searchExercises } from '../db/exercises';
import { Exercise } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  /** Ids already in the list, shown greyed out so the same lift isn't added twice. */
  disabledIds?: string[];
  title?: string;
}

/**
 * Search-and-pick over the exercise library. Shared by the template day editor
 * and the active session, which both need it and had grown separate copies.
 */
export default function ExercisePicker({
  visible,
  onClose,
  onSelect,
  disabledIds = [],
  title = 'Add Exercise',
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Exercise[]>([]);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    let canceled = false;
    getAllExercises().then((all) => {
      if (!canceled) setResults(all);
    });
    return () => {
      canceled = true;
    };
  }, [visible]);

  async function handleSearch(text: string) {
    setQuery(text);
    setResults(text.trim() ? await searchExercises(text.trim()) : await getAllExercises());
  }

  function renderRow({ item }: { item: Exercise }) {
    const alreadyAdded = disabledIds.includes(item.id);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => onSelect(item)}
        disabled={alreadyAdded}
      >
        <Text style={[styles.name, alreadyAdded && styles.nameDisabled]}>{item.name}</Text>
        {alreadyAdded ? (
          <Text style={styles.addedLabel}>Added</Text>
        ) : (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.recommendedMaxReps} reps</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Done</Text>
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TextInput
            style={styles.search}
            placeholder="Search exercises..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={handleSearch}
            clearButtonMode="while-editing"
          />
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderRow}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No exercises found.</Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  close: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  search: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  name: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  nameDisabled: {
    color: '#bbb',
  },
  addedLabel: {
    fontSize: 13,
    color: '#bbb',
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
});
