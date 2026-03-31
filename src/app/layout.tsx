import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { DevBanner } from "@/components/ui/DevBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Scorecard",
  description: "Track scores for your favorite games",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen text-neutral-100 antialiased">
        <SessionProvider>
          <DevBanner />
          <div className="mx-auto max-w-2xl min-h-screen flex flex-col">
            {children}
          </div>
          <InstallPrompt />
          <ServiceWorkerRegistration />
        </SessionProvider>
      </body>
    </html>
  );
}
