"use client";

import { DismissibleBackdrop } from "@/components/shared/dismissible-backdrop";
import { useDevice } from "@/hooks/use-device";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function MobileSheet({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-sm",
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly maxWidth?: string;
}) {
  const { isMobile } = useDevice();

  if (!isMobile) {
    return open ? (
      <DismissibleBackdrop
        className="z-50 flex items-center justify-center bg-black/40"
        onDismiss={onClose}
      >
        <dialog
          open
          className={`bg-white border-0 rounded-2xl shadow-xl w-full ${maxWidth} p-6 mx-4`}
        >
            <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
            {children}
        </dialog>
      </DismissibleBackdrop>
    ) : null;
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh] p-0 rounded-t-2xl [&>button]:hidden">
        <div className="px-4 pt-4 pb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
