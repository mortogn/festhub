import Link from "next/link";
import { Button } from "@festhub/ui/components/button";
import SignUpForm from "./_form";

export default function SignUp() {
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

      <SignUpForm />

      <p className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Button variant="link" asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </p>
    </div>
  );
}
