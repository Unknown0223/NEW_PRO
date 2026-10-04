import { GenericRefSettingsPage } from "@/components/settings/generic-ref-settings";

export default function UserTaskTypesPage() {
  return (
    <GenericRefSettingsPage
      config={{
        title: "Задачи — типы задач",
        description:
          "Виды поручений сотрудникам: «Звонок», «Визит», «Проверка полки», «Документ». Пример: супервайзер даёт агенту задачу типа «Визит» — зайти в магазин и проверить выкладку. Здесь задаётся список таких типов и их цвет.",
        profileRefKey: "task_type_entries",
        showColor: true,
      }}
    />
  );
}
