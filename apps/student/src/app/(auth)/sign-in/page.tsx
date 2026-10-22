import Link from "next/link";
import SignInForm from "./_form";
import { Button } from "@festhub/ui/components/button";

export default function SignIn() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sign in to access your FestHub account.
        </p>
      </div>

      <SignInForm />

      <p className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
        New to FestHub?{" "}
        <Button variant={"link"} asChild>
          <Link href="/sign-up">Create an account</Link>
        </Button>
      </p>
    </div>
  );
}
