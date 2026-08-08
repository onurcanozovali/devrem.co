import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  createPreparationItem,
  dismissPreparationHint,
  initializePreparation,
  removePreparationItem,
  restoreMissingPreparationDefaults,
  subscribeToPreparationItems,
  subscribeToPreparationState,
  togglePreparationItem,
  updatePreparationItem,
} from '@/services/firebase';
import type { Unsubscribe } from '@react-native-firebase/firestore';
import { getNextPreparationSortOrder } from './services/preparationDomain';
import { mapPreparationError, PreparationFlowError } from './services/preparationErrors';
import type {
  PreparationItem,
  PreparationItemInput,
  PreparationState,
  PreparationStatus,
} from './types/preparation';

interface PreparationContextValue {
  status: PreparationStatus;
  items: PreparationItem[];
  state: PreparationState | null;
  error: string | null;
  actionError: string | null;
  startPreparation: () => Promise<void>;
  retryPreparation: () => Promise<void>;
  addItem: (input: PreparationItemInput) => Promise<void>;
  editItem: (item: PreparationItem, input: PreparationItemInput) => Promise<void>;
  toggleItem: (itemId: string) => Promise<void>;
  deleteItem: (item: PreparationItem) => Promise<void>;
  restoreDefaults: () => Promise<number>;
  dismissHint: () => Promise<void>;
  clearActionError: () => void;
}

export const PreparationContext = createContext<PreparationContextValue | null>(null);

function datesEqual(left: Date | null, right: Date | null) {
  return left?.getTime() === right?.getTime();
}

function itemsEqual(left: PreparationItem, right: PreparationItem) {
  return left.id === right.id
    && left.title === right.title
    && left.category === right.category
    && left.completed === right.completed
    && left.source === right.source
    && left.sortOrder === right.sortOrder
    && left.priority === right.priority
    && left.helper === right.helper
    && left.templateKey === right.templateKey
    && left.templateVersion === right.templateVersion
    && datesEqual(left.createdAt, right.createdAt)
    && datesEqual(left.updatedAt, right.updatedAt)
    && datesEqual(left.completedAt, right.completedAt);
}

export function PreparationProvider({ children }: PropsWithChildren) {
  const { status: authStatus, session } = useAuth();
  const [status, setStatus] = useState<PreparationStatus>('idle');
  const [items, setItems] = useState<PreparationItem[]>([]);
  const [state, setState] = useState<PreparationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const itemsRef = useRef<PreparationItem[]>([]);
  const pendingItemIdsRef = useRef<Set<string>>(new Set());
  const optimisticTogglesRef = useRef(new Map<string, Pick<PreparationItem, 'completed' | 'completedAt'>>());
  const pendingDeletesRef = useRef(new Map<string, PreparationItem>());
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const activeUidRef = useRef<string | null>(null);
  const subscriptionsRef = useRef<Unsubscribe[]>([]);

  const replaceItems = useCallback((nextItems: PreparationItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  const mergeOptimisticItems = useCallback((nextItems: PreparationItem[]) => {
    const previousItems = new Map(itemsRef.current.map((item) => [item.id, item]));
    return nextItems.filter((item) => !pendingDeletesRef.current.has(item.id)).map((item) => {
      const optimisticToggle = optimisticTogglesRef.current.get(item.id);
      const nextItem = optimisticToggle ? { ...item, ...optimisticToggle } : item;
      const previousItem = previousItems.get(item.id);
      return previousItem && itemsEqual(previousItem, nextItem) ? previousItem : nextItem;
    });
  }, []);

  const stopSubscriptions = useCallback(() => {
    subscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
    subscriptionsRef.current = [];
  }, []);

  const loadPreparation = useCallback(async (force: boolean) => {
    if (authStatus !== 'authenticated' || !session) throw new PreparationFlowError('permission-denied');
    const uid = session.userId;
    if (!force && activeUidRef.current === uid && subscriptionsRef.current.length > 0) return;
    if (loadPromiseRef.current) return loadPromiseRef.current;

    stopSubscriptions();
    activeUidRef.current = uid;
    setStatus('loading');
    setError(null);
    setActionError(null);

    const loadPromise = (async () => {
      let receivedItems = false;
      let receivedState = false;
      const handleSubscriptionError = (caughtError: PreparationFlowError) => {
        if (activeUidRef.current !== uid) return;
        if (itemsRef.current.length === 0 && !receivedState) {
          setError(caughtError.message);
          setStatus('error');
        } else {
          setActionError(caughtError.message);
        }
      };

      subscriptionsRef.current = [
        subscribeToPreparationItems(uid, (nextItems) => {
          if (activeUidRef.current !== uid) return;
          receivedItems = true;
          replaceItems(mergeOptimisticItems(nextItems));
          if (nextItems.length > 0 || receivedState) {
            setError(null);
            setStatus('ready');
          }
        }, handleSubscriptionError),
        subscribeToPreparationState(uid, (nextState) => {
          if (activeUidRef.current !== uid || !nextState) return;
          receivedState = true;
          setState(nextState);
          if (receivedItems) {
            setError(null);
            setStatus('ready');
          }
        }, handleSubscriptionError),
      ];

      try {
        const initializedState = await initializePreparation(uid);
        if (activeUidRef.current !== uid) return;
        receivedState = true;
        setState(initializedState);
        if (receivedItems) {
          setError(null);
          setStatus('ready');
        }
      } catch (caughtError: unknown) {
        if (activeUidRef.current !== uid) return;
        const preparationError = mapPreparationError(caughtError);
        if (itemsRef.current.length > 0 || receivedState) {
          setActionError(preparationError.message);
          setStatus('ready');
        } else {
          setError(preparationError.message);
          setStatus('error');
        }
      }
    })();

    loadPromiseRef.current = loadPromise;
    try {
      await loadPromise;
    } finally {
      if (loadPromiseRef.current === loadPromise) loadPromiseRef.current = null;
    }
  }, [authStatus, mergeOptimisticItems, replaceItems, session, stopSubscriptions]);

  const startPreparation = useCallback(() => loadPreparation(false), [loadPreparation]);
  const retryPreparation = useCallback(() => loadPreparation(true), [loadPreparation]);

  useEffect(() => {
    if (authStatus === 'authenticated' && session) return undefined;
    stopSubscriptions();
    activeUidRef.current = null;
    loadPromiseRef.current = null;
    itemsRef.current = [];
    queueMicrotask(() => {
      setStatus('idle');
      setItems([]);
      setState(null);
      setError(null);
      setActionError(null);
      pendingItemIdsRef.current = new Set();
      optimisticTogglesRef.current.clear();
      pendingDeletesRef.current.clear();
    });
    return undefined;
  }, [authStatus, session, stopSubscriptions]);

  useEffect(() => () => stopSubscriptions(), [stopSubscriptions]);

  const requireUid = useCallback((): string => {
    const uid = activeUidRef.current;
    if (!uid) throw new PreparationFlowError('permission-denied');
    return uid;
  }, []);

  const runAction = useCallback(async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (caughtError: unknown) {
      const preparationError = mapPreparationError(caughtError);
      setActionError(preparationError.message);
      throw preparationError;
    }
  }, []);

  const addItem = useCallback(async (input: PreparationItemInput) => {
    const uid = requireUid();
    const sortOrder = getNextPreparationSortOrder(itemsRef.current, input.category);
    await runAction(async () => {
      await createPreparationItem(uid, input, sortOrder);
    });
  }, [requireUid, runAction]);

  const editItem = useCallback(async (item: PreparationItem, input: PreparationItemInput) => {
    const uid = requireUid();
    const sortOrder = item.category === input.category
      ? item.sortOrder
      : getNextPreparationSortOrder(itemsRef.current, input.category);
    await runAction(async () => {
      await updatePreparationItem(uid, item.id, input, sortOrder);
    });
  }, [requireUid, runAction]);

  const toggleItem = useCallback(async (itemId: string) => {
    if (pendingItemIdsRef.current.has(itemId)) return;
    const uid = requireUid();
    const currentItem = itemsRef.current.find((candidate) => candidate.id === itemId);
    if (!currentItem) return;
    const completed = !currentItem.completed;
    const optimisticCompletedAt = completed ? new Date() : null;

    pendingItemIdsRef.current = new Set(pendingItemIdsRef.current).add(itemId);
    optimisticTogglesRef.current.set(itemId, { completed, completedAt: optimisticCompletedAt });
    replaceItems(itemsRef.current.map((candidate) => candidate.id === itemId
      ? { ...candidate, completed, completedAt: optimisticCompletedAt }
      : candidate));

    try {
      await runAction(async () => {
        await togglePreparationItem(uid, itemId, completed);
      });
    } catch {
      optimisticTogglesRef.current.delete(itemId);
      replaceItems(itemsRef.current.map((candidate) => (
        candidate.id === itemId && candidate.completed === completed
          ? { ...candidate, completed: currentItem.completed, completedAt: currentItem.completedAt }
          : candidate
      )));
    } finally {
      optimisticTogglesRef.current.delete(itemId);
      const next = new Set(pendingItemIdsRef.current);
      next.delete(itemId);
      pendingItemIdsRef.current = next;
    }
  }, [replaceItems, requireUid, runAction]);

  const deleteItem = useCallback(async (item: PreparationItem) => {
    const uid = requireUid();
    pendingDeletesRef.current.set(item.id, item);
    replaceItems(itemsRef.current.filter((candidate) => candidate.id !== item.id));
    try {
      await runAction(async () => {
        await removePreparationItem(uid, item.id);
      });
    } catch (caughtError) {
      if (!itemsRef.current.some((candidate) => candidate.id === item.id)) {
        replaceItems([...itemsRef.current, item].sort((left, right) => (
          left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)
        )));
      }
      throw caughtError;
    } finally {
      pendingDeletesRef.current.delete(item.id);
    }
  }, [replaceItems, requireUid, runAction]);

  const restoreDefaults = useCallback(async (): Promise<number> => {
    const uid = requireUid();
    setActionError(null);
    try {
      return await restoreMissingPreparationDefaults(uid);
    } catch (caughtError: unknown) {
      const preparationError = mapPreparationError(caughtError);
      setActionError(preparationError.message);
      throw preparationError;
    }
  }, [requireUid]);

  const dismissHint = useCallback(async () => {
    const uid = requireUid();
    const previousState = state;
    if (previousState?.longPressHintDismissed) return;
    setState((current) => current ? { ...current, longPressHintDismissed: true } : current);
    try {
      await dismissPreparationHint(uid);
    } catch (caughtError: unknown) {
      setState(previousState);
      setActionError(mapPreparationError(caughtError).message);
    }
  }, [requireUid, state]);

  const clearActionError = useCallback(() => setActionError(null), []);

  const value = useMemo<PreparationContextValue>(() => ({
    status,
    items,
    state,
    error,
    actionError,
    startPreparation,
    retryPreparation,
    addItem,
    editItem,
    toggleItem,
    deleteItem,
    restoreDefaults,
    dismissHint,
    clearActionError,
  }), [
    actionError,
    addItem,
    clearActionError,
    deleteItem,
    dismissHint,
    editItem,
    error,
    items,
    restoreDefaults,
    retryPreparation,
    startPreparation,
    state,
    status,
    toggleItem,
  ]);

  return <PreparationContext.Provider value={value}>{children}</PreparationContext.Provider>;
}
