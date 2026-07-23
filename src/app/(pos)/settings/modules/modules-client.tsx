"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toggleModule } from "@/server/settings/actions";
import { toast } from "sonner";
import { useI18n } from "@/i18n/context";

type Module = {
  id: string;
  name: string;
  enabled: boolean;
  config: string | null;
  updatedAt: Date;
};

export function ModulesClient({ modules: initialModules }: Readonly<{ modules: Module[] }>) {
  const { t, locale } = useI18n();
  const [modules, setModules] = useState(initialModules);

  const descriptions: Record<string, string> = {
    kds: t.modules.kds,
    inventory: t.modules.inventory,
    orders: t.modules.orders,
    reports: t.modules.reports,
    karaoke: t.modules.karaoke,
  };

  async function handleToggle(id: string, currentEnabled: boolean) {
    const action = currentEnabled ? t.modules.disabledAction : t.modules.enabledAction;
    setModules(prev => prev.map(m => m.id === id ? { ...m, enabled: !currentEnabled } : m));
    try {
      await toggleModule(id, !currentEnabled);
      toast.success(t.modules.toggled.replace("{action}", action));
    } catch {
      setModules(prev => prev.map(m => m.id === id ? { ...m, enabled: currentEnabled } : m));
      toast.error(t.common.error);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">{t.modules.title}</h2>
      <p className="text-sm text-muted-foreground mb-6">{t.modules.desc}</p>
      <div className="grid gap-4">
        {modules.map((m) => (
          <Card key={m.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base capitalize">{locale === "vi" ? ({
                    kds: "KDS", inventory: t.nav.inventory, orders: t.nav.sales, reports: t.nav.reports, karaoke: t.settings.karaoke,
                  } as Record<string, string>)[m.name] || m.name : m.name}</CardTitle>
                  <CardDescription>{descriptions[m.name] || t.modules.noDesc}</CardDescription>
                </div>
                <Badge variant={m.enabled ? "default" : "secondary"}>
                  {m.enabled ? t.modules.on : t.modules.off}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {m.enabled ? t.modules.activeStatus : t.modules.inactiveStatus}
                </p>
                <Switch
                  checked={m.enabled}
                  onCheckedChange={() => handleToggle(m.id, m.enabled)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
