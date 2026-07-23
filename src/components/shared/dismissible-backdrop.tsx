"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

type DismissibleBackdropProps = {
  children?: ReactNode;
  className?: string;
  onDismiss: () => void;
};

export function DismissibleBackdrop({
  children,
  className,
  onDismiss,
}: Readonly<DismissibleBackdropProps>) {
  const dismissOnBackdropPress = (
    event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    onDismiss();
  };

  return (
    <button
      type="button"
      className={cn("fixed inset-0 border-0 bg-transparent p-0", className)}
      onClick={dismissOnBackdropPress}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " " && event.key !== "Escape") {
          return;
        }

        if (event.target !== event.currentTarget) {
          return;
        }

        event.preventDefault();
        dismissOnBackdropPress(event);
      }}
      aria-label="Dismiss"
    >
      {children}
    </button>
  );
}
