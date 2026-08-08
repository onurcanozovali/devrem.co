import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from '@react-native-firebase/firestore';

import { mapPreparationError, PreparationFlowError } from '@/features/preparation/services/preparationErrors';
import {
  normalizePreparationTitle,
  validatePreparationTitle,
  getMissingDefaultItems,
  getTemplateItemsIntroducedAfter,
} from '@/features/preparation/services/preparationDomain';
import {
  parsePreparationItem,
  parsePreparationState,
} from '@/features/preparation/services/preparationSerialization';
import {
  PREPARATION_TEMPLATE,
  PREPARATION_TEMPLATE_VERSION,
} from '@/features/preparation/preparationTemplate';
import type {
  PreparationItem,
  PreparationItemInput,
  PreparationState,
  PreparationTemplateItem,
} from '@/features/preparation/types/preparation';
import { getFirebaseApp } from './app';

const PREPARATION_STATE_DOCUMENT_ID = 'main';

function getFirestoreDatabase() {
  return getFirestore(getFirebaseApp());
}

function getPreparationItemsReference(uid: string) {
  return collection(getFirestoreDatabase(), 'users', uid, 'preparationItems');
}

function getPreparationItemReference(uid: string, itemId: string) {
  return doc(getFirestoreDatabase(), 'users', uid, 'preparationItems', itemId);
}

function getPreparationStateReference(uid: string) {
  return doc(getFirestoreDatabase(), 'users', uid, 'preparationState', PREPARATION_STATE_DOCUMENT_ID);
}

function serializeDefaultItem(item: PreparationTemplateItem): DocumentData {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    completed: false,
    source: 'default',
    sortOrder: item.sortOrder,
    priority: item.priority,
    helper: item.helper,
    templateKey: item.templateKey,
    templateVersion: item.introducedInVersion,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
  };
}

export async function initializePreparation(uid: string): Promise<PreparationState> {
  const database = getFirestoreDatabase();
  const stateReference = getPreparationStateReference(uid);

  try {
    return await runTransaction(database, async (transaction) => {
      const stateSnapshot = await transaction.get(stateReference);
      const previousState = stateSnapshot.exists()
        ? parsePreparationState(stateSnapshot.data())
        : null;

      if (stateSnapshot.exists() && !previousState) throw new PreparationFlowError('malformed');
      if (previousState && previousState.templateVersion >= PREPARATION_TEMPLATE_VERSION) return previousState;

      const previousVersion = previousState?.templateVersion ?? 0;
      for (const item of getTemplateItemsIntroducedAfter(previousVersion)) {
        transaction.set(getPreparationItemReference(uid, item.id), serializeDefaultItem(item));
      }

      const nextState: PreparationState = {
        templateVersion: PREPARATION_TEMPLATE_VERSION,
        longPressHintDismissed: previousState?.longPressHintDismissed ?? false,
      };
      transaction.set(stateReference, {
        ...nextState,
        createdAt: stateSnapshot.exists() ? stateSnapshot.get('createdAt') : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return nextState;
    });
  } catch (error: unknown) {
    throw mapPreparationError(error);
  }
}

export function subscribeToPreparationItems(
  uid: string,
  onItems: (items: PreparationItem[]) => void,
  onError: (error: PreparationFlowError) => void,
): Unsubscribe {
  return onSnapshot(
    getPreparationItemsReference(uid),
    (snapshot) => {
      let hasMalformedItem = false;
      const items = snapshot.docs.flatMap((itemSnapshot) => {
        const item = parsePreparationItem(itemSnapshot.id, itemSnapshot.data());
        if (!item) hasMalformedItem = true;
        return item ? [item] : [];
      });
      items.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
      onItems(items);
      if (hasMalformedItem) onError(new PreparationFlowError('malformed'));
    },
    (error) => onError(mapPreparationError(error)),
  );
}

export function subscribeToPreparationState(
  uid: string,
  onState: (state: PreparationState | null) => void,
  onError: (error: PreparationFlowError) => void,
): Unsubscribe {
  return onSnapshot(
    getPreparationStateReference(uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onState(null);
        return;
      }
      const state = parsePreparationState(snapshot.data());
      if (state) onState(state);
      else onError(new PreparationFlowError('malformed'));
    },
    (error) => onError(mapPreparationError(error)),
  );
}

export async function createPreparationItem(
  uid: string,
  input: PreparationItemInput,
  sortOrder: number,
): Promise<string> {
  const titleError = validatePreparationTitle(input.title);
  if (titleError) throw new PreparationFlowError('malformed');
  const itemReference = doc(getPreparationItemsReference(uid));

  try {
    await setDoc(itemReference, {
      id: itemReference.id,
      title: normalizePreparationTitle(input.title),
      category: input.category,
      completed: false,
      source: 'custom',
      sortOrder,
      priority: 'normal',
      helper: null,
      templateKey: null,
      templateVersion: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: null,
    });
    return itemReference.id;
  } catch (error: unknown) {
    throw mapPreparationError(error);
  }
}

export async function updatePreparationItem(
  uid: string,
  itemId: string,
  input: PreparationItemInput,
  sortOrder: number,
): Promise<void> {
  const titleError = validatePreparationTitle(input.title);
  if (titleError) throw new PreparationFlowError('malformed');

  try {
    await updateDoc(getPreparationItemReference(uid, itemId), {
      title: normalizePreparationTitle(input.title),
      category: input.category,
      sortOrder,
      updatedAt: serverTimestamp(),
    });
  } catch (error: unknown) {
    throw mapPreparationError(error);
  }
}

export async function togglePreparationItem(
  uid: string,
  itemId: string,
  completed: boolean,
): Promise<void> {
  try {
    await updateDoc(getPreparationItemReference(uid, itemId), {
      completed,
      completedAt: completed ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  } catch (error: unknown) {
    throw mapPreparationError(error);
  }
}

export async function removePreparationItem(uid: string, itemId: string): Promise<void> {
  try {
    await deleteDoc(getPreparationItemReference(uid, itemId));
  } catch (error: unknown) {
    throw mapPreparationError(error);
  }
}

export async function dismissPreparationHint(uid: string): Promise<void> {
  try {
    await updateDoc(getPreparationStateReference(uid), {
      longPressHintDismissed: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error: unknown) {
    throw mapPreparationError(error);
  }
}

export async function restoreMissingPreparationDefaults(uid: string): Promise<number> {
  const database = getFirestoreDatabase();
  const stateReference = getPreparationStateReference(uid);

  try {
    return await runTransaction(database, async (transaction) => {
      const [stateSnapshot, ...itemSnapshots] = await Promise.all([
        transaction.get(stateReference),
        ...PREPARATION_TEMPLATE.map((item) => transaction.get(getPreparationItemReference(uid, item.id))),
      ]);
      const existingIds = new Set(
        itemSnapshots.flatMap((snapshot) => snapshot.exists() ? [snapshot.id] : []),
      );
      const missingItems = getMissingDefaultItems(existingIds);

      for (const item of missingItems) {
        transaction.set(getPreparationItemReference(uid, item.id), serializeDefaultItem(item));
      }

      const previousState = stateSnapshot.exists() ? parsePreparationState(stateSnapshot.data()) : null;
      if (stateSnapshot.exists() && !previousState) throw new PreparationFlowError('malformed');
      transaction.set(stateReference, {
        templateVersion: PREPARATION_TEMPLATE_VERSION,
        longPressHintDismissed: previousState?.longPressHintDismissed ?? false,
        createdAt: stateSnapshot.exists() ? stateSnapshot.get('createdAt') : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return missingItems.length;
    });
  } catch (error: unknown) {
    throw mapPreparationError(error);
  }
}
