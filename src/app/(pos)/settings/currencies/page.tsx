import { getCurrencies } from "@/server/settings/actions";
import { CurrenciesManager } from "./currencies-client";
import { getServerDictionary } from "@/lib/locale";

export default async function CurrenciesPage() {
  const currencies = await getCurrencies();
  const t = await getServerDictionary();
  return (
    <div>
      <h2 className="text-xl font-bold mb-2">{t.settings.sidebar.currencies}</h2>
      <p className="text-sm text-muted-foreground mb-6">{t.settings.currenciesPageDesc}</p>
      <CurrenciesManager currencies={currencies} />
    </div>
  );
}
