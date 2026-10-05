import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '24 Mason Street Sale Tracker',
  description: 'Property sale progress dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
