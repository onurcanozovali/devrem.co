import { useMemo } from 'react';

import { calculatePreparationSummary } from '../services/preparationDomain';
import { usePreparation } from './usePreparation';

export function usePreparationSummary() {
  const { items } = usePreparation();
  return useMemo(() => calculatePreparationSummary(items), [items]);
}
