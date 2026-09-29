import { useMemo } from 'react';
import { getAllergenI18nKey, getTagI18nKey } from '../constants/menu';
import { usePanelT } from '../i18n/panel';
import type { MenuLabels } from './useMenuLabels';

/**
 * The stored allergen and tag values in the panel's language — the owner's
 * counterpart of `useMenuLabels`. Built-in ones are translated by the same
 * stable keys; an owner's own label is shown as they typed it. Matching and
 * saving always use the stored value.
 */
export function usePanelLabels(): MenuLabels {
  const { t } = usePanelT();
  return useMemo(() => {
    const label = (key: string | null, stored: string): string =>
      key ? t(`labels.${key}`) : stored;
    return {
      allergenLabel: (allergen) => label(getAllergenI18nKey(allergen), allergen),
      tagLabel: (tag) => label(getTagI18nKey(tag), tag),
    };
  }, [t]);
}
