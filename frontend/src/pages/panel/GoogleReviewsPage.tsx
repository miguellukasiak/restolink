import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import StarHalfRoundedIcon from '@mui/icons-material/StarHalfRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import { useGoogleReviews, useSaveGooglePlaceId } from '../../hooks/useGoogleReviews';
import { getApiErrorMessage } from '../../services/api';
import type { GoogleReview } from '../../services/googleMapsService';

/** Google's own star gold. Borrowed deliberately: a review widget that uses
 *  the app's purple reads as our opinion of the restaurant, not Google's. */
const STAR_GOLD = '#FBBC04';

const PLACE_ID_FINDER =
  'https://developers.google.com/maps/documentation/places/web-service/place-id';

/** Google's documented way to open a listing when all you have is its id. */
const mapsLink = (placeId: string) =>
  `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;

const SYNC_FORMAT = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'long',
  timeStyle: 'short',
});

function formatSync(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : SYNC_FORMAT.format(parsed);
}

/**
 * A five-star row.
 *
 * Thresholds rather than `Math.round`: 4.4 should not claim four and a half
 * stars it has not earned, and 4.9 should not be shown as 4.5. Quarter-point
 * boundaries are what every review site uses, and matching them is what keeps
 * the row agreeing with the number printed next to it.
 */
function Stars({ value, size = 20 }: { value: number; size?: number }) {
  return (
    <Stack direction="row" sx={{ color: STAR_GOLD, lineHeight: 0 }} aria-hidden>
      {[0, 1, 2, 3, 4].map((index) => {
        const delta = value - index;
        const Icon =
          delta >= 0.75
            ? StarRoundedIcon
            : delta >= 0.25
              ? StarHalfRoundedIcon
              : StarBorderRoundedIcon;
        return <Icon key={index} sx={{ fontSize: size }} />;
      })}
    </Stack>
  );
}

/** The Place ID input, shared by the setup screen and the change panel. */
function PlaceIdField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) {
  return (
    <TextField
      label="Google Place ID"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
      fullWidth
      disabled={disabled}
      slotProps={{ htmlInput: { spellCheck: false, autoCapitalize: 'none' } }}
      helperText="Identyfikator wizytówki, nie adres URL z Google Maps."
    />
  );
}

/** State 1 — nothing connected yet. */
function SetupScreen({
  value,
  onChange,
  onSubmit,
  pending,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <Card sx={{ maxWidth: 620, mx: 'auto' }}>
      <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack spacing={3}>
          <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: alpha(STAR_GOLD, 0.14),
                color: STAR_GOLD,
              }}
            >
              <StarRoundedIcon sx={{ fontSize: 34 }} />
            </Avatar>
            <Box>
              <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
                Połącz opinie z Google
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Podaj Place ID swojej wizytówki, a zobaczysz tutaj ocenę i
                najnowsze opinie gości — bez wychodzenia z panelu.
              </Typography>
            </Box>
          </Stack>

          <Box
            component="ol"
            sx={{
              m: 0,
              pl: 2.5,
              color: 'text.secondary',
              typography: 'body2',
              '& li': { mb: 0.75 },
            }}
          >
            <li>Otwórz wyszukiwarkę Place ID Finder.</li>
            <li>Wpisz nazwę i adres swojej restauracji.</li>
            <li>Skopiuj identyfikator z dymka nad pinezką.</li>
          </Box>

          <PlaceIdField value={value} onChange={onChange} disabled={pending} />

          <Stack
            direction={{ xs: 'column-reverse', sm: 'row' }}
            spacing={1.5}
            sx={{ justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Button
              component={Link}
              href={PLACE_ID_FINDER}
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              endIcon={<OpenInNewRoundedIcon />}
              sx={{ color: 'text.secondary' }}
            >
              Place ID Finder
            </Button>
            <Button
              variant="contained"
              size="large"
              onClick={onSubmit}
              disabled={pending || !value.trim()}
              startIcon={
                pending ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <PlaceRoundedIcon />
                )
              }
            >
              {pending ? 'Łączę…' : 'Połącz wizytówkę'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** One review. */
function ReviewCard({ review }: { review: GoogleReview }) {
  return (
    <Card sx={{ height: '100%', boxShadow: 'none' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2 }}>
          <Avatar
            src={review.profile_photo_url ?? undefined}
            alt=""
            sx={{ width: 44, height: 44, bgcolor: 'secondary.main' }}
          >
            {review.author_name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap sx={{ lineHeight: 1.3 }}>
              {review.author_name}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Stars value={review.rating} size={16} />
              <Typography variant="caption" color="text.secondary">
                {review.relative_time_description}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        {review.text ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}
          >
            {review.text}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            Ocena bez komentarza.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The restaurant owner's Google Maps reviews.
 *
 * Two states, decided by the server's `configured` flag: a setup screen until
 * a Place ID is connected, the dashboard afterwards. The data behind it is
 * cached for 24 hours server-side, so opening this tab repeatedly costs
 * nothing — which is why there is no refresh button here. One would imply a
 * live feed this deliberately is not, and invite exactly the clicking the
 * cache exists to prevent.
 */
export function GoogleReviewsPage() {
  const { restaurantId = '' } = useParams<{ restaurantId: string }>();
  const { showSuccess, showError } = useSnackbar();

  const reviews = useGoogleReviews(restaurantId);
  const save = useSaveGooglePlaceId(restaurantId);

  const [editing, setEditing] = useState(false);
  const [placeId, setPlaceId] = useState('');

  const data = reviews.data;
  const connected = Boolean(data?.configured);
  const syncedAt = formatSync(data?.synced_at ?? null);

  async function submit(value: string) {
    try {
      const result = await save.mutateAsync(value);
      setEditing(false);
      setPlaceId('');
      showSuccess(
        result.configured
          ? 'Wizytówka Google połączona.'
          : 'Wizytówka Google odłączona.',
      );
    } catch (error) {
      showError(getApiErrorMessage(error));
    }
  }

  function openEditor() {
    setPlaceId(data?.place_id ?? '');
    setEditing(true);
  }

  const header = (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5" component="h1" sx={{ mb: 0.5 }}>
        Opinie Google
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Ocena i najnowsze opinie z Twojej wizytówki w Google Maps.
      </Typography>
    </Box>
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (reviews.isLoading) {
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto', py: 3 }}>
        {header}
        <Skeleton variant="rounded" height={180} sx={{ mb: 3, borderRadius: '20px' }} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
          }}
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              height={150}
              sx={{ borderRadius: '20px' }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  // ── Setup, or an explicit request to change the connected listing ──────────
  if (!connected || editing) {
    return (
      <Box sx={{ maxWidth: 1100, mx: 'auto', py: 3 }}>
        {header}

        {/* A failed read still lands here so a wrong Place ID can be corrected.
            Showing the error without a way to act on it would be a dead end. */}
        {reviews.isError && (
          <Alert severity="error" sx={{ maxWidth: 620, mx: 'auto', mb: 3 }}>
            {getApiErrorMessage(reviews.error)}
          </Alert>
        )}

        <SetupScreen
          value={placeId}
          onChange={setPlaceId}
          onSubmit={() => void submit(placeId)}
          pending={save.isPending}
        />

        {editing && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              maxWidth: 620,
              mx: 'auto',
              mt: 2,
              justifyContent: 'space-between',
            }}
          >
            <Button
              color="inherit"
              onClick={() => setEditing(false)}
              disabled={save.isPending}
              sx={{ color: 'text.secondary' }}
            >
              Anuluj
            </Button>
            <Button
              color="error"
              startIcon={<LinkOffRoundedIcon />}
              onClick={() => void submit('')}
              disabled={save.isPending}
            >
              Odłącz wizytówkę
            </Button>
          </Stack>
        )}
      </Box>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const rating = data?.rating ?? null;
  const list = data?.reviews ?? [];

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', py: 3 }}>
      {header}

      {reviews.isError && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {getApiErrorMessage(reviews.error)}
        </Alert>
      )}

      <Card
        sx={{
          mb: 4,
          overflow: 'hidden',
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(STAR_GOLD, 0.09)} 0%, ${
              theme.palette.background.paper
            } 58%)`,
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 3, sm: 5 }}
            sx={{ alignItems: { sm: 'center' } }}
          >
            {rating === null ? (
              <Box>
                <Typography variant="h5" sx={{ mb: 0.5 }}>
                  Brak ocen
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ta wizytówka nie ma jeszcze żadnych ocen.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                <Typography
                  component="p"
                  sx={{
                    fontSize: { xs: 56, sm: 72 },
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: '-0.04em',
                  }}
                >
                  {rating.toFixed(1).replace('.', ',')}
                </Typography>
                <Stars value={rating} size={24} />
                <Typography variant="body2" color="text.secondary">
                  {/* "na podstawie" takes the genitive, where Polish splits
                      only between one and many: 1 oceny, 2 ocen, 1342 ocen.
                      A restaurant with a single review would otherwise be
                      told "na podstawie 1 ocen". */}
                  na podstawie {data?.total_ratings.toLocaleString('pl-PL')}{' '}
                  {data?.total_ratings === 1 ? 'oceny' : 'ocen'}
                </Typography>
              </Stack>
            )}

            <Divider
              flexItem
              orientation="vertical"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            />

            <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <Typography variant="overline" color="text.secondary">
                Wizytówka Google
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}
              >
                {data?.place_id}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button
                  component={Link}
                  href={mapsLink(data?.place_id ?? '')}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  variant="outlined"
                  endIcon={<OpenInNewRoundedIcon />}
                >
                  Zobacz w Google Maps
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<TuneRoundedIcon />}
                  onClick={openEditor}
                  sx={{ color: 'text.secondary' }}
                >
                  Zmień Place ID
                </Button>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        Najnowsze opinie
      </Typography>

      {list.length === 0 ? (
        <Alert severity="info">
          Google nie udostępnia jeszcze żadnych opinii tekstowych dla tej
          wizytówki.
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          {list.map((review) => (
            <ReviewCard
              key={`${review.author_name}-${review.time}`}
              review={review}
            />
          ))}
        </Box>
      )}

      {/* Discrete, and honest about what it means: the number above is a daily
          snapshot, not a live feed. Without this line an owner who just
          received a review would think the integration was broken. */}
      {syncedAt && (
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: 'block', mt: 3, textAlign: 'center' }}
        >
          Zsynchronizowano: {syncedAt} · dane odświeżają się raz na dobę
        </Typography>
      )}
    </Box>
  );
}
