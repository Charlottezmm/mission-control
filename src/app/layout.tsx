import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { I18nProvider } from "@/lib/i18n";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mission Control — OpenClaw",
  description: "Command center for OpenClaw operations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <I18nProvider>
          <div className="flex flex-col h-screen overflow-hidden">
            {/* Global top bar — consistent height across all pages */}
            <header className="h-[60px] shrink-0 border-b border-border bg-card flex items-center px-5 gap-3 z-10">
              <div>
                <h1 className="text-base font-bold tracking-tight leading-tight">🚀 Mission Control</h1>
                <p className="text-[11px] text-muted-foreground leading-tight">OpenClaw Command Center</p>
              </div>
            </header>
            <div className="flex flex-1 overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
