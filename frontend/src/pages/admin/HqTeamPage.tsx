import { useMemo, useState } from 'react';
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid';
import { plPL } from '@mui/x-data-grid/locales';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import NoAccountsRoundedIcon from '@mui/icons-material/NoAccountsRounded';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { AddAdminDialog } from '../../components/admin/AddAdminDialog';
import { ConfirmDialog } from '../../components/panel/ConfirmDialog';
import { useSnackbar } from '../../components/feedback/SnackbarProvider';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { useAdmins, useRevokeAdmin } from '../../hooks/useHq';
import { getApiErrorMessage } from '../../services/api';
import type { AdminListItem } from '../../services/hqService';

/**
 * "Zespół HQ" — who can get into the back office.
 *
 * Revoked accounts stay in the table. This screen answers "who has access" and
 * "who used to", and deleting the row would erase the second question while
 * leaving the audit trail pointing at a name nothing explains.
 */
export function HqTeamPage() {
  const { showSuccess, showError } = useSnackbar();
  const admins = useAdmins();
  const revoke = useRevokeAdmin();
  const me = useAdminProfile();

  const [addOpen, setAddOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AdminListItem | null>(null);

  async function confirmRevoke() {
    if (!revokeTarget) return;
    try {
      await revoke.mutateAsync(revokeTarget.id);
      showSuccess(`Odebrano dostęp: ${revokeTarget.email}.`);
      setRevokeTarget(null);
    } catch (error) {
      showError(getApiErrorMessage(error));
    }
  }

  const columns = useMemo<GridColDef<AdminListItem>[]>(
    () => [
      {
        field: 'email',
        headerName: 'Administrator',
        flex: 1.4,
        minWidth: 240,
        renderCell: (params: GridRenderCellParams<AdminListItem>) => (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
              {params.row.email}
            </Typography>
            {params.row.id === me.data?.id && (
              <Chip size="small" label="to Ty" variant="outlined" />
            )}
          </Stack>
        ),
      },
      {
        field: 'created_at',
        headerName: 'Dodano',
        width: 180,
        renderCell: (params: GridRenderCellParams<AdminListItem>) => (
          <Typography variant="body2">
            {format(new Date(params.row.created_at), 'd MMM yyyy, HH:mm', {
              locale: pl,
            })}
          </Typography>
        ),
      },
      {
        field: 'is_superadmin',
        headerName: 'Status',
        width: 150,
        renderCell: (params: GridRenderCellParams<AdminListItem>) =>
          params.row.is_superadmin ? (
            <Chip size="small" color="success" label="Aktywny" />
          ) : (
            <Chip size="small" variant="outlined" label="Dostęp odebrany" />
          ),
      },
      {
        field: 'actions',
        headerName: 'Akcje',
        width: 190,
        sortable: false,
        filterable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params: GridRenderCellParams<AdminListItem>) => {
          const self = params.row.id === me.data?.id;
          if (!params.row.is_superadmin) return null;

          return (
            // The tooltip needs a wrapper: a disabled button fires no events, so
            // hovering it would explain nothing.
            <Tooltip
              arrow
              title={
                self
                  ? 'Nie możesz odebrać uprawnień samemu sobie'
                  : 'Odbierz dostęp do panelu HQ'
              }
            >
              <span>
                <Button
                  size="small"
                  color="error"
                  startIcon={<NoAccountsRoundedIcon />}
                  disabled={self || revoke.isPending}
                  onClick={() => setRevokeTarget(params.row)}
                >
                  Odbierz dostęp
                </Button>
              </span>
            </Tooltip>
          );
        },
      },
    ],
    [me.data?.id, revoke.isPending],
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pt: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 3, alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h4">Zespół HQ</Typography>
          <Typography variant="body1" color="textSecondary">
            Konta z dostępem do panelu administracyjnego platformy.
          </Typography>
        </Stack>
        <Button
          variant="contained"
          size="large"
          startIcon={<PersonAddAlt1RoundedIcon />}
          onClick={() => setAddOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          Dodaj administratora
        </Button>
      </Stack>

      {admins.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void admins.refetch()}>
              Spróbuj ponownie
            </Button>
          }
        >
          {getApiErrorMessage(admins.error)}
        </Alert>
      )}

      <Card>
        <DataGrid<AdminListItem>
          rows={admins.data ?? []}
          columns={columns}
          getRowId={(row) => row.id}
          rowHeight={60}
          autoHeight
          disableRowSelectionOnClick
          disableColumnMenu
          hideFooter
          localeText={plPL.components.MuiDataGrid.defaultProps.localeText}
          loading={admins.isLoading}
          slotProps={{ loadingOverlay: { variant: 'skeleton', noRowsVariant: 'skeleton' } }}
          sx={{
            border: 'none',
            px: 1,
            '--DataGrid-overlayHeight': '240px',
            '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 700 },
            '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': {
              outline: 'none',
            },
          }}
        />
      </Card>

      <Typography variant="caption" color="textDisabled" sx={{ display: 'block', mt: 2 }}>
        Odebranie dostępu nie usuwa konta — dziennik zdarzeń musi nadal wskazywać
        na istniejącą osobę. Zmiana działa natychmiast, przy najbliższym żądaniu.
      </Typography>

      <AddAdminDialog open={addOpen} onClose={() => setAddOpen(false)} />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Odebrać dostęp?"
        description={
          revokeTarget
            ? `${revokeTarget.email} straci dostęp do panelu HQ przy następnym żądaniu. Konto pozostanie na liście.`
            : ''
        }
        confirmLabel="Odbierz dostęp"
        cancelLabel="Anuluj"
        loading={revoke.isPending}
        onConfirm={() => void confirmRevoke()}
        onClose={() => setRevokeTarget(null)}
      />
    </Box>
  );
}
