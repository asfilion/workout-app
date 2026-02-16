import { create } from 'zustand';
import { type WeightUnit } from '../types';
import { Storage } from 'expo-sqlite/kv-store';

interface SettingsState {
  unit: WeightUnit;
  loaded: boolean;
  setUnit: (unit: WeightUnit) => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  unit: 'lb',
  loaded: false,
  setUnit: (unit) => {
    set({ unit });
    try { Storage.setItemSync('unit', unit); } catch {}
  },
  loadSettings: async () => {
    let unit: WeightUnit = 'lb';
    try { const val = Storage.getItemSync('unit'); if (val === 'kg') unit = 'kg'; } catch {}
    set({ unit, loaded: true });
  },
}));
