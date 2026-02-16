import { type WeightUnit } from '../types';
const LB_TO_KG = 0.45359237;

export function convertWeight(weightInLb: number, targetUnit: WeightUnit): number {
  if (targetUnit === 'lb') return weightInLb;
  return Math.round(weightInLb * LB_TO_KG * 100) / 100;
}

export function convertToLb(weight: number, fromUnit: WeightUnit): number {
  if (fromUnit === 'lb') return weight;
  return Math.round((weight / LB_TO_KG) * 100) / 100;
}

export function formatWeight(weightInLb: number, unit: WeightUnit): string {
  const converted = convertWeight(weightInLb, unit);
  return `${converted} ${unit}`;
}
