import { useContext } from 'react';

import { PreparationContext } from '../PreparationProvider';

export function usePreparation() {
  const context = useContext(PreparationContext);
  if (!context) throw new Error('usePreparation must be used within PreparationProvider.');
  return context;
}
