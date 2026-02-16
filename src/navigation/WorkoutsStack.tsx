import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WorkoutListScreen from '../screens/workouts/WorkoutListScreen';
import WorkoutDetailScreen from '../screens/workouts/WorkoutDetailScreen';
import WorkoutDayDetailScreen from '../screens/workouts/WorkoutDayDetailScreen';
import ActiveSessionScreen from '../screens/workouts/ActiveSessionScreen';

export type WorkoutsStackParamList = {
  WorkoutList: undefined;
  WorkoutDetail: { templateId: string };
  WorkoutDayDetail: { templateId: string; dayOfWeek: string; templateName: string };
  ActiveSession: { sessionId: string };
};

const Stack = createNativeStackNavigator<WorkoutsStackParamList>();

export function WorkoutsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="WorkoutList" component={WorkoutListScreen} options={{ title: 'Workouts' }} />
      <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ title: 'Workout' }} />
      <Stack.Screen name="WorkoutDayDetail" component={WorkoutDayDetailScreen} options={{ title: 'Day' }} />
      <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} options={{ title: 'Session', headerBackVisible: false }} />
    </Stack.Navigator>
  );
}
