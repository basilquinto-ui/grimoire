import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'Grimoire — Practice Intelligence',
  description: 'The occult practice operating system. Pattern analysis across your personal magical record.',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#09080f' }}>{children}</body>
    </html>
  )
}
