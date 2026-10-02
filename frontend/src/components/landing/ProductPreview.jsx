import { STATUS_COLORS } from '../../api.js'
import {
  IconLekhaMark, IconGrid, IconWallet, IconSwap, IconList, IconChat, IconChart,
  IconBuilding, IconClock, IconSparkle, Money, StampBadge,
} from '../Shared.jsx'
import { useT } from '../../i18n.jsx'

// A static, illustrative preview of the real dashboard. It deliberately does
// NOT import Dashboard/CompanyView (they pull in the API client, charts and
// the whole authenticated app) — it reuses the same tokens, icons, Money and
// StampBadge components instead, so it looks like the product while staying
// cheap to load. All names and figures are sample data; the caption under it
// says so, and the frame is exposed to assistive tech as a single described
// image rather than as live content.

const RAIL = [
  { key: 'nav_dashboard', icon: IconGrid, active: true },
  { key: 'nav_accounts', icon: IconWallet },
  { key: 'nav_transfers', icon: IconSwap },
  { key: 'nav_transactions', icon: IconList },
  { key: 'nav_assistant', icon: IconChat },
  { key: 'nav_reports', icon: IconChart },
]

const KPIS = [
  { key: 'hero_companies', value: '2', icon: IconBuilding },
  { key: 'hero_accounts', value: '5', icon: IconWallet },
  { key: 'hero_pending', value: '2', icon: IconClock, warn: true },
  { key: 'hero_recent', value: '9', icon: IconSwap },
]

const ROWS = [
  { from: 'Harbor Trading', to: 'Meridian Supplies', type: 'BANK TO BANK TRANSFER', amount: 25000, status: 'PENDING' },
  { from: 'Harbor Trading', to: 'Harbor Trading', type: 'CASH DEPOSIT IN BANK', amount: 12000, status: 'COMPLETED' },
  { from: 'Meridian Supplies', to: 'Harbor Trading', type: 'BANK TO BANK TRANSFER', amount: 8500, status: 'COMPLETED' },
  { from: 'Harbor Trading', to: 'Meridian Supplies', type: 'BANK TO BANK TRANSFER', amount: 4200, status: 'CANCELLED' },
]

const BARS = [38, 56, 44, 72, 52, 86, 64]

export default function ProductPreview() {
  const { t, tType } = useT()

  return (
    <figure className="lp-pv-frame">
      <div className="lp-pv" role="img" aria-label={t('landing_pv_alt')}>
        <div className="lp-pv-rail" aria-hidden="true">
          <div className="lp-pv-brand"><IconLekhaMark width={20} height={20} />Lekha</div>
          {RAIL.map(({ key, icon: Icon, active }) => (
            <div key={key} className={`lp-pv-nav${active ? ' active' : ''}`}>
              <Icon /> <span>{t(key)}</span>
            </div>
          ))}
        </div>

        <div className="lp-pv-main" aria-hidden="true">
          <p className="lp-pv-title">{t('nav_dashboard')}</p>

          <div className="lp-pv-kpis">
            {KPIS.map(({ key, value, icon: Icon, warn }) => (
              <div className="lp-pv-kpi" key={key}>
                <span className="lp-pv-kpi-label"><Icon />{t(key)}</span>
                <span className={`lp-pv-kpi-value${warn ? ' warn' : ''}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="lp-pv-panels">
            <div className="lp-pv-panel">
              <p className="lp-pv-panel-title">{t('landing_pv_recent')}</p>
              {ROWS.map((r, i) => (
                <div className="lp-pv-row" key={i}>
                  <div className="lp-pv-row-start">
                    <span className="lp-pv-row-main">{r.from} → {r.to}</span>
                    <span className="lp-pv-row-sub">{tType(r.type)}</span>
                  </div>
                  <div className="lp-pv-row-end">
                    <Money value={r.amount} />
                    <StampBadge status={r.status} color={STATUS_COLORS[r.status]} />
                  </div>
                </div>
              ))}
            </div>

            <div className="lp-pv-side">
              <div className="lp-pv-panel">
                <p className="lp-pv-panel-title"><IconSparkle width={13} height={13} />{t('insights_title')}</p>
                <p className="lp-pv-insight">{t('landing_pv_insight')}</p>
              </div>
              <div className="lp-pv-panel lp-pv-chart">
                <p className="lp-pv-panel-title"><IconChart width={13} height={13} />{t('nav_reports')}</p>
                <div className="lp-pv-bars">
                  {BARS.map((h, i) => <span key={i} className="lp-pv-bar" style={{ height: `${h}%` }} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="lp-pv-caption">{t('landing_pv_caption')}</figcaption>
    </figure>
  )
}
