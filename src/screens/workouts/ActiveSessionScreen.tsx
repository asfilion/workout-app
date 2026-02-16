import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ActiveSessionScreen() {
  return (
    <View style={styles.container}>
      <Text>Active Session</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
