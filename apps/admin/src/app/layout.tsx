import type { Metadata } from "next";
import { Inter, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import AuthProvider from "@festhub/frontend/auth";
import { NotificationProvider } from "@festhub/frontend/notifications";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "FestHub | Admin", template: "%s | FestHub Admin" },
  description: "FestHub admin event management dashboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NotificationProvider>
          <AuthProvider>{children}</AuthProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
