export const DIRECT_INBOX_REALTIME_LISTENER_COUNT = 3;

type Subscribe = () => () => void;

export function subscribeToDirectInboxSources(sources: readonly [Subscribe, Subscribe, Subscribe]): () => void {
  const unsubscribers = sources.map((subscribe) => subscribe());
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
