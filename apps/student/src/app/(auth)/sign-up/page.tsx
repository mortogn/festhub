import Link from "next/link";
import { Button } from "@festhub/ui/components/button";
import SignUpForm from "./_form";
import { authRedirect } from "@/lib/auth-redirect";
import { Suspense } from "react";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

async function SignUpContent({ searchParams }: Props) {
  const returnTo = authRedirect((await searchParams).next);
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Join FestHub to participate and volunteer in campus events.
        </p>
      </div>

      <SignUpForm returnTo={returnTo} />

      <p className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Button variant="link" asChild>
          <Link href={returnTo === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(returnTo)}`}>Sign in</Link>
        </Button>
      </p>
    </div>
  );
}

export default function SignUp(props: Props) {
  return (
    <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading sign up…</p>}>
      <SignUpContent {...props} />
    </Suspense>
  );
}
