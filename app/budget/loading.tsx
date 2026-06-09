export default function BudgetLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-7xl animate-pulse">
        <div className="h-10 w-80 bg-white/10 rounded mb-2" />
        <div className="h-5 w-96 bg-white/5 rounded mb-6" />
        <div className="h-24 bg-white/10 rounded-lg border border-white/20 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white/10 rounded-lg border border-white/20" />
          ))}
        </div>
        <div className="h-96 bg-white/10 rounded-lg border border-white/20" />
      </div>
    </div>
  )
}
