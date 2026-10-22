import type { Metadata } from "next";
import type { ReactNode } from "react";
import ProfileShell from "./_components/profile-shell";

export const metadata: Metadata = {
  title: "My profile | FestHub",
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <ProfileShell>{children}</ProfileShell>;
}
