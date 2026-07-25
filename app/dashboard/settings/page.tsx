import { PageHeader } from "@/components/shared/PageHeader";
import { BrandModelManager } from "@/features/settings/BrandModelManager";
import { GenericManager } from "@/features/settings/GenericManager";

export default function SettingsPage() {
  return (
    <div className="space-y-6 md:space-y-8 pb-20 px-4 md:px-0">
      <PageHeader
        title="System Configuration"
        description="Manage brands, models, and vehicle attributes."
      />

      {/* 1. Brand & Model Section */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Brands & Models</h3>
        <BrandModelManager />
      </section>

      {/* 2. Attribute Grids */}
      <section>
        <h3 className="text-lg font-semibold mb-4">Vehicle Attributes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 auto-rows-fr">
          <GenericManager collectionName="settings_colors" title="Colors" hasValueField />
          <GenericManager collectionName="settings_body" title="Body Types" />
          <GenericManager collectionName="settings_cc" title="Vehicle CC" />
          <GenericManager collectionName="settings_fuel" title="Fuel Types" />
          <GenericManager collectionName="settings_transmission" title="Transmissions" />
          <GenericManager collectionName="settings_drive" title="Drive Types" />
          <GenericManager collectionName="settings_features" title="Features (Generic)" />
        </div>
      </section>
    </div>
  );
}