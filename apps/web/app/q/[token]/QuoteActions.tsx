'use client'

import { useState } from 'react'

interface QuoteActionsProps {
  token: string
  quoteId: string
}

type ActionState = 'idle' | 'changes' | 'success-ack' | 'success-changes' | 'loading' | 'error'

export default function QuoteActions({ token }: QuoteActionsProps) {
  const [state, setstate] = useState<ActionState>('idle')
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  async function handleAcknowledge() {
    setstate('loading')
    try {
      const res = await fetch(`${apiBase}/q/${token}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Request failed')
      }
      setstate('success-ack')
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.')
      setstate('error')
    }
  }

  async function handleRequestChanges() {
    if (!feedback.trim()) return
    setstate('loading')
    try {
      const res = await fetch(`${apiBase}/q/${token}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Request failed')
      }
      setstate('success-changes')
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.')
      setstate('error')
    }
  }

  if (state === 'success-ack') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-8 text-center">
        <p className="text-4xl mb-3">✅</p>
        <h2 className="text-xl font-bold text-green-800 mb-2">Change order accepted!</h2>
        <p className="text-green-700 text-sm">
          You'll receive a confirmation shortly. The freelancer has been notified.
        </p>
      </div>
    )
  }

  if (state === 'success-changes') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-8 text-center">
        <p className="text-4xl mb-3">💬</p>
        <h2 className="text-xl font-bold text-blue-800 mb-2">Feedback submitted</h2>
        <p className="text-blue-700 text-sm">
          The freelancer will review your feedback and be in touch with a revised quote.
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-5">
        <p className="text-red-700 font-medium">{errorMessage}</p>
        <button
          onClick={() => setstate('idle')}
          className="mt-3 text-sm text-red-600 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Your Response</h2>
        <p className="text-sm text-gray-500 mt-1">
          Please review the details above and let us know how you'd like to proceed.
        </p>
      </div>

      {state === 'changes' ? (
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What would you like changed?
            </label>
            <textarea
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="e.g. The timeline impact seems high. Can we reduce the scope of item 2?"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setstate('idle')}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRequestChanges}
              disabled={!feedback.trim()}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 py-5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setstate('changes')}
            className="flex-1 py-3.5 rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all"
          >
            Request Changes
          </button>
          <button
            onClick={handleAcknowledge}
            disabled={state === 'loading'}
            className="flex-1 py-3.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm shadow-green-200"
          >
            {state === 'loading' ? 'Processing…' : 'Acknowledge ✓'}
          </button>
        </div>
      )}
    </div>
  )
}
