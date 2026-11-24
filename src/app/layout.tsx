import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { HTML_LANG } from "@/lib/i18n";
import { getLocale, getT, messagesFor } from "@/lib/i18n/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "CargoTribe: sealed freight quotes", template: "%s | CargoTribe" },
  description:
    "The community where overseas freight agents and Australian and New Zealand forwarders meet. Post a job, get sealed quotes, award the best one.",
  applicationName: "CargoTribe",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "CargoTribe", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111b36",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getT();
  return (
    <html lang={HTML_LANG[locale]} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <I18nProvider locale={locale} messages={messagesFor(locale)}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-3 focus:text-sm focus:shadow"
          >
            {t("Skip to main content")}
          </a>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
