import { useState, useEffect } from 'react'
import { api, STATUS_COLORS } from '../api.js'
import { Money, StampBadge, ErrorNote, IconArrowRight, IconInfo } from './Shared.jsx'
import TransferDetail from './TransferDetail.jsx'
import { useT } from '../i18n.jsx'
import PageLayout from './PageLayout.jsx'

// Powers both the "Transfers" and "Transactions" sidebar pages. They show
// the same underlying data (there's only one concept, a transfer, in this
// app's model) at two different scopes:
//   - scope="mine"  → Transfers: only ones YOU personally initiated,
//     regardless of which of your companies sent them.
//   - scope="all"   → Transactions: your full read-only ledger — every
//     transfer touching any account you have access to, sent or received,
//     by anyone.
export default function TransferLedgerPage({ token, user, scope }) {
  const { t, tType, tAccountType, dateLocale } = useT()
  const [transfers, setTransfers] = useState([])
  const [myCompanyIds, setMyCompanyIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailTransferId, setDetailTransferId] = useState(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [companies, all] = await Promise.all([
        api.listCompanies(token),
        api.listAllTransfers(token),
      ])
      setMyCompanyIds(new Set(companies.map((c) => c.id)))
      setTransfers(scope === 'mine' ? all.filter((tr) => tr.created_by_user === user.id) : all)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // TransferDetail needs to know which side of the transfer "you" are
  // viewing from, to show the right approve/reject/propose actions. Since
  // this is a cross-company list, that's whichever side is actually one
  // of your own companies (the backend re-checks authorization itself
  // either way — this only affects which buttons are shown optimistically).
  function myCompanyIdFor(tr) {
    return myCompanyIds.has(tr.from_company_id) ? tr.from_company_id : tr.to_company_id
  }

  const title = scope === 'mine' ? t('transfers_nav') : t('transactions_nav')
  const hint = scope === 'mine' ? t('transfers_page_hint') : t('transactions_page_hint')

  return (
    <PageLayout title={title} subtitle={hint} titleId="page-title">
      <ErrorNote message={error} />

      <section className="panel">
        {loading ? (
          <div className="empty-state">{t('loading')}</div>
        ) : transfers.length === 0 ? (
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
            {transfers.map((tr) => {
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
          company={{ id: myCompanyIdFor(transfers.find((tr) => tr.id === detailTransferId)) }}
          transferId={detailTransferId}
          onClose={() => setDetailTransferId(null)}
          onChanged={load}
        />
      )}
    </PageLayout>
  )
}
