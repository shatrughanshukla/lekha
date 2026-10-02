import { useState, useEffect } from 'react'
import { api, STATUS_COLORS } from '../api.js'
import {
  Money, StampBadge, ErrorNote, CopyableID,
  IconBank, IconCash, IconArrowRight, IconInfo,
} from './Shared.jsx'
import TransferDetail from './TransferDetail.jsx'
import { useT } from '../i18n.jsx'
import PageLayout from './PageLayout.jsx'

// Every account the signed-in user can see, across every company they
// belong to — not scoped to one company like the accounts list inside
// CompanyView. Selecting one drills into its own transaction history;
// selecting a transaction reuses the same TransferDetail modal the rest
// of the app already uses, so the level of detail (who, when, status,
// approvals) is identical everywhere.
export default function AccountsPage({ token, user }) {
  const { t, tType, tAccountType, dateLocale } = useT()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selected, setSelected] = useState(null)
  const [accountTransfers, setAccountTransfers] = useState([])
  const [transfersLoading, setTransfersLoading] = useState(false)
  const [detailTransferId, setDetailTransferId] = useState(null)

  useEffect(() => {
    loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAccounts() {
    setLoading(true)
    setError('')
    try {
      setAccounts(await api.listMyAccounts(token))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openAccount(acc) {
    setSelected(acc)
    setTransfersLoading(true)
    setError('')
    try {
      // The backend requires company_id on this endpoint (a transfer can
      // only be listed through a company you belong to) — the account
      // already carries its own company_id, so we pass that through and
      // then narrow to just this account's own side of each transfer.
      const all = await api.listTransfers(token, acc.company_id)
      setAccountTransfers(all.filter((tr) => tr.from_account_id === acc.id || tr.to_account_id === acc.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setTransfersLoading(false)
    }
  }

  function refreshOpenAccount() {
    if (selected) openAccount(selected)
  }

  if (selected) {
    return (
      <PageLayout restoreScroll={false}>
        <button className="back-link" onClick={() => setSelected(null)}>
          {t('all_accounts')}
        </button>

        <ErrorNote message={error} />

        <div className="statement-header">
          <div className="page-title">
            {selected.account_type === 'CASH' ? <IconCash width={22} height={22} /> : <IconBank width={22} height={22} />}
            {selected.company_name} — {tAccountType(selected.account_type)}
          </div>
          <div className="stat-strip">
            <div className="stat">
              <span className="stat-label">{t('col_amount')}</span>
              <span className="stat-value money"><Money value={selected.current_balance} /></span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-label">{t('status_label')}</span>
              <span className="stat-value">{selected.is_active ? t('active_pill') : t('inactive_pill')}</span>
            </div>
          </div>
        </div>

        <section className="panel">
          <h2>{t('transactions_nav')}</h2>
          {transfersLoading ? (
            <div className="empty-state">{t('loading')}</div>
          ) : accountTransfers.length === 0 ? (
            <div className="empty-state">{t('no_transfers')}</div>
          ) : (
            <div className="ledger-table">
              <div className="ledger-table-head">
                <span>{t('col_date')}</span>
                <span>{t('col_type')}</span>
                <span>{t('col_route')}</span>
                <span>{t('col_status')}</span>
                <span className="align-right">{t('col_amount')}</span>
                <span></span>
              </div>
              {accountTransfers.map((tr) => {
                const fromLabel = (tr.from_company_name ? `${tr.from_company_name} · ${tAccountType(tr.from_account_type)}` : tr.from_account_id.slice(0, 6)) + (tr.from_account_deleted ? ` (${t('deleted_tag')})` : '')
                const toLabel = (tr.to_company_name ? `${tr.to_company_name} · ${tAccountType(tr.to_account_type)}` : tr.to_account_id.slice(0, 6)) + (tr.to_account_deleted ? ` (${t('deleted_tag')})` : '')
                return (
                  <div key={tr.id} className="ledger-table-row clickable" onClick={() => setDetailTransferId(tr.id)}>
                    <span className="mono dim">{new Date(tr.transaction_date).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}</span>
                    <span>
                      {tType(tr.transfer_type)}
                      {tr.transfer_notes && <div className="note-preview">"{tr.transfer_notes}"</div>}
                    </span>
                    <span className="route mono dim">
                      <span className="route-part" title={fromLabel}>{fromLabel}</span>
                      <IconArrowRight width={13} height={13} />
                      <span className="route-part" title={toLabel}>{toLabel}</span>
                    </span>
                    <span>
                      <StampBadge status={tr.status} color={STATUS_COLORS[tr.status]} />
                    </span>
                    <span className="align-right"><Money value={tr.amount} /></span>
                    <button
                      className="info-btn"
                      title={t('view_details_title')}
                      onClick={(e) => { e.stopPropagation(); setDetailTransferId(tr.id) }}
                    >
                      <IconInfo width={15} height={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {detailTransferId && (
          <TransferDetail
            token={token}
            user={user}
            company={{ id: selected.company_id }}
            transferId={detailTransferId}
            onClose={() => setDetailTransferId(null)}
            onChanged={refreshOpenAccount}
          />
        )}
      </PageLayout>
    )
  }

  return (
    <PageLayout title={t('accounts_nav')} titleId="page-title" subtitle={t('accounts_page_hint')}>

      <ErrorNote message={error} />

      {loading ? (
        <div className="empty-state">{t('loading')}</div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">{t('no_accounts')}</div>
      ) : (
        <div className="account-row">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              className={`account-chip type-${acc.account_type.toLowerCase()} clickable`}
              onClick={() => openAccount(acc)}
            >
              <div className="account-chip-top">
                {acc.account_type === 'CASH' ? <IconCash width={18} height={18} /> : <IconBank width={18} height={18} />}
              </div>
              <div className="account-chip-type">{acc.company_name}</div>
              <div className="account-chip-balance"><Money value={acc.current_balance} /></div>
              <CopyableID id={acc.id} className="account-chip-id" />
              <div className="account-chip-status-row">
                <div className={acc.is_active ? 'pill pill-active' : 'pill pill-inactive'}>
                  {acc.is_active ? t('active_pill') : t('inactive_pill')}
                </div>
                <span className="link-btn small" style={{ pointerEvents: 'none' }}>{tAccountType(acc.account_type)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
