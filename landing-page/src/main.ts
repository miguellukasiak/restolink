import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import './style.css';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pl from './locales/pl.json';

/**
 * Everything the page needs at runtime: translations, scroll reveals and the
 * sticky scroll-telling scene. No framework — the page is fully readable
 * without any of it.
 */

/** Order here is the order shown in the header switcher. */
const SUPPORTED_LANGUAGES = ['en', 'pl', 'de', 'fr', 'es'] as const;

/**
 * `data-i18n` fills an element's text. These fill an *attribute* instead —
 * `<meta data-i18n-content="meta.description">`, a button's `aria-label`, and
 * so on.
 */
const ATTRIBUTE_BINDINGS: ReadonlyArray<readonly [string, string]> = [
  ['data-i18n-aria-label', 'aria-label'],
  ['data-i18n-content', 'content'],
];

const translate = (key: string): string => i18next.t(key);

/**
 * Pushes the active language into the DOM.
 *
 * Text goes in with `textContent`, never `innerHTML` — so a translation file
 * can never inject markup, and `escapeValue` stays off without opening a hole.
 * Every `data-i18n` target holds nothing but text; where an element also has
 * decorative children (an SVG in a button, the dot in the hero badge) the
 * attribute sits on an inner `<span>` so the children survive.
 */
function applyTranslations(): void {
  const language = i18next.resolvedLanguage ?? SUPPORTED_LANGUAGES[0];
  document.documentElement.lang = language;

  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset['i18n'];
    if (key) {
      element.textContent = translate(key);
    }
  }

  for (const [dataAttribute, target] of ATTRIBUTE_BINDINGS) {
    const selector = `[${dataAttribute}]`;
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const key = element.getAttribute(dataAttribute);
      if (key) {
        element.setAttribute(target, translate(key));
      }
    }
  }
}

/**
 * A plain `<select>`, on purpose: keyboard support, the native picker on
 * mobile and screen-reader semantics all come for free, and it costs no
 * JavaScript beyond this listener.
 */
function setupLanguageSwitcher(): void {
  const select = document.querySelector<HTMLSelectElement>(
    '[data-language-switcher]',
  );
  if (!select) {
    return;
  }

  const syncValue = (): void => {
    const language = i18next.resolvedLanguage;
    if (language && select.value !== language) {
      select.value = language;
    }
  };

  syncValue();
  i18next.on('languageChanged', syncValue);

  select.addEventListener('change', () => {
    void i18next.changeLanguage(select.value);
  });
}

/** Elements marked `.reveal` fade and slide in once, the first time they show. */
function setupScrollReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>('.reveal');
  if (targets.length === 0) {
    return;
  }

  // Ancient browser, or a headless renderer with no observer: just show
  // everything rather than leaving the page blank.
  if (!('IntersectionObserver' in window)) {
    targets.forEach((target) => target.classList.add('active'));
    return;
  }

  let delivered = false;

  const observer = new IntersectionObserver(
    (entries) => {
      delivered = true;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          // One-shot: nothing re-hides on the way back up.
          observer.unobserve(entry.target);
        }
      }
    },
    // Fire a little before the element is fully on screen, so the motion has
    // finished by the time it reaches comfortable reading position.
    { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
  );

  targets.forEach((target) => observer.observe(target));

  // Safety net. IntersectionObserver only reports once the page runs its
  // rendering steps, which a document loaded into a *hidden* tab does not do —
  // a restored session, a middle-click, a prerender. The observer would catch
  // up when the tab is finally shown, but until then `.reveal` keeps the whole
  // page at opacity 0, and a blank marketing page is the worst possible
  // failure. If nothing has been reported by now, just show everything.
  window.setTimeout(() => {
    if (!delivered) {
      observer.disconnect();
      targets.forEach((target) => target.classList.add('active'));
    }
  }, 1500);
}

/**
 * Sticky scroll-telling: the phone mockup on the left swaps its screen as each
 * text block on the right passes the middle of the viewport.
 */
function setupScrollScene(): void {
  const scene = document.querySelector<HTMLElement>('[data-scroll-scene]');
  if (!scene) {
    return;
  }

  const steps = Array.from(scene.querySelectorAll<HTMLElement>('[data-step]'));
  const panels = Array.from(scene.querySelectorAll<HTMLElement>('[data-panel]'));
  if (steps.length === 0 || panels.length === 0) {
    return;
  }

  let current = -1;

  const activate = (index: number): void => {
    if (index === current) {
      return;
    }
    current = index;

    steps.forEach((step, i) => step.classList.toggle('is-current', i === index));
    // The panels duplicate text that the steps already carry, so all of them
    // stay `aria-hidden` in the markup — only the visual state changes here.
    panels.forEach((panel, i) =>
      panel.classList.toggle('is-visible', i === index),
    );
  };

  activate(0);

  if (!('IntersectionObserver' in window)) {
    return;
  }

  // Negative margins on both sides collapse the root down to a thin band
  // across the middle of the viewport, so the "current" step is whichever one
  // is crossing the centre — not merely on screen.
  const observer = new IntersectionObserver(
    (entries) => {
      const entering = entries.filter((entry) => entry.isIntersecting);
      if (entering.length === 0) {
        // Between two blocks: hold the last one instead of flickering to none.
        return;
      }

      // On a fast scroll several can land in one callback; the one closest to
      // the band wins.
      const winner = entering.reduce((best, entry) =>
        entry.intersectionRatio > best.intersectionRatio ? entry : best,
      );

      const index = steps.indexOf(winner.target as HTMLElement);
      if (index !== -1) {
        activate(index);
      }
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
  );

  steps.forEach((step) => observer.observe(step));
}

async function bootstrap(): Promise<void> {
  await i18next.use(LanguageDetector).init({
    resources: {
      en: { translation: en },
      pl: { translation: pl },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
    },
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: SUPPORTED_LANGUAGES[0],
    // `de-AT`, `fr-CA`, `es-419` and friends all resolve to the base language
    // instead of falling through to English.
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    interpolation: {
      // Safe because translations are written with `textContent`, never
      // `innerHTML`. Leaving it on would turn a French apostrophe into a
      // literal `&#39;` on screen.
      escapeValue: false,
      // Lets `footer.copyright` carry `{{year}}` without any per-key wiring.
      defaultVariables: { year: new Date().getFullYear() },
    },
    detection: {
      // `?lang=de` wins, so a link can pin a language; otherwise the visitor's
      // last explicit choice, and only then the browser's own preference.
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'restolink.lang',
      caches: ['localStorage'],
    },
  });

  i18next.on('languageChanged', applyTranslations);

  // Translate before wiring the observers: the copy changes element heights,
  // and the reveal thresholds are measured against the final layout.
  applyTranslations();
  setupLanguageSwitcher();
  setupScrollReveal();
  setupScrollScene();
}

void bootstrap();
