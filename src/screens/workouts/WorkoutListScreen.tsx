import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
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
import {
  getAllWorkoutTemplates,
  createWorkoutTemplate,
  getWorkoutDaysForToday,
  getStandaloneDay,
} from '../../db/workouts';
import { getExerciseById } from '../../db/exercises';
import { SessionExerciseInput } from '../../db/sessions';
import { useSessionStore } from '../../stores/sessionStore';
import { getCurrentDayOfWeek } from '../../utils/time';
import { WorkoutTemplate, WorkoutDayTemplate, ScheduleType } from '../../types';

type TodayEntry = WorkoutDayTemplate & { workoutName: string };

type Props = NativeStackScreenProps<WorkoutsStackParamList, 'WorkoutList'>;

/** Resolves stored exercise ids into the snapshot a session needs, dropping any that have gone. */
async function resolveExercises(ids: string[]): Promise<SessionExerciseInput[]> {
  const resolved = await Promise.all(ids.map((id) => getExerciseById(id)));
  return resolved
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .map((e) => ({ exerciseId: e.id, exerciseNameSnapshot: e.name }));
}

export default function WorkoutListScreen({ navigation }: Props) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [todayEntries, setTodayEntries] = useState<TodayEntry[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ScheduleType>('weekly');

  const { activeSession, startSession } = useSessionStore();

  async function loadData() {
    const [allTemplates, todayDays] = await Promise.all([
      getAllWorkoutTemplates(),
      getWorkoutDaysForToday(getCurrentDayOfWeek()),
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
    await createWorkoutTemplate(name, newType);
    closeModal();
    loadData();
  }

  function closeModal() {
    setModalVisible(false);
    setNewName('');
    setNewType('weekly');
  }

  /** True if a session is already running; warns and returns true. */
  function blockedByActiveSession(): boolean {
    if (!activeSession) return false;
    Alert.alert(
      'Active Session',
      'You have an active workout session. End it before starting a new one.',
      [{ text: 'OK' }]
    );
    return true;
  }

  function goToActiveSession() {
    const started = useSessionStore.getState().activeSession;
    if (started) navigation.navigate('ActiveSession', { sessionId: started.id });
  }

  async function handleStartOrResume(entry: TodayEntry) {
    if (activeSession && activeSession.workoutTemplateId === entry.workoutTemplateId) {
      navigation.navigate('ActiveSession', { sessionId: activeSession.id });
      return;
    }
    if (blockedByActiveSession()) return;

    await startSession(
      entry.workoutTemplateId,
      entry.workoutName,
      getCurrentDayOfWeek(),
      await resolveExercises(entry.orderedExerciseIds)
    );
    goToActiveSession();
  }

  async function handleStartStandalone(template: WorkoutTemplate) {
    if (blockedByActiveSession()) return;
    const day = await getStandaloneDay(template.id);
    // No weekday — a standalone workout belongs to none.
    await startSession(
      template.id,
      template.name,
      null,
      await resolveExercises(day?.orderedExerciseIds ?? [])
    );
    goToActiveSession();
  }

  async function handleQuickWorkout() {
    if (blockedByActiveSession()) return;
    // No template, no weekday, no exercises — they get added as you go.
    await startSession(null, 'Quick Workout', null, []);
    goToActiveSession();
  }

  const standalone = templates.filter((t) => t.scheduleType === 'standalone');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <TouchableOpacity style={styles.quickBtn} onPress={handleQuickWorkout}>
        <Text style={styles.quickBtnText}>Start a Quick Workout</Text>
        <Text style={styles.quickBtnSub}>No plan — add exercises as you go</Text>
      </TouchableOpacity>

      {todayEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today</Text>
          <View style={styles.card}>
            {todayEntries.map((entry, index) => {
              const isActiveMatch =
                activeSession && activeSession.workoutTemplateId === entry.workoutTemplateId;
              return (
                <View key={entry.id}>
                  <View style={styles.todayRow}>
                    <View style={styles.todayInfo}>
                      <Text style={styles.todayWorkoutName}>{entry.workoutName}</Text>
                      <Text style={styles.todayDayText}>{entry.dayOfWeek}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.startBtn, isActiveMatch && styles.resumeBtn]}
                      onPress={() => handleStartOrResume(entry)}
                    >
                      <Text style={styles.startBtnText}>{isActiveMatch ? 'Resume' : 'Start'}</Text>
                    </TouchableOpacity>
                  </View>
                  {index < todayEntries.length - 1 && <View style={styles.separator} />}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {standalone.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anytime</Text>
          <View style={styles.card}>
            {standalone.map((template, index) => (
              <View key={template.id}>
                <View style={styles.todayRow}>
                  <TouchableOpacity
                    style={styles.todayInfo}
                    onPress={() => navigation.navigate('WorkoutDetail', { templateId: template.id })}
                  >
                    <Text style={styles.todayWorkoutName}>{template.name}</Text>
                    <Text style={styles.todayDayText}>Any day</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.startBtn}
                    onPress={() => handleStartStandalone(template)}
                  >
                    <Text style={styles.startBtnText}>Start</Text>
                  </TouchableOpacity>
                </View>
                {index < standalone.length - 1 && <View style={styles.separator} />}
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
            {templates.map((template, index) => (
              <View key={template.id}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => navigation.navigate('WorkoutDetail', { templateId: template.id })}
                >
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateType}>
                    {template.scheduleType === 'standalone' ? 'Any day' : 'Weekly'}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
                {index < templates.length - 1 && <View style={styles.separator} />}
              </View>
            ))}
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

            <Text style={styles.inputLabel}>Schedule</Text>
            <View style={styles.segmented}>
              <TouchableOpacity
                style={[styles.segment, newType === 'weekly' && styles.segmentActive]}
                onPress={() => setNewType('weekly')}
              >
                <Text
                  style={[styles.segmentText, newType === 'weekly' && styles.segmentTextActive]}
                >
                  Weekly
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, newType === 'standalone' && styles.segmentActive]}
                onPress={() => setNewType('standalone')}
              >
                <Text
                  style={[styles.segmentText, newType === 'standalone' && styles.segmentTextActive]}
                >
                  Any day
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              {newType === 'weekly'
                ? 'Exercises are set per day of the week.'
                : 'One exercise list, started whenever you like.'}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.createBtn]} onPress={handleCreate}>
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
  quickBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  quickBtnText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  quickBtnSub: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
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
  templateType: {
    fontSize: 13,
    color: '#999',
    marginRight: 8,
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
  segmented: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  segmentActive: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
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
