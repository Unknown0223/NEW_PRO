import { GenericRefSettingsPage } from "@/components/settings/generic-ref-settings";

export default function PhotoCategorySettingsPage() {
  return (
    <GenericRefSettingsPage
      config={{
        title: "Причины фотоотчёта",
        description:
          "Причины съёмки для мобильного «Фотоотчёт». Список синхронизируется с агентом — при визите выбирается одна причина.",
        profileRefKey: "photo_category_entries",
        showColor: true,
      }}
    />
  );
}
