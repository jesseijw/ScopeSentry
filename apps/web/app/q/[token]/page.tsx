import { notFound } from 'next/navigation'
import QuoteActions from './QuoteActions'

interface LineItem {
  description: string
  hours: number
  rateCents: number
  totalCents: number
}

interface QuoteData {
  quoteId: string
  status: string
  project: {
    title: string
    clientName: string
    clientEmail: string
  }
  version: {
    lineItems: LineItem[]
    subtotalCents: number
    totalCents: number
    timelineImpactDays: number
    rationale: string
  } | null
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

async function fetchQuote(token: string): Promise<QuoteData | null> {
  const apiUrl = process.env.API_URL || 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/q/${token}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function QuotePage({ params }: { params: { token: string } }) {
  const data = await fetchQuote(params.token)

  if (!data || !data.version) {
    notFound()
  }

  const { quoteId, status, project, version } = data
  const { lineItems, subtotalCents, totalCents, timelineImpactDays, rationale } = version

  const isActive = status === 'AWAITING_CLIENT'
  const isAccepted = status === 'ACCEPTED'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-indigo-600 px-6 py-5">
          <p className="text-indigo-200 text-sm font-medium mb-1">Change Order Request</p>
          <h1 className="text-white text-2xl font-bold">{project.title}</h1>
          <p className="text-indigo-200 text-sm mt-1">Client: {project.clientName}</p>
        </div>

        <div className="px-6 py-5">
          <p className="text-gray-600 text-sm leading-relaxed">{rationale}</p>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Line Items</h2>
        </div>

        <div className="divide-y divide-gray-50">
          {lineItems.map((item, i) => (
            <div key={i} className="px-6 py-4 flex justify-between items-start gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{item.description}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.hours}h × {formatCents(item.rateCents)}/hr
                </p>
              </div>
              <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                {formatCents(item.totalCents)}
              </p>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCents(subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
            <span>Total</span>
            <span className="text-indigo-700">{formatCents(totalCents)}</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3">
        <span className="text-amber-600 text-lg">⏱</span>
        <div>
          <p className="text-sm font-semibold text-amber-900">Timeline Impact</p>
          <p className="text-sm text-amber-700">
            +{timelineImpactDays} day{timelineImpactDays !== 1 ? 's' : ''} added to the project timeline
          </p>
        </div>
      </div>

      {/* Status / Actions */}
      {isAccepted ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-5 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-green-800 font-semibold text-lg">Change order accepted</p>
          <p className="text-green-600 text-sm mt-1">
            Thank you. The scope has been updated and your freelancer has been notified.
          </p>
        </div>
      ) : !isActive ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-5 text-center">
          <p className="text-gray-600 font-medium">This quote is no longer active.</p>
          <p className="text-gray-500 text-sm mt-1">Status: {status.replace(/_/g, ' ')}</p>
        </div>
      ) : (
        <QuoteActions token={params.token} quoteId={quoteId} />
      )}

      {/* Legal note */}
      <p className="text-center text-xs text-gray-400">
        Acknowledgement via this link is not a legal signature. Powered by{' '}
        <span className="text-indigo-500 font-medium">ScopeSentry</span>.
      </p>
    </div>
  )
}
