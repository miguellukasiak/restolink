import { useMemo, useState } from 'react';
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridRenderCellParams,
} from '@mui/x-data-grid';
import { plPL } from '@mui/x-data-grid/locales';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useAuditLogs } from '../../hooks/useHq';
import { getApiErrorMessage } from '../../services/api';
import type { AuditLogEntry } from '../../services/hqService';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

type ChipColour = 'default' | 'success' | 'warning' | 'error' | 'info';

/**
 * How each stored action reads in the panel.
 *
 * The database holds stable tokens, so this table can be reworded freely
 * without rewriting history. An action missing from it renders as its raw
 * token rather than blank — a log entry nobody anticipated is exactly the one
 * worth being able to see.
 */
const ACTION_LABELS: Record<string, { label: string; colour: ChipColour }> = {
  'admin.created': { label: 'Dodano administratora', colour: 'info' },
  'admin.revoked': { label: 'Odebrano dostęp', colour: 'error' },
  'restaurant.created': { label: 'Utworzono restaurację', colour: 'success' },
  'restaurant.payment_recorded': { label: 'Zaksięgowano płatność', colour: 'success' },
  'restaurant.impersonated': { label: 'Wejście na konto restauratora', colour: 'warning' },
};

function NoEntriesOverlay() {
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
      <HistoryRoundedIcon sx={{ fontSize: 48, opacity: 0.4 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Dziennik jest pusty
      </Typography>
      <Typography variant="body2">
        Działania administratorów pojawią się tutaj automatycznie.
      </Typography>
    </Stack>
  );
}

/**
 * "Dziennik zdarzeń" — read-only by construction.
 *
 * There is no edit and no delete here, and no endpoint behind them either. A
 * trail its own operators can tidy up answers the question it exists for with
 * whatever they would prefer the answer to be.
 */
export function AuditLogPage() {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const logs = useAuditLogs(paginationModel.page + 1, paginationModel.pageSize);

  const columns = useMemo<GridColDef<AuditLogEntry>[]>(
    () => [
      {
        field: 'created_at',
        headerName: 'Kiedy',
        width: 190,
        sortable: false,
        renderCell: (params: GridRenderCellParams<AuditLogEntry>) => (
          <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {format(new Date(params.row.created_at), 'd MMM yyyy, HH:mm:ss', {
              locale: pl,
            })}
          </Typography>
        ),
      },
      {
        field: 'admin_email',
        headerName: 'Kto',
        flex: 1,
        minWidth: 200,
        sortable: false,
        renderCell: (params: GridRenderCellParams<AuditLogEntry>) => (
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {params.row.admin_email}
          </Typography>
        ),
      },
      {
        field: 'action',
        headerName: 'Co',
        width: 260,
        sortable: false,
        renderCell: (params: GridRenderCellParams<AuditLogEntry>) => {
          const known = ACTION_LABELS[params.row.action];
          return (
            <Chip
              size="small"
              color={known?.colour ?? 'default'}
              variant={known ? 'filled' : 'outlined'}
              label={known?.label ?? params.row.action}
            />
          );
        },
      },
      {
        field: 'target_entity',
        headerName: 'Czego dotyczy',
        flex: 1.6,
        minWidth: 260,
        sortable: false,
        renderCell: (params: GridRenderCellParams<AuditLogEntry>) => (
          <Typography variant="body2" color="textSecondary" noWrap>
            {params.row.target_entity}
          </Typography>
        ),
      },
    ],
    [],
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pt: 4 }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4">Dziennik zdarzeń</Typography>
        <Typography variant="body1" color="textSecondary">
          Kto, co i kiedy zrobił w panelu HQ. Zapis jest tylko do odczytu.
        </Typography>
      </Stack>

      {logs.isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void logs.refetch()}>
              Spróbuj ponownie
            </Button>
          }
        >
          {getApiErrorMessage(logs.error)}
        </Alert>
      )}

      <Card>
        <DataGrid<AuditLogEntry>
          rows={logs.data?.data ?? []}
          columns={columns}
          getRowId={(row) => row.id}
          rowHeight={56}
          autoHeight
          disableRowSelectionOnClick
          disableColumnMenu
          localeText={plPL.components.MuiDataGrid.defaultProps.localeText}
          paginationMode="server"
          rowCount={logs.data?.meta.total_items ?? 0}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          loading={logs.isLoading || logs.isFetching}
          slots={{ noRowsOverlay: NoEntriesOverlay }}
          slotProps={{ loadingOverlay: { variant: 'skeleton', noRowsVariant: 'skeleton' } }}
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
    </Box>
  );
}
