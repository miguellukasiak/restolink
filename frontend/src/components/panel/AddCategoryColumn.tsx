import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

const COLUMN_WIDTH = 300;

/** Cohesive dashed column at the far right of the board that adds a category. */
export function AddCategoryColumn({ onClick }: { onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: COLUMN_WIDTH,
        flexShrink: 0,
        minHeight: 120,
        alignSelf: 'stretch',
        borderRadius: '24px',
        border: '2px dashed',
        borderColor: (t) => alpha(t.palette.secondary.main, 0.4),
        color: 'secondary.main',
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
        '&:hover': {
          borderColor: 'secondary.main',
          bgcolor: (t) => alpha(t.palette.secondary.main, 0.06),
        },
      }}
    >
      <Stack spacing={1} sx={{ alignItems: 'center', py: 3 }}>
        <AddRoundedIcon />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Dodaj nową kategorię
        </Typography>
      </Stack>
    </ButtonBase>
  );
}
