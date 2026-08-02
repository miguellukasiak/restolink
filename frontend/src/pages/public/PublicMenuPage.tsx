import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import CssBaseline from '@mui/material/CssBaseline';
import { alpha } from '@mui/material/styles';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import type { PublicMenuItem } from '../../types';
import { usePublicMenu } from '../../hooks/usePublicMenu';
import { getApiErrorMessage } from '../../services/api';
import { resolveAccessState } from '../../constants/subscription';
import { PublicMenuView } from '../../components/public/PublicMenuView';
import { PublicMenuSkeleton } from '../../components/public/PublicMenuSkeleton';
import { ItemDetailModal } from '../../components/public/ItemDetailModal';
import { AllergyGateModal } from '../../components/public/AllergyGateModal';

interface AllergyPrefs {
  answered: boolean;
  selected: string[];
}

const emptyPrefs: AllergyPrefs = { answered: false, selected: [] };

/** Session-scoped storage key so a refresh (not a new session) keeps the answer. */
const allergyStorageKey = (restaurantId: string) => `restolink:allergy:${restaurantId}`;

/** Reads persisted allergy prefs for this restaurant (safe against bad JSON). */
function readAllergyPrefs(restaurantId: string): AllergyPrefs {
  if (!restaurantId) return emptyPrefs;
  try {
    const raw = sessionStorage.getItem(allergyStorageKey(restaurantId));
    if (!raw) return emptyPrefs;
    const parsed = JSON.parse(raw) as Partial<AllergyPrefs>;
    return {
      answered: Boolean(parsed.answered),
      selected: Array.isArray(parsed.selected) ? parsed.selected.filter((a) => typeof a === 'string') : [],
    };
  } catch {
    return emptyPrefs;
  }
}

/** Clean, centered status screen shown when the menu isn't publicly available. */
function StatusScreen({
  icon,
  message,
}: {
  icon: 'blocked' | 'pending';
  message: string;
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        textAlign: 'center',
      }}
    >
      <Stack spacing={2.5} sx={{ alignItems: 'center', maxWidth: 420 }}>
        <Avatar
          sx={{
            width: 72,
            height: 72,
            bgcolor: (t) =>
              alpha(
                icon === 'blocked' ? t.palette.text.primary : t.palette.warning.main,
                0.1,
              ),
            color: icon === 'blocked' ? 'text.secondary' : 'warning.dark',
          }}
        >
          {icon === 'blocked' ? (
            <LockRoundedIcon sx={{ fontSize: 36 }} />
          ) : (
            <HourglassTopRoundedIcon sx={{ fontSize: 36 }} />
          )}
        </Avatar>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          {message}
        </Typography>
      </Stack>
    </Box>
  );
}

/**
 * Public client menu route (`/menu/:restaurantId`). Data + modal orchestration
 * around the shared PublicMenuView (also reused by the settings live preview).
 */
export function PublicMenuPage() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const { t } = useTranslation();
  const menu = usePublicMenu(restaurantId);

  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ── Allergy filter state (persisted per restaurant for this browser session) ──
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>(
    () => readAllergyPrefs(restaurantId).selected,
  );
  const [hasAnsweredAllergyPrompt, setHasAnsweredAllergyPrompt] = useState<boolean>(
    () => readAllergyPrefs(restaurantId).answered,
  );
  const [gateOpen, setGateOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const restaurantName = menu.data?.restaurant.name ?? '';

  useEffect(() => {
    if (restaurantName) document.title = `${restaurantName} — Menu`;
  }, [restaurantName]);

  const openDetail = (item: PublicMenuItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  // Gate the menu on the restaurant's subscription status (blocked/pending/active).
  const access = menu.data
    ? resolveAccessState(
        menu.data.restaurant.status,
        menu.data.restaurant.subscription_valid_until,
      )
    : null;

  // Unique, sorted allergens actually present across this restaurant's dishes.
  const availableAllergens = useMemo(() => {
    if (!menu.data) return [];
    const set = new Set<string>();
    for (const category of menu.data.categories) {
      for (const item of category.items) {
        for (const allergen of item.allergens) set.add(allergen);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [menu.data]);

  // Drop any persisted exclusions that no longer exist in the menu.
  useEffect(() => {
    if (availableAllergens.length === 0) return;
    setSelectedAllergens((prev) => {
      const pruned = prev.filter((a) => availableAllergens.includes(a));
      return pruned.length === prev.length ? prev : pruned;
    });
  }, [availableAllergens]);

  // Persist the answer + exclusions so a refresh doesn't re-prompt.
  useEffect(() => {
    if (!restaurantId) return;
    sessionStorage.setItem(
      allergyStorageKey(restaurantId),
      JSON.stringify({ answered: hasAnsweredAllergyPrompt, selected: selectedAllergens }),
    );
  }, [restaurantId, hasAnsweredAllergyPrompt, selectedAllergens]);

  // Welcome gate: open once, right after the menu loads, if not yet answered and
  // there are allergens worth filtering — a seamless hand-off from the splash.
  useEffect(() => {
    if (
      !autoOpenedRef.current &&
      access === 'ACTIVE' &&
      !hasAnsweredAllergyPrompt &&
      availableAllergens.length > 0
    ) {
      autoOpenedRef.current = true;
      setGateOpen(true);
    }
  }, [access, hasAnsweredAllergyPrompt, availableAllergens.length]);

  const handleApplyAllergens = (selected: string[]) => {
    setSelectedAllergens(selected);
    setHasAnsweredAllergyPrompt(true);
    setGateOpen(false);
  };

  const handleSkipAllergens = () => {
    setSelectedAllergens([]);
    setHasAnsweredAllergyPrompt(true);
    setGateOpen(false);
  };

  const handleCloseGate = () => {
    // Dismissing the one-time welcome gate still counts as answered; in edit
    // mode it just closes without touching the active filters.
    setHasAnsweredAllergyPrompt(true);
    setGateOpen(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />

      {menu.isLoading && <PublicMenuSkeleton />}

      {menu.isError && (
        <Box sx={{ maxWidth: 960, mx: 'auto', px: 2 }}>
          <Alert
            severity="error"
            sx={{ mt: 3 }}
            action={
              <Button color="inherit" size="small" onClick={() => void menu.refetch()}>
                {t('retry')}
              </Button>
            }
          >
            {getApiErrorMessage(menu.error)}
          </Alert>
        </Box>
      )}

      {access === 'BLOCKED' && (
        <StatusScreen icon="blocked" message="Menu chwilowo niedostępne." />
      )}

      {access === 'PENDING' && (
        <StatusScreen
          icon="pending"
          message="Restauracja w przygotowaniu. Zapraszamy wkrótce!"
        />
      )}

      {access === 'ACTIVE' && menu.data && (
        <>
          <PublicMenuView
            restaurantName={menu.data.restaurant.name}
            logoUrl={menu.data.restaurant.theme.logo_url}
            categories={menu.data.categories}
            onOpenItem={openDetail}
            selectedAllergens={selectedAllergens}
            canFilterAllergens={availableAllergens.length > 0}
            onOpenAllergyFilter={() => setGateOpen(true)}
          />
          <ItemDetailModal
            item={selectedItem}
            open={detailOpen}
            onClose={() => setDetailOpen(false)}
          />
          <AllergyGateModal
            open={gateOpen}
            mode={hasAnsweredAllergyPrompt ? 'edit' : 'welcome'}
            allergens={availableAllergens}
            initialSelected={selectedAllergens}
            onApply={handleApplyAllergens}
            onSkip={handleSkipAllergens}
            onClose={handleCloseGate}
          />
        </>
      )}
    </Box>
  );
}
