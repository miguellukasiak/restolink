import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import './style.css';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pl from './locales/pl.json';

/**
 * Everything the page needs at runtime: translations, scroll reveals, the
 * sticky scroll-telling scene and the contact form. No framework — the page is
 * fully readable without any of it; only sending a message needs scripting.
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
 * Sticky scroll-telling: the visual on the left follows whichever text block on
 * the right is passing the middle of the viewport. Panel `i` belongs to step
 * `i`; the current index is also written to `data-current`, which the CSS uses
 * to swap the step-1 illustration for the phone.
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
    scene.dataset['current'] = String(index);

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

/**
 * The API the contact form posts to. A production build refuses to run without
 * `VITE_API_URL` (see vite.config.ts), so the localhost fallback only ever
 * serves `npm run dev`.
 */
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(
  /\/+$/,
  '',
);

/**
 * Generous on purpose. The API sits on Render's free tier, whose cold start can
 * take most of a minute — and giving up early on a send the server may still
 * complete invites a duplicate, which is still better than a lost lead.
 */
const CONTACT_TIMEOUT_MS = 60_000;

/** When to explain that a long wait is the server waking up, not a hang. */
const CONTACT_SLOW_AFTER_MS = 6_000;

type ContactStatus =
  | 'sending'
  | 'slow'
  | 'success'
  | 'error'
  | 'rateLimited'
  | 'invalid';

const STATUS_TONE: Record<ContactStatus, string> = {
  sending: 'bg-white/60 text-ink-700',
  slow: 'bg-white/60 text-ink-700',
  success: 'bg-brand-50 text-brand-700',
  error: 'bg-red-50 text-red-700',
  rateLimited: 'bg-red-50 text-red-700',
  invalid: 'bg-red-50 text-red-700',
};

/** Which message a failed response gets. Anything unlisted is `error`. */
function failureStatus(httpStatus: number): ContactStatus {
  if (httpStatus === 429) {
    return 'rateLimited';
  }
  if (httpStatus === 422) {
    // The browser already checked the required fields and the length limits,
    // so what is left is almost always an address the browser accepted and
    // the API did not, such as one without a dot in its domain.
    return 'invalid';
  }
  return 'error';
}

/**
 * The contact form: posts to the API and reports the outcome in place.
 *
 * Messages are shown by pointing `data-i18n` at a key rather than writing text
 * directly, so `applyTranslations` keeps them in the right language if the
 * visitor switches mid-send. A POST is never retried automatically — a timeout
 * does not prove the server did nothing, and a second attempt is the
 * visitor's call.
 */
function setupContactForm(): void {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  const status = form?.querySelector<HTMLElement>('[data-contact-status]');
  const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!form || !status || !button) {
    return;
  }

  const buttonKey = button.dataset['i18n'] ?? 'contact.submit';
  let busy = false;
  let tone: string[] = [];

  // Wake a sleeping server while the visitor is still typing, so the cold
  // start is mostly over by the time they press send. `no-cors`: only the
  // side effect matters, so the response need not be readable.
  form.addEventListener(
    'focusin',
    () => {
      fetch(`${API_URL}/health`, { mode: 'no-cors' }).catch(() => undefined);
    },
    { once: true },
  );

  const show = (state: ContactStatus): void => {
    status.classList.remove('hidden', ...tone);
    tone = STATUS_TONE[state].split(' ');
    status.classList.add(...tone);
    status.dataset['i18n'] = `contact.${state}`;
    status.textContent = translate(`contact.${state}`);
  };

  const setBusy = (value: boolean): void => {
    busy = value;
    button.disabled = value;
    const key = value ? 'contact.sending' : buttonKey;
    button.dataset['i18n'] = key;
    button.textContent = translate(key);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) {
      return;
    }

    const data = new FormData(form);
    const field = (name: string): string => String(data.get(name) ?? '').trim();
    const body = JSON.stringify({
      name: field('name'),
      email: field('email'),
      restaurant: field('restaurant') || null,
      message: field('message'),
      language: i18next.resolvedLanguage ?? null,
      website: field('website'),
    });

    setBusy(true);
    show('sending');

    const controller = new AbortController();
    const abortTimer = window.setTimeout(() => controller.abort(), CONTACT_TIMEOUT_MS);
    const slowTimer = window.setTimeout(() => show('slow'), CONTACT_SLOW_AFTER_MS);

    fetch(`${API_URL}/api/v1/public/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok) {
          form.reset();
          show('success');
        } else {
          show(failureStatus(response.status));
        }
      })
      // Offline, blocked by CORS, or timed out: the form keeps what was typed,
      // so trying again costs the visitor one click.
      .catch(() => show('error'))
      .finally(() => {
        window.clearTimeout(abortTimer);
        window.clearTimeout(slowTimer);
        setBusy(false);
      });
  });
}

/**
 * Changes a grid's layout and glides the items that stay into their new
 * places ("FLIP"): measure, mutate, then start each moved item from where it
 * was and let its CSS transition carry it home.
 */
function flip(container: HTMLElement, mutate: () => void): void {
  const items = Array.from(container.children) as HTMLElement[];
  const before = new Map(items.map((item) => [item, item.getBoundingClientRect()]));
  mutate();
  for (const item of items) {
    const first = before.get(item);
    if (item.hidden || !first) {
      continue;
    }
    const last = item.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (dx === 0 && dy === 0) {
      continue;
    }
    item.style.transition = 'none';
    item.style.transform = `translate(${dx}px, ${dy}px)`;
    void item.offsetWidth;
    item.style.transition = '';
    item.style.transform = '';
  }
}

/**
 * Step 3's phone plays the product on a loop: open the allergy filter, pick
 * gluten, apply — those dishes leave and the rest close ranks — then open a
 * dish to show its description and allergens.
 *
 * It runs only while step 3 is the current one and the phone is actually
 * displayed (the scene is desktop-only), and it is timer-driven: every step is
 * a state class with a CSS transition, so a throttled or hidden tab can only
 * ever show a real state. Under reduced motion it shows the end state — the
 * filter applied — and never moves.
 */
function setupFilterDemo(): void {
  const panel = document.querySelector<HTMLElement>('[data-filter-demo]');
  const screen = panel?.querySelector<HTMLElement>('.fm-screen');
  const grid = screen?.querySelector<HTMLElement>('.fm-grid');
  const tap = screen?.querySelector<HTMLElement>('.fm-tap');
  if (!panel || !screen || !grid || !tap) {
    return;
  }

  const glutenDishes = Array.from(grid.querySelectorAll<HTMLElement>('[data-gluten]'));

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    screen.classList.add('is-filtered');
    glutenDishes.forEach((dish) => {
      dish.hidden = true;
    });
    return;
  }

  let timers: number[] = [];
  let running = false;

  const at = (ms: number, step: () => void): void => {
    timers.push(window.setTimeout(step, ms));
  };

  /** A fingertip on the named element, then gone again on a timer. */
  const tapOn = (name: string): void => {
    const target = screen.querySelector<HTMLElement>(`[data-fm="${name}"]`);
    if (!target) {
      return;
    }
    const frame = screen.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    tap.style.left = `${box.left - frame.left + box.width / 2}px`;
    tap.style.top = `${box.top - frame.top + box.height / 2}px`;
    tap.classList.remove('is-tapping');
    void tap.offsetWidth;
    tap.classList.add('is-tapping');
    at(700, () => tap.classList.remove('is-tapping'));
  };

  const reset = (): void => {
    screen.classList.remove('is-sheet-open', 'is-gluten', 'is-filtered', 'is-detail-open');
    tap.classList.remove('is-tapping');
    glutenDishes.forEach((dish) => {
      dish.hidden = false;
      dish.classList.remove('is-leaving');
    });
  };

  const play = (): void => {
    timers = [];
    at(900, () => tapOn('shield'));
    at(1150, () => screen.classList.add('is-sheet-open'));
    at(2300, () => tapOn('gluten'));
    at(2450, () => screen.classList.add('is-gluten'));
    at(3300, () => tapOn('apply'));
    at(3550, () => screen.classList.remove('is-sheet-open'));
    at(3950, () => {
      screen.classList.add('is-filtered');
      glutenDishes.forEach((dish) => dish.classList.add('is-leaving'));
    });
    at(4350, () =>
      flip(grid, () =>
        glutenDishes.forEach((dish) => {
          dish.hidden = true;
        }),
      ),
    );
    at(5700, () => tapOn('salmon'));
    at(5950, () => screen.classList.add('is-detail-open'));
    at(8900, () => tapOn('close'));
    at(9100, () => screen.classList.remove('is-detail-open'));
    // Fade out, rewind unseen, fade back in, go again.
    at(10300, () => screen.classList.add('is-resetting'));
    at(10750, reset);
    at(10800, () => screen.classList.remove('is-resetting'));
    at(11300, play);
  };

  const start = (): void => {
    if (running) {
      return;
    }
    running = true;
    reset();
    play();
  };

  const stop = (): void => {
    if (!running) {
      return;
    }
    running = false;
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [];
    screen.classList.remove('is-resetting');
    reset();
  };

  // The scene marks the current step's panel `.is-visible`; `getClientRects`
  // is empty while the scene itself is hidden (below the lg breakpoint).
  const sync = (): void => {
    if (panel.classList.contains('is-visible') && panel.getClientRects().length > 0) {
      start();
    } else {
      stop();
    }
  };

  new MutationObserver(sync).observe(panel, {
    attributes: true,
    attributeFilter: ['class'],
  });
  sync();
}

/** Languages the hero's browser mockup cycles through. Polish is already on
 *  the phone beside it. */
const DEMO_LANGUAGES = ['en', 'de', 'fr', 'es'] as const;

type DemoLanguage = (typeof DEMO_LANGUAGES)[number];

/**
 * The browser mockup's copy per language. The interface strings are the
 * product's own (its search placeholder, its allergen names), so the demo shows
 * what a guest would actually read. English is also baked into the HTML.
 */
const DEMO_COPY: Record<DemoLanguage, Record<string, string>> = {
  en: {
    search: 'Search the menu...',
    classics: 'Classics',
    soups: 'Soups',
    desserts: 'Desserts',
    pierogi: 'Potato & cheese pierogi',
    zurek: 'Sour rye soup',
    cheesecake: 'Cheesecake',
    lactose: 'Lactose',
    eggs: 'Eggs',
  },
  de: {
    search: 'Karte durchsuchen...',
    classics: 'Klassiker',
    soups: 'Suppen',
    desserts: 'Desserts',
    pierogi: 'Piroggen mit Quark',
    zurek: 'Saure Mehlsuppe',
    cheesecake: 'Käsekuchen',
    lactose: 'Laktose',
    eggs: 'Eier',
  },
  fr: {
    search: 'Rechercher dans la carte...',
    classics: 'Classiques',
    soups: 'Soupes',
    desserts: 'Desserts',
    pierogi: 'Pierogi au fromage',
    zurek: 'Soupe de seigle aigre',
    cheesecake: 'Gâteau au fromage',
    lactose: 'Lactose',
    eggs: 'Œufs',
  },
  es: {
    search: 'Buscar en la carta...',
    classics: 'Clásicos',
    soups: 'Sopas',
    desserts: 'Postres',
    pierogi: 'Pierogi de patata y queso',
    zurek: 'Sopa de centeno agria',
    cheesecake: 'Tarta de queso',
    lactose: 'Lactosa',
    eggs: 'Huevos',
  },
};

/** How long each language stays on screen. */
const DEMO_INTERVAL_MS = 3200;

/** Matches the `.mock-content` fade in style.css. */
const DEMO_FADE_MS = 350;

/**
 * Cycles the hero's browser mockup through the menu's languages: the same
 * dishes, the same layout, a different language every few seconds.
 *
 * Runs only while the hero is on screen, and not at all for visitors who ask
 * for reduced motion — they keep the static English version.
 */
function setupHeroDemo(): void {
  const screen = document.querySelector<HTMLElement>('[data-demo-screen]');
  if (
    !screen ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  // `code` and `label` live outside the screen (URL bar, language pill).
  const browser = screen.closest<HTMLElement>('.mock-browser') ?? screen;
  const targets = Array.from(browser.querySelectorAll<HTMLElement>('[data-demo]'));
  let index = 0;
  let timer: number | undefined;

  const show = (language: DemoLanguage): void => {
    const copy = DEMO_COPY[language];
    screen.lang = language;
    for (const target of targets) {
      const key = target.dataset['demo'];
      if (key === 'code') {
        target.textContent = language;
      } else if (key === 'label') {
        target.textContent = language.toUpperCase();
      } else if (key && copy[key]) {
        target.textContent = copy[key];
      }
    }
  };

  const advance = (): void => {
    index = (index + 1) % DEMO_LANGUAGES.length;
    const language = DEMO_LANGUAGES[index] ?? 'en';
    screen.classList.add('is-switching');
    // Swap while faded out, then fade back in. On a timer, never
    // `transitionend`: a hidden tab runs no transitions and would leave the
    // screen blank.
    window.setTimeout(() => {
      show(language);
      screen.classList.remove('is-switching');
    }, DEMO_FADE_MS);
  };

  const start = (): void => {
    timer ??= window.setInterval(advance, DEMO_INTERVAL_MS);
  };
  const stop = (): void => {
    window.clearInterval(timer);
    timer = undefined;
  };

  if (!('IntersectionObserver' in window)) {
    start();
    return;
  }

  new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        start();
      } else {
        stop();
      }
    }
  }).observe(screen);
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
  setupFilterDemo();
  setupHeroDemo();
  setupContactForm();
}

void bootstrap();
