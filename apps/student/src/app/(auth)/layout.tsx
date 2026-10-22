import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="sticky top-0 hidden h-dvh overflow-hidden lg:block">
        <Image
          src="/pub_campus.png"
          alt="University campus"
          fill
          priority
          sizes="50vw"
          className="object-cover saturate-75"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
          <p className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Your campus.
            <br />
            Your next experience.
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
            Discover events, meet your community, and make the most of campus
            life with FestHub.
          </p>
        </div>
      </aside>
      <main className="flex flex-col min-h-dvh min-w-0 items-center justify-center bg-background px-6 py-12 sm:px-10 lg:px-12">
        <div className="flex items-center justify-center">
          <Link
            href="/"
            aria-label="FestHub home"
            className="mb-10 inline-flex rounded-lg bg-white p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <Image src="/logo.svg" alt="PUB FestHub" width={150} height={58} />
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
