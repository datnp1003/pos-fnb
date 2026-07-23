declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;

  interface Window {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "node:util";
import { afterEach, vi } from "vitest";

import { prismaMock, resetPrismaMock } from "./prisma-mock";

window.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/db", () => ({
  db: prismaMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(() => ({
    data: null,
    status: "unauthenticated",
    update: vi.fn(),
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

class IntersectionObserverMock {
  root = null;
  rootMargin = "";
  thresholds = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

window.confirm = vi.fn(() => true);
window.alert = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();
if (!window.Element.prototype.getAnimations) {
  window.Element.prototype.getAnimations = vi.fn(() => []);
}
if (!window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
}

Object.defineProperty(navigator, "bluetooth", {
  configurable: true,
  value: {
    requestDevice: vi.fn(),
  },
});

afterEach(() => {
  vi.clearAllMocks();
  resetPrismaMock();
});
