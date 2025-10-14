'use client'

import { UserSettings } from '@/components/UserSettings'
import { Navbar } from '@/components/Navbar'

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <UserSettings />
      </div>
    </div>
  )
}

