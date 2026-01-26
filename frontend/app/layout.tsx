import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileHeader } from "@/components/mobile-header";

export const metadata: Metadata = {
  title: "Networth Pro",
  description: "Next-Gen Financial Tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <div className="flex h-screen overflow-hidden flex-col md:flex-row">
          <aside className="hidden w-64 border-r bg-muted/40 md:block">
            <AppSidebar />
          </aside>

          <div className="flex-1 flex flex-col overflow-hidden">
            <MobileHeader />
            <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
