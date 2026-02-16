import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ExercisesStackParamList } from '../../navigation/ExercisesStack';
import {
  getAllExercises,
  searchExercises,
  createExercise,
  archiveExercise,
  deleteExercise,
  exerciseHasHistory,
} from '../../db/exercises';
import { Exercise } from '../../types';

type Props = NativeStackScreenProps<ExercisesStackParamList, 'ExerciseList'>;

export default function ExerciseListScreen({ navigation }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMaxReps, setNewMaxReps] = useState('');

  async function loadExercises(searchQuery?: string) {
    const q = searchQuery !== undefined ? searchQuery : query;
    const results = q.trim()
      ? await searchExercises(q.trim())
      : await getAllExercises();
    setExercises(results);
  }

  useFocusEffect(
    useCallback(() => {
      loadExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Text style={styles.headerButton}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  async function handleCreate() {
    const name = newName.trim();
    const maxReps = parseInt(newMaxReps, 10);
    if (!name) {
      Alert.alert('Error', 'Please enter an exercise name.');
      return;
    }
    if (!maxReps || maxReps < 1) {
      Alert.alert('Error', 'Please enter a valid recommended max reps number.');
      return;
    }
    await createExercise(name, maxReps);
    setModalVisible(false);
    setNewName('');
    setNewMaxReps('');
    loadExercises();
  }

  function handleCancelModal() {
    setModalVisible(false);
    setNewName('');
    setNewMaxReps('');
  }

  async function handleLongPress(exercise: Exercise) {
    const hasHistory = await exerciseHasHistory(exercise.id);
    Alert.alert(
      exercise.name,
      hasHistory
        ? 'This exercise has history. Archive it to hide from lists while preserving your data.'
        : 'Delete this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hasHistory ? 'Archive' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (hasHistory) {
              await archiveExercise(exercise.id);
            } else {
              await deleteExercise(exercise.id);
            }
            loadExercises();
          },
        },
      ]
    );
  }

  function handleQueryChange(text: string) {
    setQuery(text);
    loadExercises(text);
  }

  function renderItem({ item }: { item: Exercise }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() =>
          navigation.navigate('ExerciseDetail', {
            exerciseId: item.id,
            exerciseName: item.name,
          })
        }
        onLongPress={() => handleLongPress(item)}
      >
        <Text style={styles.exerciseName}>{item.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.recommendedMaxReps} reps</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search exercises..."
        placeholderTextColor="#999"
        value={query}
        onChangeText={handleQueryChange}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {query ? 'No exercises found.' : 'No exercises yet. Tap + to add one.'}
            </Text>
          </View>
        }
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Exercise</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Exercise name"
              placeholderTextColor="#999"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <Text style={styles.inputLabel}>Recommended Max Reps</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 12"
              placeholderTextColor="#999"
              value={newMaxReps}
              onChangeText={setNewMaxReps}
              keyboardType="number-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={handleCancelModal}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.createBtn]}
                onPress={handleCreate}
              >
                <Text style={styles.createBtnText}>Create</Text>
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
  headerButton: {
    fontSize: 28,
    color: '#007AFF',
    fontWeight: '400',
    marginRight: 4,
  },
  searchInput: {
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  exerciseName: {
    flex: 1,
    fontSize: 16,
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
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    marginTop: 8,
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
  createBtn: {
    backgroundColor: '#007AFF',
  },
  createBtnText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
