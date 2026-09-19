/**
 * Built-in dynamic command providers.
 *
 * Importing this module (for its side effect) registers them once, ever —
 * that's why CommandPalette.jsx imports it at module scope rather than
 * inside the component body, where re-registering on every mount would
 * duplicate entries.
 *
 * This file is the template for adding more: a future provider for
 * "jump to a pending transfer" or "open a report" is the same shape —
 * read whatever's already cached, map it to commands, done. No changes
 * needed in CommandPalette.jsx itself.
 */
import { registerProvider } from './registry.js'
import { getCached } from '../cache.js'

registerProvider(({ navigate, t }) => {
  const companies = getCached('companies') || []
  return companies.map((c) => ({
    id: `company:${c.id}`,
    group: 'Companies',
    label: c.company_name,
    hint: t('open_company_hint'),
    keywords: [c.company_name, c.id],
    // No router state here (unlike a card click) — CompanyRoute already
    // falls back to fetching the company list itself when state is
    // absent, which is exactly the direct-visit case this is.
    perform: () => navigate(`/app/companies/${c.id}`),
  }))
})
