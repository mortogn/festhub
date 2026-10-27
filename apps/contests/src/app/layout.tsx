import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import AuthProvider from "@festhub/frontend/auth";
import { NotificationProvider } from "@festhub/frontend/notifications";
import { Shell } from "@/components/shell";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Contests | PUB FestHub",
  description: "University programming contests on FestHub.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-svh flex-col bg-background text-foreground antialiased">
        <NotificationProvider>
          <AuthProvider>
            <Shell>{children}</Shell>
          </AuthProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
