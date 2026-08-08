import { useMemo } from 'react';

import { calculatePreparationSummary } from '../services/preparationDomain';
import type { PreparationItem } from '../types/preparation';

export function usePreparationSummary(items: PreparationItem[]) {
  return useMemo(() => calculatePreparationSummary(items), [items]);
}
