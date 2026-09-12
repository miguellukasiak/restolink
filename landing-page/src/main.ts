import './style.css';

/**
 * The page is deliberately static — this is the only script that ships.
 *
 * It stamps the current year into the footer so the copyright never goes
 * stale. The markup carries a hardcoded fallback year, so the footer still
 * reads correctly with JavaScript disabled.
 */
function stampCurrentYear(): void {
  const slot = document.querySelector<HTMLElement>('[data-current-year]');
  if (slot) {
    slot.textContent = String(new Date().getFullYear());
  }
}

stampCurrentYear();
