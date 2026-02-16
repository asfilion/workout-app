import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatElapsed } from '../utils/time';

interface Props {
  label: string;
  startTimestamp: string | null;
}

export default function TimerDisplay({ label, startTimestamp }: Props) {
  const [display, setDisplay] = useState('0:00');

  useEffect(() => {
    if (!startTimestamp) { setDisplay('0:00'); return; }
    const tick = () => setDisplay(formatElapsed(startTimestamp));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTimestamp]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.time}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 8 },
  label: { fontSize: 12, color: '#666' },
  time: { fontSize: 24, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
});
