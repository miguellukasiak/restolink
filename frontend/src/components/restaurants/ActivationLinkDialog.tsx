import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

interface ActivationLinkDialogProps {
  open: boolean;
  url: string;
  /** True when the clipboard write failed and the operator must select it. */
  manualCopy: boolean;
  onClose: () => void;
}

/**
 * Shows the raw activation link.
 *
 * Opened either because the clipboard was unavailable, or because an operator
 * wants to see what they are about to paste into a message. The field is
 * read-only and pre-selected on focus, so the whole URL comes out in one go —
 * a link truncated halfway through is worse than none, and this one is long.
 */
export function ActivationLinkDialog({
  open,
  url,
  manualCopy,
  onClose,
}: ActivationLinkDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Link aktywacyjny</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {manualCopy ? (
            <Alert severity="warning" sx={{ borderRadius: '12px' }}>
              Przeglądarka nie pozwoliła skopiować automatycznie. Zaznacz adres
              poniżej i skopiuj ręcznie.
            </Alert>
          ) : (
            <Alert severity="success" sx={{ borderRadius: '12px' }}>
              Skopiowano do schowka.
            </Alert>
          )}

          <DialogContentText variant="body2">
            Przekaż ten adres restauratorowi — SMS-em, WhatsAppem, jak wygodnie.
            Link jest ważny 7 dni i zadziała tylko raz.
          </DialogContentText>

          <TextField
            value={url}
            fullWidth
            multiline
            minRows={2}
            slotProps={{
              htmlInput: {
                readOnly: true,
                spellCheck: false,
                // Select everything the moment it is focused; the URL is far
                // too long to drag-select reliably.
                onFocus: (event: React.FocusEvent<HTMLTextAreaElement>) =>
                  event.target.select(),
              },
            }}
            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 13 } }}
          />

          <Alert severity="info" sx={{ borderRadius: '12px' }}>
            Wygenerowanie nowego linku unieważnia poprzedni. Jeśli wyślesz ten
            adres, nie generuj kolejnego, dopóki restaurator go nie użyje.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="contained" onClick={onClose}>
          Gotowe
        </Button>
      </DialogActions>
    </Dialog>
  );
}
