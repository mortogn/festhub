"use client";

import { createContext, useContext, type PropsWithChildren } from "react";
import { Toaster } from "@festhub/ui/components/sonner";

const ToastFeedbackContext = createContext(false);

export function NotificationProvider({ children }: PropsWithChildren) {
  return (
    <ToastFeedbackContext.Provider value={true}>
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        duration={6000}
        offset={20}
        mobileOffset={16}
        toastOptions={{
          className: "break-words",
          style: { whiteSpace: "normal" },
        }}
      />
    </ToastFeedbackContext.Provider>
  );
}

export const useToastFeedback = () => useContext(ToastFeedbackContext);
