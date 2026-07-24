import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * Public-menu translations. Language is auto-detected from the browser
 * (navigator.language) with Polish as the fallback, per product requirements.
 */
const resources = {
  pl: {
    translation: {
      searchPlaceholder: 'Szukaj w menu...',
      searchAria: 'Szukaj dania w menu',
      languageToggle: 'Switch language to English',
      categoriesNav: 'Kategorie menu',
      goToCategory: 'Przejdź do kategorii {{name}}',
      description: 'Opis',
      ingredients: 'Składniki',
      allergens: 'Alergeny',
      noAllergens: 'brak alergenów',
      tags: 'Tagi',
      nutrition: 'Wartości odżywcze (300g)',
      kcal: 'KCAL',
      protein: 'BIAŁKO',
      fat: 'TŁUSZCZE',
      carbs: 'WĘGLE.',
      close: 'Zamknij',
      price: 'Cena',
      openDish: 'Zobacz szczegóły dania {{name}}, cena {{price}}',
      unavailable: 'Niedostępne',
      resultsFound: 'Znaleziono dań: {{count}}',
      emptySearch: 'Brak dań pasujących do „{{query}}"',
      dishImage: 'Zdjęcie dania {{name}}',
      restaurantLogo: 'Logo restauracji {{name}}',
      menuLoadError: 'Nie udało się załadować menu. Spróbuj ponownie.',
      retry: 'Spróbuj ponownie',
    },
  },
  en: {
    translation: {
      searchPlaceholder: 'Search the menu...',
      searchAria: 'Search for a dish in the menu',
      languageToggle: 'Zmień język na polski',
      categoriesNav: 'Menu categories',
      goToCategory: 'Go to category {{name}}',
      description: 'Description',
      ingredients: 'Ingredients',
      allergens: 'Allergens',
      noAllergens: 'no allergens',
      tags: 'Tags',
      nutrition: 'Nutrition facts (300g)',
      kcal: 'KCAL',
      protein: 'PROTEIN',
      fat: 'FAT',
      carbs: 'CARBS',
      close: 'Close',
      price: 'Price',
      openDish: 'View details of dish {{name}}, price {{price}}',
      unavailable: 'Unavailable',
      resultsFound: 'Dishes found: {{count}}',
      emptySearch: 'No dishes match "{{query}}"',
      dishImage: 'Photo of dish {{name}}',
      restaurantLogo: 'Logo of restaurant {{name}}',
      menuLoadError: 'Could not load the menu. Please try again.',
      retry: 'Try again',
    },
  },
};

const detectedLanguage =
  typeof navigator !== 'undefined' &&
  navigator.language?.toLowerCase().startsWith('en')
    ? 'en'
    : 'pl';

void i18n.use(initReactI18next).init({
  resources,
  lng: detectedLanguage,
  fallbackLng: 'pl',
  interpolation: { escapeValue: false },
});

export default i18n;
