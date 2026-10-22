"use client";

import client from "@/lib/api";
import { Button } from "@festhub/ui/components/button";
import { UsersIcon } from "@festhub/ui/icons";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  eventId: string;
  disabled: boolean;
};

export default function ParticipantRegisterButton({ eventId, disabled }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    if (disabled || isSubmitting || isRegistered) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await client.participants.$post({ json: { eventId } });

      if (response.status === 401) {
        router.push("/sign-in");
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        setError(
          "message" in data && typeof data.message === "string"
            ? data.message
            : "Unable to register right now. Please try again.",
        );
        return;
      }

      setIsRegistered(true);
    } catch {
      setError("Could not connect. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="w-full h-11"
        size="lg"
        onClick={register}
        disabled={disabled || isSubmitting || isRegistered}
        aria-busy={isSubmitting}
      >
        <UsersIcon />
        {isRegistered
          ? "Registration requested"
          : isSubmitting
            ? "Registering…"
            : "Join as a participant"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {isRegistered && (
        <p role="status" className="text-sm text-muted-foreground">
          Your registration is pending approval.
        </p>
      )}
    </div>
  );
}
