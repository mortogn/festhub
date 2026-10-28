import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import AuthProvider from "@festhub/frontend/auth";
import { NotificationProvider } from "@festhub/frontend/notifications";
import { Shell } from "@/components/shell";
import { SubmissionTrackerProvider } from "@/components/submission-tracker";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
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
    <html lang="en" className={`${poppins.variable} ${mono.variable}`}>
      <body className="flex min-h-svh flex-col bg-background text-foreground antialiased">
        <NotificationProvider>
          <AuthProvider>
            <SubmissionTrackerProvider>
              <Shell>{children}</Shell>
            </SubmissionTrackerProvider>
          </AuthProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
