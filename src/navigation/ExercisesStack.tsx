import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExerciseListScreen from '../screens/exercises/ExerciseListScreen';
import ExerciseDetailScreen from '../screens/exercises/ExerciseDetailScreen';

export type ExercisesStackParamList = {
  ExerciseList: undefined;
  ExerciseDetail: { exerciseId: string; exerciseName: string };
};

const Stack = createNativeStackNavigator<ExercisesStackParamList>();

export function ExercisesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ExerciseList" component={ExerciseListScreen} options={{ title: 'Exercises' }} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: 'History' }} />
    </Stack.Navigator>
  );
}
