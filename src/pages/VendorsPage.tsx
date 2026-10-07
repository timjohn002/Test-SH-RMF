import { Link, useParams } from 'react-router-dom'
import { ErrorBox, FullPageSpinner, errorMessage } from '../components/ui'
import { VendorStatusBadge } from '../components/vendors/common'
import { useVendors } from '../hooks/useVendors'
import { timeAgo } from '../lib/format'
import { VENDOR_UI } from '../vendors'

/** `/vendors`: the robot vendors this build supports. */
export function VendorsPage() {
  const { data: vendors, isPending, error } = useVendors()

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <div>
          <h1 className="text-xl font-semibold">Robot vendors</h1>
          <p className="text-sm text-slate-500">
            Integrations built into this app. Configure a vendor to sync its robots and receive its callbacks.
          </p>
        </div>

        {isPending && <FullPageSpinner />}
        {error && <ErrorBox>{errorMessage(error)}</ErrorBox>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendors?.map((v) => (
            <Link
              key={v.id}
              to={`/vendors/${v.id}`}
              className="group flex flex-col rounded-lg border border-slate-200 bg-white p-5 transition-shadow hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-semibold">{v.name}</span>
                <VendorStatusBadge status={v.status} />
              </div>
              <p className="mt-1 flex-1 text-sm text-slate-500">{v.description}</p>
              <dl className="mt-4 grid grid-cols-2 gap-1 text-xs text-slate-500">
                <dt>Robots</dt>
                <dd className="text-right text-slate-700">{v.robot_count}</dd>
                <dt>Last sync</dt>
                <dd className="text-right text-slate-700">{timeAgo(v.last_sync_at)}</dd>
                <dt>Last callback</dt>
                <dd className="text-right text-slate-700">{timeAgo(v.last_callback_at)}</dd>
              </dl>
              <span className="mt-4 text-sm font-medium text-blue-600 group-hover:underline">Configure →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

/** `/vendors/:vendorId`: hands off to the vendor's own config page. */
export function VendorConfigPage() {
  const { vendorId = '' } = useParams()
  const Page = VENDOR_UI[vendorId]?.ConfigPage

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        {Page ? (
          <Page vendorId={vendorId} />
        ) : (
          <ErrorBox title="Unknown vendor">
            This app has no integration called “{vendorId}”.{' '}
            <Link to="/vendors" className="underline">
              Back to vendors
            </Link>
          </ErrorBox>
        )}
      </div>
    </div>
  )
}
