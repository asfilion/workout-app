import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getAllSetsForExport } from '../db/sessions';
import { convertWeight } from './units';
import { type WeightUnit } from '../types';

export async function exportSetsCsv(unit: WeightUnit): Promise<void> {
  const rows = await getAllSetsForExport();
  const header = 'sessionId,sessionStatus,workoutName,dayOfWeek,sessionStartedAt,sessionEndedAt,setLoggedAt,exerciseId,exerciseName,weight,reps';
  const csvRows = rows.map(r => {
    const w = convertWeight(r.weight, unit);
    return [r.sessionId, r.sessionStatus, `"${r.workoutName}"`, r.dayOfWeek ?? '',
      r.sessionStartedAt, r.sessionEndedAt ?? '', r.setLoggedAt,
      r.exerciseId, `"${r.exerciseName}"`, w, r.reps].join(',');
  });
  const csv = [header, ...csvRows].join('\n');
  const fileUri = FileSystem.documentDirectory + 'workout-sets-export.csv';
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Workout Sets' });
}
