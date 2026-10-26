"use client";

import { useRef, useState } from "react";
import { Button } from "@festhub/ui/components/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@festhub/ui/components/alert-dialog";
import { Trash2Icon } from "@festhub/ui/icons";
import { toast } from "@festhub/ui/components/sonner";
import { errorMessage } from "./api";
import { useToastFeedback } from "./notifications";

export function DeleteButton({
  label,
  title,
  description,
  action,
  onSuccess,
  successMessage,
}: {
  label: string;
  title: string;
  description: string;
  action: () => Promise<unknown>;
  onSuccess: () => void;
  successMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const locked = useRef(false);
  const toastFeedback = useToastFeedback();

  async function remove() {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError(null);
    try {
      await action();
      setOpen(false);
      if (toastFeedback) toast.success(successMessage);
      else setSuccess(true);
      onSuccess();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          if (locked.current) return;
          setOpen(value);
          setError(null);
          setSuccess(false);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            title={label}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          aria-busy={pending}
          onEscapeKeyDown={(event) => {
            if (locked.current) event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">{title}</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm whitespace-pre-line break-words text-destructive"
            >
              {error}
            </p>
          )}
          <AlertDialogFooter className="flex-row justify-end">
            <AlertDialogCancel variant="ghost" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                // Keep the dialog open while deleting and when the API rejects it.
                event.preventDefault();
                void remove();
              }}
            >
              <Trash2Icon aria-hidden="true" />
              {pending ? "DELETING…" : "DELETE"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {success && (
        <span role="status" className="sr-only">
          {successMessage}
        </span>
      )}
    </>
  );
}
