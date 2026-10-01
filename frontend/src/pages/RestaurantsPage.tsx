import { useMemo, useState } from 'react';
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridRenderCellParams,
} from '@mui/x-data-grid';
import { plPL } from '@mui/x-data-grid/locales';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ForwardToInboxRoundedIcon from '@mui/icons-material/ForwardToInboxRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import RequestQuoteRoundedIcon from '@mui/icons-material/RequestQuoteRounded';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { format, isPast } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useRestaurants } from '../hooks/useRestaurants';
import { useImpersonate } from '../hooks/useHq';
import { useSnackbar } from '../components/feedback/SnackbarProvider';
import { getApiErrorMessage } from '../services/api';
import { StatusChip } from '../components/restaurants/StatusChip';
import { panelLanguageLabel } from '../components/restaurants/panelLanguageLabel';
import { ManualPaymentDialog } from '../components/restaurants/ManualPaymentDialog';
import { AddRestaurantDialog } from '../components/restaurants/AddRestaurantDialog';
import { EditRestaurantDialog } from '../components/restaurants/EditRestaurantDialog';
import { ActivationLinkDialog } from '../components/restaurants/ActivationLinkDialog';
import { PanelTranslationDialog } from '../components/restaurants/PanelTranslationDialog';
import { useAdminPanelLocales } from '../hooks/usePanelLocales';
import { panelLanguageState } from '../services/panelTranslation';
import {
  copyToClipboard,
  useGenerateActivationLink,
  useSendActivationLink,
} from '../hooks/useOnboarding';
import type { RestaurantListItem } from '../types';

const PAGE_SIZE_OPTIONS = [5, 10, 25];

/** Friendly empty state rendered inside the DataGrid. */
function NoRestaurantsOverlay() {
  return (
    <Stack
      spacing={1.5}
      sx={{
        height: '100%',
        color: 'text.secondary',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <StorefrontRoundedIcon sx={{ fontSize: 48, opacity: 0.4 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Nie znaleziono restauracji
      </Typography>
      <Typography variant="body2">
        Gdy pojawią się nowe konta restauratorów, zobaczysz je tutaj.
      </Typography>
    </Stack>
  );
}

/**
 * "Zarządzanie restauratorami" — server-side paginated list of restaurant
 * accounts with a manual payment action per row.
 */
export function RestaurantsPage() {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });
  const [paymentTarget, setPaymentTarget] = useState<RestaurantListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data, isLoading, isFetching, isError, error, refetch } =
    useRestaurants(paginationModel);
  const impersonate = useImpersonate();
  const sendLink = useSendActivationLink();
  const generateLink = useGenerateActivationLink();
  const { showError, showSuccess } = useSnackbar();

  // The overflow menu is per row, so the anchor carries the row with it.
  const [menu, setMenu] = useState<{
    el: HTMLElement;
    restaurant: RestaurantListItem;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<RestaurantListItem | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ url: string; manual: boolean } | null>(
    null,
  );

  const closeMenu = () => setMenu(null);

  const handleSendLink = async (restaurant: RestaurantListItem) => {
    closeMenu();
    try {
      await sendLink.mutateAsync(restaurant.id);
      showSuccess(`Link aktywacyjny wysłany na ${restaurant.contact_email}.`);
    } catch (err) {
      showError(getApiErrorMessage(err));
    }
  };

  const handleCopyLink = async (restaurant: RestaurantListItem) => {
    closeMenu();
    try {
      const result = await generateLink.mutateAsync(restaurant.id);
      // Copy first, then show the dialog either way: on success it confirms
      // what happened, on failure it is the only way to get the link out.
      const copied = await copyToClipboard(result.activation_url);
      setLinkDialog({ url: result.activation_url, manual: !copied });
    } catch (err) {
      showError(getApiErrorMessage(err));
    }
  };

  // A panel language DeepL has not made yet is made right after the save
  // that chose it; a ready or hand-written one needs nothing.
  const panelLocales = useAdminPanelLocales();
  const [translating, setTranslating] = useState<string | null>(null);
  const translateIfMissing = (code: string) => {
    if (panelLanguageState(code, panelLocales.data) === 'missing') setTranslating(code);
  };

  // Tracked per row so only the button that was pressed shows a spinner; the
  // mutation's own isPending would light up all of them.
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const startImpersonation = async (restaurant: RestaurantListItem) => {
    setImpersonating(restaurant.id);
    try {
      // On success the hook stores the support session and navigates into the
      // panel, so there is nothing to do here.
      await impersonate.mutateAsync(restaurant.id);
    } catch (err) {
      showError(getApiErrorMessage(err));
      setImpersonating(null);
    }
  };

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total_items ?? 0;

  const openPaymentDialog = (restaurant: RestaurantListItem) => {
    setPaymentTarget(restaurant);
    setDialogOpen(true);
  };

  const columns = useMemo<GridColDef<RestaurantListItem>[]>(
    () => [
      {
        field: 'name',
        headerName: 'Restauracja',
        flex: 1.2,
        minWidth: 180,
        renderCell: (params: GridRenderCellParams<RestaurantListItem>) => (
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {params.row.name}
          </Typography>
        ),
      },
      {
        field: 'contact',
        headerName: 'Kontakt',
        flex: 1.4,
        minWidth: 240,
        sortable: false,
        renderCell: (params: GridRenderCellParams<RestaurantListItem>) => (
          <Stack spacing={0.25} sx={{ py: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ alignItems: 'center', minWidth: 0 }}
            >
              <MailOutlineRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
              <Typography variant="body2" noWrap>
                {params.row.contact_email}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <PhoneRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {params.row.contact_phone}
              </Typography>
            </Stack>
          </Stack>
        ),
      },
      {
        field: 'package',
        headerName: 'Pakiet',
        width: 150,
        sortable: false,
        valueGetter: (_value, row) => row.package?.name ?? '—',
        renderCell: (params: GridRenderCellParams<RestaurantListItem>) => (
          <Chip
            size="small"
            variant="outlined"
            color="secondary"
            icon={<WorkspacePremiumRoundedIcon />}
            label={params.row.package?.name ?? '—'}
          />
        ),
      },
      {
        field: 'panel_language',
        headerName: 'Panel',
        width: 110,
        sortable: false,
        renderCell: (params: GridRenderCellParams<RestaurantListItem>) => (
          <Tooltip
            title={
              params.row.panel_language
                ? `Angielski i ${panelLanguageLabel(params.row.panel_language).toLocaleLowerCase('pl')}`
                : 'Tylko angielski'
            }
            arrow
          >
            <Chip
              size="small"
              variant="outlined"
              label={['EN', params.row.panel_language?.toUpperCase()]
                .filter(Boolean)
                .join(' · ')}
            />
          </Tooltip>
        ),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 150,
        renderCell: (params: GridRenderCellParams<RestaurantListItem>) => (
          <StatusChip status={params.row.status} />
        ),
      },
      {
        field: 'subscription_valid_until',
        headerName: 'Ważne do',
        width: 150,
        renderCell: (params: GridRenderCellParams<RestaurantListItem>) => {
          const date = new Date(params.row.subscription_valid_until);
          const expired = isPast(date);
          return (
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                color: expired ? 'error.main' : 'text.primary',
              }}
            >
              {format(date, 'd MMM yyyy', { locale: pl })}
            </Typography>
          );
        },
      },
      {
        field: 'actions',
        headerName: 'Akcje',
        width: 210,
        sortable: false,
        filterable: false,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: GridRenderCellParams<RestaurantListItem>) => (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Tooltip title="Zatwierdź płatność ręcznie" arrow>
              <IconButton
                color="primary"
                aria-label={`Zatwierdź płatność ręcznie — ${params.row.name}`}
                onClick={() => openPaymentDialog(params.row)}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  width: 36,
                  height: 36,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <RequestQuoteRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Wejdź na konto restauratora (zapisywane w dzienniku)" arrow>
              <span>
                <IconButton
                  color="warning"
                  aria-label={`Wejdź na konto — ${params.row.name}`}
                  onClick={() => void startImpersonation(params.row)}
                  disabled={impersonating !== null}
                  sx={{
                    width: 36,
                    height: 36,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {impersonating === params.row.id ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <SupportAgentRoundedIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Otwórz panel restauratora" arrow>
              <IconButton
                color="secondary"
                aria-label={`Otwórz panel — ${params.row.name}`}
                component="a"
                href={`/panel/${params.row.id}/menu`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  width: 36,
                  height: 36,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <LaunchRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Więcej akcji" arrow>
              <IconButton
                aria-label={`Więcej akcji — ${params.row.name}`}
                onClick={(event) =>
                  setMenu({ el: event.currentTarget, restaurant: params.row })
                }
                sx={{ width: 36, height: 36 }}
              >
                <MoreVertRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [impersonating],
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pt: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 3, alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h4">Zarządzanie restauratorami</Typography>
          <Typography variant="body1" color="text.secondary">
            Przeglądaj konta restauracji, ich pakiety i statusy subskrypcji.
          </Typography>
        </Stack>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<AddRoundedIcon />}
          onClick={() => setAddDialogOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          Dodaj restaurację
        </Button>
      </Stack>

      {isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void refetch()}>
              Spróbuj ponownie
            </Button>
          }
        >
          {getApiErrorMessage(error)}
        </Alert>
      )}

      <Card>
        <DataGrid<RestaurantListItem>
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          rowHeight={64}
          autoHeight
          disableRowSelectionOnClick
          disableColumnMenu
          localeText={plPL.components.MuiDataGrid.defaultProps.localeText}
          // Server-side pagination: the grid's model (0-based) drives the
          // React Query params (1-based) in useRestaurants.
          paginationMode="server"
          rowCount={rowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          loading={isLoading || isFetching}
          slots={{ noRowsOverlay: NoRestaurantsOverlay }}
          slotProps={{
            loadingOverlay: {
              variant: 'skeleton',
              noRowsVariant: 'skeleton',
            },
          }}
          sx={{
            border: 'none',
            px: 1,
            '--DataGrid-overlayHeight': '320px',
            '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 700 },
            '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': {
              outline: 'none',
            },
          }}
        />
      </Card>

      <ManualPaymentDialog
        open={dialogOpen}
        restaurant={paymentTarget}
        onClose={() => setDialogOpen(false)}
      />

      <AddRestaurantDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onPanelLanguage={translateIfMissing}
      />

      <Menu anchorEl={menu?.el ?? null} open={Boolean(menu)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            setEditTarget(menu!.restaurant);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <EditRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edytuj dane</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={sendLink.isPending}
          onClick={() => void handleSendLink(menu!.restaurant)}
        >
          <ListItemIcon>
            <ForwardToInboxRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Wyślij link aktywacyjny</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={generateLink.isPending}
          onClick={() => void handleCopyLink(menu!.restaurant)}
        >
          <ListItemIcon>
            <ContentCopyRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Kopiuj link aktywacyjny</ListItemText>
        </MenuItem>
      </Menu>

      <EditRestaurantDialog
        open={Boolean(editTarget)}
        restaurant={editTarget}
        onClose={() => setEditTarget(null)}
        onPanelLanguage={translateIfMissing}
      />

      <PanelTranslationDialog code={translating} onClose={() => setTranslating(null)} />

      <ActivationLinkDialog
        open={Boolean(linkDialog)}
        url={linkDialog?.url ?? ''}
        manualCopy={linkDialog?.manual ?? false}
        onClose={() => setLinkDialog(null)}
      />
    </Box>
  );
}
