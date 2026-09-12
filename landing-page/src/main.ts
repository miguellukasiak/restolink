import './style.css';

/**
 * Everything the page needs at runtime: scroll reveals, the sticky
 * scroll-telling scene, and the footer year. No framework, no dependencies —
 * roughly a kilobyte of JavaScript, and the page is fully readable without it.
 */

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

/** Keeps the footer copyright from going stale. */
function stampCurrentYear(): void {
  const slot = document.querySelector<HTMLElement>('[data-current-year]');
  if (slot) {
    slot.textContent = String(new Date().getFullYear());
  }
}

setupScrollReveal();
setupScrollScene();
stampCurrentYear();
