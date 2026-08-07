import { Timestamp, type DocumentData } from '@react-native-firebase/firestore';

import type { PreparationItem, PreparationState } from '../types/preparation';
import { isPreparationCategory } from './preparationDomain';

function readTimestamp(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function isNullableString(value: unknown, maxLength: number): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= maxLength);
}

export function parsePreparationItem(documentId: string, data: DocumentData): PreparationItem | null {
  if (
    data.id !== documentId
    || typeof data.title !== 'string'
    || data.title.length < 2
    || data.title.length > 100
    || !isPreparationCategory(data.category)
    || typeof data.completed !== 'boolean'
    || (data.source !== 'default' && data.source !== 'custom')
    || !Number.isInteger(data.sortOrder)
    || data.sortOrder < 0
    || (data.priority !== 'normal' && data.priority !== 'important')
    || !isNullableString(data.helper, 240)
    || !isNullableString(data.templateKey, 100)
    || !(data.templateVersion === null || (Number.isInteger(data.templateVersion) && data.templateVersion >= 1))
  ) {
    return null;
  }

  if (data.source === 'default' && (data.templateKey === null || data.templateVersion === null)) return null;
  if (data.source === 'custom' && (data.templateKey !== null || data.templateVersion !== null)) return null;

  return {
    id: documentId,
    title: data.title,
    category: data.category,
    completed: data.completed,
    source: data.source,
    sortOrder: data.sortOrder,
    priority: data.priority,
    helper: data.helper,
    templateKey: data.templateKey,
    templateVersion: data.templateVersion,
    createdAt: readTimestamp(data.createdAt),
    updatedAt: readTimestamp(data.updatedAt),
    completedAt: readTimestamp(data.completedAt),
  };
}

export function parsePreparationState(data: DocumentData | undefined): PreparationState | null {
  if (
    !data
    || !Number.isInteger(data.templateVersion)
    || data.templateVersion < 0
    || typeof data.longPressHintDismissed !== 'boolean'
  ) {
    return null;
  }
  return {
    templateVersion: data.templateVersion,
    longPressHintDismissed: data.longPressHintDismissed,
  };
}
