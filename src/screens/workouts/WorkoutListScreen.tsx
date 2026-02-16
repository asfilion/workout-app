import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function WorkoutListScreen() {
  return (
    <View style={styles.container}>
      <Text>Workout List</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
