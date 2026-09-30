import { afterEach, describe, expect, it } from 'vitest';
import {
  MutationCache,
  MutationObserver,
  QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { afterWrite, listenToOtherTabs, writesTo, type Resource } from './cacheSync';

const RID = 'r-1';
const OTHER = 'r-2';

function client(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    mutationCache: new MutationCache({
      onSuccess: (_data, _variables, _context, mutation) =>
        afterWrite(queryClient, mutation),
    }),
  });
  return queryClient;
}

async function seed(
  queryClient: QueryClient,
  queryKey: QueryKey,
  reads: readonly Resource[],
) {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn: () => 'data',
    meta: { reads },
    staleTime: Infinity,
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

async function write(
  queryClient: QueryClient,
  meta: ReturnType<typeof writesTo>,
  onSuccess?: () => void,
) {
  await new MutationObserver(queryClient, {
    mutationFn: async () => 'ok',
    meta,
    onSuccess,
  }).mutate();
  await settle();
}

const invalidated = (queryClient: QueryClient, key: QueryKey) =>
  queryClient.getQueryState(key)?.isInvalidated ?? false;

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

describe('the cache dependency map', () => {
  it('refreshes every screen that reads what a write changed', async () => {
    const queryClient = client();
    await seed(queryClient, ['menu', 'categories', RID], ['menu']);
    await seed(queryClient, ['public-menu', RID, 'pl'], ['menu', 'theme']);
    await seed(queryClient, ['public-menu', RID, 'de'], ['menu', 'theme']);
    await seed(queryClient, ['google-reviews', RID], ['reviews']);
    await seed(queryClient, ['public-menu', OTHER, 'pl'], ['menu', 'theme']);

    await write(queryClient, writesTo(RID, ['menu']));

    expect(invalidated(queryClient, ['menu', 'categories', RID])).toBe(true);
    expect(invalidated(queryClient, ['public-menu', RID, 'pl'])).toBe(true);
    expect(invalidated(queryClient, ['public-menu', RID, 'de'])).toBe(true);
    // Not built from the menu; another restaurant's menu is not this one.
    expect(invalidated(queryClient, ['google-reviews', RID])).toBe(false);
    expect(invalidated(queryClient, ['public-menu', OTHER, 'pl'])).toBe(false);
  });

  it('leaves alone what the mutation keeps correct itself', async () => {
    const queryClient = client();
    await seed(queryClient, ['menu', 'categories', RID], ['menu']);
    await seed(queryClient, ['public-menu', RID, 'pl'], ['menu']);

    await write(queryClient, writesTo(RID, ['menu'], [['menu', 'categories', RID]]));

    expect(invalidated(queryClient, ['menu', 'categories', RID])).toBe(false);
    expect(invalidated(queryClient, ['public-menu', RID, 'pl'])).toBe(true);
  });

  it("lets a mutation's own onSuccess seed the cache before invalidating", async () => {
    const queryClient = client();
    await seed(queryClient, ['public-menu', RID, 'pl'], ['theme']);
    const order: string[] = [];
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'invalidate') {
        order.push('invalidate');
      }
    });
    cleanups.push(unsubscribe);

    await write(queryClient, writesTo(RID, ['theme']), () => {
      queryClient.setQueryData(['public-menu', RID, 'pl'], 'patched');
      order.push('seed');
    });

    expect(order).toEqual(['seed', 'invalidate']);
    expect(queryClient.getQueryData(['public-menu', RID, 'pl'])).toBe('patched');
  });

  it('tells the other tabs, which refresh the same screens', async () => {
    const guestTab = client();
    const panelTab = client();
    cleanups.push(listenToOtherTabs(guestTab), listenToOtherTabs(panelTab));
    await seed(guestTab, ['public-menu', RID, 'de'], ['menu', 'theme']);
    await seed(guestTab, ['google-reviews', RID], ['reviews']);

    // Seeded in the panel tab and marked fresh there — the guest tab has no
    // such copy, so it refreshes regardless.
    await write(panelTab, writesTo(RID, ['theme'], [['public-menu', RID, 'de']]));
    await settle();

    expect(invalidated(guestTab, ['public-menu', RID, 'de'])).toBe(true);
    expect(invalidated(guestTab, ['google-reviews', RID])).toBe(false);
  });
});

/** Mutations that change nothing a screen reads, and why. */
const WRITES_NOTHING: Record<string, string> = {
  useCheckout: 'hands the browser to Stripe; the return trip re-reads the account',
  useAutoTranslate: 'machine drafts land unsaved in the editor',
};

/** HQ's hooks: they refresh HQ's own lists, not a restaurant's screens. */
const HQ_HOOKS = [
  'useHq.ts',
  'useOnboarding.ts',
  'useAddRestaurant.ts',
  'useManualPayment.ts',
];

const HOOKS = import.meta.glob('../hooks/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('the owner panel hooks', () => {
  it('declare what every mutation writes', () => {
    const undeclared: string[] = [];
    for (const [path, source] of Object.entries(HOOKS)) {
      if (HQ_HOOKS.some((file) => path.endsWith(`/${file}`))) continue;
      for (const chunk of source.split('export function ').slice(1)) {
        const name = chunk.match(/^(\w+)/)?.[1] ?? '?';
        if (!chunk.includes('useMutation(') || name in WRITES_NOTHING) continue;
        if (!/meta: writesTo\(/.test(chunk)) undeclared.push(`${path}: ${name}`);
      }
    }
    // A write without `meta` refreshes no other screen — the stale "Menu
    // design" after editing a dish in the builder was exactly that.
    expect(undeclared).toEqual([]);
  });
});
