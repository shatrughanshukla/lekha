/**
 * Command palette registry.
 *
 * Two kinds of entries, both normalised to the same shape by the palette:
 *
 *   staticCommands   — fixed list, known at build time (navigation).
 *   registerProvider — a function the palette calls on every open to get
 *                       commands that depend on runtime data (companies,
 *                       and later: transfers, reports, members...). A
 *                       provider takes the current app context and
 *                       returns an array of commands or [].
 *
 * This split is what makes the palette "easily extensible" per the brief:
 * adding a new command group later — e.g. one command per pending
 * transfer — means calling registerProvider() once from that feature's
 * own file. Nothing in CommandPalette.jsx or here needs to change.
 *
 * A command is: { id, group, label, hint?, icon?, keywords?, perform }.
 * `perform` receives the same context object providers do (navigate,
 * token, user, companies, theme setters, ...) so a command can act
 * without the palette needing to know what any given action does.
 */

const providers = []

export function registerProvider(fn) {
  providers.push(fn)
  return () => {
    const i = providers.indexOf(fn)
    if (i !== -1) providers.splice(i, 1)
  }
}

export function collectDynamicCommands(ctx) {
  return providers.flatMap((fn) => {
    try {
      return fn(ctx) || []
    } catch {
      return [] // a broken provider should never take the whole palette down
    }
  })
}

/**
 * Static navigation commands. `group: 'Navigate'` is what the palette
 * uses as a section header — new groups (e.g. 'Actions') just need a new
 * string here or in a provider's returned commands.
 */
export function staticCommands({ navigate, t }) {
  const nav = (path, labelKey, hint) => ({
    id: `nav:${path}`,
    group: 'Navigate',
    label: t(labelKey),
    hint,
    keywords: [labelKey],
    perform: () => navigate(path),
  })

  return [
    nav('/app', 'nav_dashboard'),
    nav('/app/accounts', 'nav_accounts'),
    nav('/app/transfers', 'nav_transfers'),
    nav('/app/transactions', 'nav_transactions'),
    nav('/app/assistant', 'nav_assistant'),
    nav('/app/reports', 'nav_reports'),
  ]
}
