import type { Metadata } from "next";
import AuthProvider from "@festhub/frontend/auth";
import { NotificationProvider } from "@festhub/frontend/notifications";
import { Shell } from "@/components/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contests | PUB FestHub",
  description: "University programming contests on FestHub.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
