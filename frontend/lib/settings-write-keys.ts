/** Profile-reference kaliti → Access yangilash kaliti. */
export const SETTINGS_REF_WRITE_KEY: Record<string, string> = {
  request_type_entries: "settings.prichiny.update",
  refusal_reason_entries: "settings.prichiny.update",
  cancel_payment_reason_entries: "settings.prichiny.update",
  order_note_entries: "settings.prichiny.update",
  photo_category_entries: "settings.prichiny.update",
  finance_category_entries: "settings.prichiny.update",
  task_type_entries: "settings.tipy_zadach.update",
  inventory_type_entries: "settings.inventar_i_korobka.update",
  box_type_entries: "settings.inventar_i_korobka.update",
  equipment_printer_entries: "settings.oborudovanie.update",
  equipment_tare_entries: "settings.oborudovanie.update",
  kb_type_entries: "settings.baza_znaniy.update",
  knowledge_base_entries: "settings.baza_znaniy.update",
  client_format_entries: "settings.format_klienta.update",
  client_type_entries: "settings.tip_klienta.update",
  client_category_entries: "settings.kategoriya_klienta.update"
};

export function settingsWriteKeyForRef(profileRefKey: string): string {
  return SETTINGS_REF_WRITE_KEY[profileRefKey] ?? "settings.profil_kompanii.update";
}
