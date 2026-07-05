import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { CurrencyProvider } from '@/components/currency-provider'
import { I18nProvider } from '@/components/i18n-provider'
import { getCurrency } from '@/lib/get-currency'
import { getExchangeRates } from '@/lib/exchange-rates'
import { getLocale } from '@/lib/get-locale'
import { getDictionary } from '@/lib/translations'
import './globals.css'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Visit Iceland | Tours & Travel Adventures',
  description:
    'Discover unforgettable adventures across Iceland. Explore over 70 handpicked day tours, multi-day journeys, private tours and reliable transportation with visit.is.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#eef1f6',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [currency, rates, locale] = await Promise.all([
    getCurrency(),
    getExchangeRates(),
    getLocale(),
  ])
  const dict = getDictionary(locale)

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${bricolage.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <I18nProvider locale={locale} dict={dict}>
          <CurrencyProvider initialCurrency={currency} rates={rates}>
            {children}
          </CurrencyProvider>
        </I18nProvider>
        <Toaster richColors position="top-center" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
