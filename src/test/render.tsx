import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";

import { DeviceProvider } from "@/components/shared/device-provider";
import { I18nProvider } from "@/i18n/context";

function TestProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <DeviceProvider>
        <I18nProvider>{children}</I18nProvider>
      </DeviceProvider>
    </SessionProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: TestProviders, ...options });
}

export * from "@testing-library/react";
export { userEvent } from "@testing-library/user-event";
