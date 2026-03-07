import type { Metadata } from "next";
import Link from "next/link";
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

const mobileTabs = [
  { href: "/", label: "总览" },
  { href: "/tasks", label: "任务" },
  { href: "/calendar", label: "Cron" },
  { href: "/office", label: "办公" },
  { href: "/memory", label: "记忆" },
  { href: "/team", label: "团队" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Mission Control" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <I18nProvider>
          <div className="flex flex-col h-screen overflow-hidden">
            <header className="h-[60px] shrink-0 border-b border-border bg-card flex items-center px-4 md:px-5 gap-3 z-10">
              <div>
                <h1 className="text-base font-bold tracking-tight leading-tight">
                  <span className="md:hidden">🚀 MC</span>
                  <span className="hidden md:inline">🚀 Mission Control</span>
                </h1>
                <p className="hidden md:block text-[11px] text-muted-foreground leading-tight">OpenClaw Command Center</p>
              </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
            </div>

            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border flex items-center justify-around z-50 safe-area-pb">
              {mobileTabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground px-1 py-2"
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
