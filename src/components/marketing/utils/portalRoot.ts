/**
 * Shared portal root for the Marketing & Automation workspace.
 *
 * Scoped Tailwind utilities only apply inside `.mkt-scope` (see end of `src/index.css`).
 * Modals/Drawers rendered with `createPortal(..., document.body)` would escape that scope and
 * lose all their styling, so every Marketing portal targets this root instead.
 * The root uses `display: contents` → zero layout impact; `position: fixed` children and their
 * z-index (WorkChat overlay hierarchy) behave exactly as if mounted directly on <body>.
 */
const ROOT_ID = 'mkt-portal-root';

export const getMktPortalRoot = (): HTMLElement => {
  let el = document.getElementById(ROOT_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = ROOT_ID;
    el.className = 'mkt-scope';
    document.body.appendChild(el);
  }
  return el;
};

export default getMktPortalRoot;
