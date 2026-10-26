import Link from "next/link";
import SignInForm from "./_form";
import { Button } from "@festhub/ui/components/button";
import { authRedirect } from "@/lib/auth-redirect";
import { Suspense } from "react";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

async function SignInContent({ searchParams }: Props) {
  const returnTo = authRedirect((await searchParams).next);
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sign in to access your FestHub account.
        </p>
      </div>

      <SignInForm returnTo={returnTo} />

      <p className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
        New to FestHub?{" "}
        <Button variant={"link"} asChild>
          <Link href={returnTo === "/" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(returnTo)}`}>Create an account</Link>
        </Button>
      </p>
    </div>
  );
}

export default function SignIn(props: Props) {
  return (
    <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading sign in…</p>}>
      <SignInContent {...props} />
    </Suspense>
  );
}
