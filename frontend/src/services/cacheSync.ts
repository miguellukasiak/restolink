import type { Mutation, QueryClient, QueryKey } from '@tanstack/react-query';

/*
 * Keeps every screen in step with every change, in this tab and the others.
 *
 * Each query says what its answer is built from (`meta.reads`), each mutation
 * what it changes (`meta.writes`). When a write succeeds, every cached query
 * of that restaurant that reads it is invalidated: those on screen refetch at
 * once, the rest the next time they are shown. So a dish renamed in the
 * builder is renamed on "Menu design", in "Languages" and on the guest menu,
 * and a new look reaches the builder's phone — without a refresh.
 *
 * One declaration per hook instead of an invalidateQueries in each: the old
 * way, every mutation had to know every page that happened to read its data,
 * and the builder's dish edits never told "Menu design" about the dishes.
 *
 * Other tabs of the same browser hear about the write over a
 * BroadcastChannel and invalidate the same queries — the guest menu the owner
 * opened with "Open", or the panel in a second tab, updates as they work.
 * Only the restaurant id and the resource names cross; never data.
 */

/** What an owner can change, as the queries that show it see it. */
export type Resource = 'menu' | 'theme' | 'languages' | 'dictionary' | 'reviews';

const RESOURCES: readonly Resource[] = [
  'menu',
  'theme',
  'languages',
  'dictionary',
  'reviews',
];

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /** What the answer is built from. */
      reads?: readonly Resource[];
    };
    mutationMeta: {
      restaurantId?: string;
      /** What a success changes. */
      writes?: readonly Resource[];
      /**
       * Queries the mutation keeps correct itself (seeded from its response,
       * or a drag's layout it must not re-read mid-gesture) — left alone.
       */
      fresh?: readonly QueryKey[];
    };
  }
}

/** Meta for a mutation that changes `writes` of one restaurant. */
export function writesTo(
  restaurantId: string,
  writes: readonly Resource[],
  fresh: readonly QueryKey[] = [],
) {
  return { restaurantId, writes, fresh };
}

const sameKey = (a: QueryKey, b: QueryKey) =>
  a.length === b.length && a.every((part, index) => part === b[index]);

/** Invalidates every query of `restaurantId` that reads any of `writes`. */
export function invalidateReaders(
  queryClient: QueryClient,
  restaurantId: string,
  writes: readonly Resource[],
  fresh: readonly QueryKey[] = [],
) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey.includes(restaurantId) &&
      (query.meta?.reads ?? []).some((resource) => writes.includes(resource)) &&
      !fresh.some((key) => sameKey(key, query.queryKey)),
  });
}

const CHANNEL = 'restolink.cache';
let channel: BroadcastChannel | null = null;

interface WriteMessage {
  restaurantId: string;
  writes: Resource[];
}

function isWriteMessage(data: unknown): data is WriteMessage {
  if (typeof data !== 'object' || data === null) return false;
  const { restaurantId, writes } = data as Record<string, unknown>;
  return (
    typeof restaurantId === 'string' &&
    Array.isArray(writes) &&
    writes.every((resource) => RESOURCES.includes(resource as Resource))
  );
}

/**
 * The MutationCache's `onSuccess`. Deferred a task on purpose: the mutation's
 * own `onSuccess` runs after this one, and a hook that seeds or patches the
 * cache from its response (the theme, the dictionary) must have done so
 * before the invalidation marks it all stale — so screens show the new data
 * at once and refetch only to confirm it.
 */
export function afterWrite(
  queryClient: QueryClient,
  mutation: Mutation<unknown, unknown, unknown, unknown>,
) {
  const { restaurantId, writes, fresh } = mutation.meta ?? {};
  if (!restaurantId || !writes?.length) return;
  setTimeout(() => {
    void invalidateReaders(queryClient, restaurantId, writes, fresh);
    // The other tabs hold none of the data this mutation seeded, so they
    // invalidate everything that reads it.
    channel?.postMessage({ restaurantId, writes: [...writes] } satisfies WriteMessage);
  }, 0);
}

/** Listens for writes made in other tabs. Call once, at start-up. */
export function listenToOtherTabs(queryClient: QueryClient): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (isWriteMessage(event.data)) {
      void invalidateReaders(queryClient, event.data.restaurantId, event.data.writes);
    }
  };
  const own = channel;
  return () => {
    own.close();
    if (channel === own) channel = null;
  };
}
