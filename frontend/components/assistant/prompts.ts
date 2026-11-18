import type { QuickPrompt } from "@/components/assistant/types";

export const QUICK_PROMPTS: QuickPrompt[] = [
  { text: "Umumiy holat: savdo, qarz, kassa", short: "Umumiy holat", group: "Umumiy", icon: "layout" },
  { text: "Bugun savdo qancha bo‘ldi?", short: "Bugungi savdo", group: "Savdo", icon: "trend" },
  { text: "Shu oy savdo va top agentlar", short: "Oy savdosi + top agentlar", group: "Savdo", icon: "users" },
  { text: "Qarzdorlar ro‘yxati Excelda", short: "Qarzdorlar · Excel", group: "Moliya", icon: "file" },
  { text: "Oxirgi 7 kun to‘lovlar", short: "7 kunlik to‘lovlar", group: "Moliya", icon: "wallet" },
  { text: "Rasxodlar va foyda shu oy", short: "Rasxod va foyda", group: "Moliya", icon: "pie" },
  { text: "Ombordagi qoldiq", short: "Ombor qoldig‘i", group: "Ombor", icon: "box" },
  { text: "Agentlar ro‘yxati", short: "Agentlar", group: "Jamoa", icon: "users" },
  { text: "Ish haqi shu oy", short: "Ish haqi", group: "Jamoa", icon: "wallet" },
  { text: "SKU-001 narxini 150000 qil", short: "Narxni yangilash", group: "Amallar", icon: "shield" },
  { text: "Bugungi buyurtmalar holati", short: "Buyurtmalar", group: "Savdo", icon: "box" },
  { text: "Kassa oqimi hisoboti", short: "Kassa oqimi", group: "Moliya", icon: "trend" }
];

export const PROMPT_GROUPS = ["Barchasi", "Umumiy", "Savdo", "Moliya", "Ombor", "Jamoa", "Amallar"];

export const CAPABILITIES = [
  {
    title: "Savdo tahlili",
    desc: "Davrlar, mahsulotlar va agentlar kesimida",
    icon: "trend",
    tone: "teal",
    question: "Shu oy savdo va top agentlar"
  },
  {
    title: "Qarz va to‘lovlar",
    desc: "Debitorlik, kassa oqimi, Excel eksport",
    icon: "wallet",
    tone: "blue",
    question: "Qarzdorlar ro‘yxati Excelda"
  },
  {
    title: "Ombor va SKU",
    desc: "Qoldiqlar, minimal chegara, ko‘chirishlar",
    icon: "box",
    tone: "amber",
    question: "Ombordagi qoldiq"
  },
  {
    title: "Xavfsiz amallar",
    desc: "Yozish faqat tasdiq + audit bilan",
    icon: "shield",
    tone: "violet",
    question: "SKU-001 narxini 150000 qil"
  }
];

export const SECTION_ACCESS = [
  { name: "Dashboard", icon: "layout", question: "Umumiy holat: savdo, qarz, kassa" },
  { name: "Savdo", icon: "trend", question: "Bugun savdo qancha bo‘ldi?" },
  { name: "Qarzlar", icon: "wallet", question: "Qarzdorlar ro‘yxati Excelda" },
  { name: "To‘lovlar", icon: "wallet", question: "Oxirgi 7 kun to‘lovlar" },
  { name: "Rasxodlar", icon: "pie", question: "Rasxodlar va foyda shu oy" },
  { name: "Buyurtmalar", icon: "box", question: "Bugungi buyurtmalar holati" },
  { name: "Mijozlar", icon: "users", question: "Agentlar ro‘yxati" },
  { name: "Ombor", icon: "box", question: "Ombordagi qoldiq" },
  { name: "Ish haqi", icon: "wallet", question: "Ish haqi shu oy" }
];
