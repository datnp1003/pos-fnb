import { getServiceCharges, getAreas_list, getCategories, createServiceCharge, updateServiceCharge, deleteServiceCharge } from "@/server/settings/actions";
import { ServiceChargesUI } from "../service-charges-ui";

export default async function ServiceChargesPage() {
  const [charges, categories, areas] = await Promise.all([getServiceCharges(), getCategories(), getAreas_list()]);
  return (
    <ServiceChargesUI
      charges={charges}
      categories={categories}
      areas={areas}
      createServiceCharge={createServiceCharge}
      updateServiceCharge={updateServiceCharge}
      deleteServiceCharge={deleteServiceCharge}
    />
  );
}
