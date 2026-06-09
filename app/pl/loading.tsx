export default function PLLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="container mx-auto py-8 px-4 max-w-[1600px] animate-pulse">
        <div className="h-10 w-48 bg-white/10 rounded mb-6" />
        <div className="h-20 bg-white/10 rounded-lg border border-white/20 mb-6" />
        <div className="h-[480px] bg-white/10 rounded-lg border border-white/20" />
      </div>
    </div>
  )
}
