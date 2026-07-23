import type { Metadata, Viewport } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/i18n/context";
import { DeviceProvider } from "@/components/shared/device-provider";
import "./globals.css";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "POS F&B",
  description: "Restaurant Management System — POS F&B",
  manifest: "/manifest.json",
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <DeviceProvider>
          <I18nProvider>
            <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
              <TooltipProvider>
                {children}
                <Toaster position="top-center" richColors />
              </TooltipProvider>
            </SessionProvider>
          </I18nProvider>
        </DeviceProvider>
      </body>
    </html>
  );
}
