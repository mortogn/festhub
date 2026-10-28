import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import AuthUserContextProvider from "@/context/auth-user-context";
import StudentDataProvider from "@/context/student-data-context";

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
  title: "PUB FestHub",
  description:
    "Explore university events, build your team, and volunteer at PUB.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={` ${geistMono.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthUserContextProvider>
          <StudentDataProvider>{children}</StudentDataProvider>
        </AuthUserContextProvider>
      </body>
    </html>
  );
}
