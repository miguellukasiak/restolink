import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllergenI18nKey, getTagI18nKey } from '../constants/menu';

export interface MenuLabels {
  /** An allergen in the guest's language; one outside the vocabulary as stored. */
  allergenLabel: (allergen: string) => string;
  /** A tag in the guest's language; one outside the vocabulary as stored. */
  tagLabel: (tag: string) => string;
}

/**
 * Translates the stored allergen and tag values for the public menu.
 *
 * Stable between renders until the language changes, so it is safe to use
 * inside the memoised dish cards.
 */
export function useMenuLabels(): MenuLabels {
  const { t } = useTranslation();
  return useMemo(() => {
    const label = (key: string | null, stored: string): string => (key ? t(key) : stored);
    return {
      allergenLabel: (allergen) => label(getAllergenI18nKey(allergen), allergen),
      tagLabel: (tag) => label(getTagI18nKey(tag), tag),
    };
  }, [t]);
}
