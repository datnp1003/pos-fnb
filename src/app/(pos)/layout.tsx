import { unstable_cache } from "next/cache";
import { getSystemModules } from "@/server/settings/actions";
import { PosLayoutClient } from "./pos-layout-client";

// Cache system modules for 5 minutes — they rarely change
const getCachedModules = unstable_cache(
  async (): Promise<string[]> => {
    const modules = await getSystemModules();
    return modules.filter(m => m.enabled).map(m => m.name);
  },
  ["system-modules"],
  { revalidate: 300, tags: ["system-modules"] }
);

export default async function PosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const moduleNames = await getCachedModules();
  return <PosLayoutClient enabledModuleNames={moduleNames}>{children}</PosLayoutClient>;
}
