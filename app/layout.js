import './globals.css'

export const metadata = {
  title: 'BuilderWatch',
  description: 'Live Solana Ecosystem Scanner',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
