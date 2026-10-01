import { useQuery } from '@tanstack/react-query';
import { fetchPanelLocaleStatuses } from '../services/panelLocaleService';

export const panelLocaleQueryKeys = {
  statuses: ['admin', 'panel-locales'] as const,
};

/** HQ: which panel languages DeepL has made, and how complete each is. */
export function useAdminPanelLocales() {
  return useQuery({
    queryKey: panelLocaleQueryKeys.statuses,
    queryFn: fetchPanelLocaleStatuses,
  });
}
