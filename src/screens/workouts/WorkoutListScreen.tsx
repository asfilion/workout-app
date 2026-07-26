import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WorkoutsStackParamList } from '../../navigation/WorkoutsStack';
import { getAllWorkoutTemplates, createWorkoutTemplate, getWorkoutDaysForToday } from '../../db/workouts';
import { getExerciseById } from '../../db/exercises';
import { SessionExerciseInput } from '../../db/sessions';
import { useSessionStore } from '../../stores/sessionStore';
import { getCurrentDayOfWeek } from '../../utils/time';
import { WorkoutTemplate, WorkoutDayTemplate } from '../../types';

type TodayEntry = WorkoutDayTemplate & { workoutName: string };

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'WorkoutList'>;

export default function WorkoutListScreen({ navigation }: Props) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [todayEntries, setTodayEntries] = useState<TodayEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const { activeSession, startSession } = useSessionStore();

  async function loadData() {
    const today = getCurrentDayOfWeek();
    const [allTemplates, todayDays] = await Promise.all([
      getAllWorkoutTemplates(),
      getWorkoutDaysForToday(today),
    ]);
    setTemplates(allTemplates);
    setTodayEntries(todayDays);
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
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
    if (!name) {
      Alert.alert('Error', 'Please enter a workout name.');
      return;
    }
    await createWorkoutTemplate(name);
    setModalVisible(false);
    setNewName('');
    loadData();
  }

  function handleCancelModal() {
    setModalVisible(false);
    setNewName('');
  }

  async function handleStartOrResume(entry: TodayEntry) {
    const isActiveMatch =
      activeSession && activeSession.workoutTemplateId === entry.workoutTemplateId;

    if (isActiveMatch) {
      navigation.navigate('ActiveSession', { sessionId: activeSession!.id });
      return;
    }

    if (activeSession) {
      Alert.alert(
        'Active Session',
        'You have an active workout session. End it before starting a new one.',
        [{ text: 'OK' }]
      );
      return;
    }

    const today = getCurrentDayOfWeek();
    // The session takes its own copy of the day's exercises. Archived or deleted
    // ones are dropped rather than carried across as broken rows.
    const resolved = await Promise.all(entry.orderedExerciseIds.map((id) => getExerciseById(id)));
    const exercises: SessionExerciseInput[] = resolved
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((e) => ({ exerciseId: e.id, exerciseNameSnapshot: e.name }));

    await startSession(entry.workoutTemplateId, entry.workoutName, today, exercises);
    const updatedSession = useSessionStore.getState().activeSession;
    if (updatedSession) {
      navigation.navigate('ActiveSession', { sessionId: updatedSession.id });
    }
  }

  function renderTodayItem({ item }: { item: TodayEntry }) {
    const isActiveMatch =
      activeSession && activeSession.workoutTemplateId === item.workoutTemplateId;
    return (
      <View style={styles.todayRow}>
        <View style={styles.todayInfo}>
          <Text style={styles.todayWorkoutName}>{item.workoutName}</Text>
          <Text style={styles.todayDayText}>{item.dayOfWeek}</Text>
        </View>
        <TouchableOpacity
          style={[styles.startBtn, isActiveMatch && styles.resumeBtn]}
          onPress={() => handleStartOrResume(item)}
        >
          <Text style={styles.startBtnText}>{isActiveMatch ? 'Resume' : 'Start'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderTemplateItem({ item }: { item: WorkoutTemplate }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('WorkoutDetail', { templateId: item.id })}
      >
        <Text style={styles.templateName}>{item.name}</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {todayEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today</Text>
          <View style={styles.card}>
            {todayEntries.map((entry, index) => (
              <View key={entry.id}>
                {renderTodayItem({ item: entry })}
                {index < todayEntries.length - 1 && <View style={styles.separator} />}
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Workouts</Text>
        {templates.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No workouts yet. Tap + to add one.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <FlatList
              data={templates}
              keyExtractor={(item) => item.id}
              renderItem={renderTemplateItem}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              scrollEnabled={false}
            />
          </View>
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Workout</Text>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Workout name"
              placeholderTextColor="#999"
              value={newName}
              onChangeText={setNewName}
              autoFocus
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  todayInfo: {
    flex: 1,
  },
  todayWorkoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  todayDayText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  startBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resumeBtn: {
    backgroundColor: '#34C759',
  },
  startBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  templateName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
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
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
  },
  headerButton: {
    fontSize: 28,
    color: '#007AFF',
    fontWeight: '400',
    marginRight: 4,
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
