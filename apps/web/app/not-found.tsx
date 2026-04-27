export default function NotFound() {
  return (
    <div className="text-center py-20">
      <p className="text-6xl mb-4">🔗</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Link not found</h1>
      <p className="text-gray-500 max-w-sm mx-auto">
        This quote link is invalid or has expired (links expire after 14 days).
        Please ask your freelancer for a new link.
      </p>
    </div>
  )
}
