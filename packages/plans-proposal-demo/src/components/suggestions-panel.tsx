import { CheckCircle2, CircleDot, Rocket } from "lucide-react";
import { Badge } from "./ui";

const DONE = [
  "Jadval ichida bevosita % / so‘m tanlash va qiymat kiritish",
  "Tanlangan agentlarga barcha ko‘rinib turgan KPIlar bo‘yicha ommaviy formula",
  "Filial → supervayzer bloklari, default yig‘ilgan holat",
  "Bitta blok ochilsa avvalgisi yopiladigan akkordeon",
  "KPI ustunlarini yashirish/ko‘rsatish va filial kesimidagi yig‘indi",
  "Faqat ochiq blok jadvalini render qilish (lazy) va memoizatsiya",
  "Ko‘p KPIli yadro: har bir KPI uchun alohida konfiguratsiya va jami hisob",
  "Yopilgan oy backtest: qaysi taklif usuli o‘zini oqlagan/oqlamagani ro‘yxati",
  "Draft v5: davr+yo‘nalish uchun bitta umumiy jadval, tahrir va o‘chirish",
  "Kim / qachon / nima audit jurnali: katak tarixi tugmasi va umumiy tarix jadvali"
];

const NEXT = [
  [
    "P1",
    "Kanonik fakt kontrakti",
    "created_at vs delivered_at, qaytarish va bonus qatorlar siyosatini bitta joyda mahkamlash."
  ],
  [
    "P1",
    "Server-side hisob va snapshot",
    "Katta hajmda hisobni backendda bajarish, manba hash va optimistik lock bilan qayta hisoblash nazorati."
  ],
  [
    "P1",
    "Budjetni top-down taqsimlash",
    "Rahbar jami summa kiritsa, agentlar og‘irligi bo‘yicha taqsimlash va qoldiqni largest-remainder bilan yopish."
  ],
  [
    "P1",
    "Floor/cap va majburiy tekshiruv",
    "Minimal reja, maksimal o‘sish, outlier holatlarida «kesish» yoki «faqat ogohlantirish» siyosati."
  ],
  [
    "P2",
    "Mavsumiylik va Yangi xodim ramp-up",
    "3/6/12 oy medianasi, YoY indeks, yangi agentlar uchun shablon va 1–3 oylik ramp koeffitsiyenti."
  ],
  [
    "P2",
    "Server-side draft va audit",
    "Bitta umumiy draftni backendda saqlash, optimistik lock, foydalanuvchi autentifikatsiyasi va rollar."
  ],
  [
    "P2",
    "Ko‘p metrika",
    "count, volume, acb, order_count uchun alohida formula va yaxlitlash; pul foizini miqdorga ko‘chirmaslik."
  ],
  [
    "P3",
    "Tasdiqlash oqimi va rollback",
    "Mavjud approver zanjiriga ulash, pending/approved himoyasi, versiya va rollback."
  ]
] as const;

export function SuggestionsPanel() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <section className="card p-5">
        <h3 className="section-title flex items-center gap-2">
          <CheckCircle2 size={16} className="text-brand-600" /> Ushbu versiyada qo‘shildi
        </h3>
        <ul className="mt-4 space-y-2.5">
          {DONE.map((text) => (
            <li key={text} className="flex items-start gap-2 text-[11px] leading-5 text-[#6d8073]">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-brand-500" /> {text}
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-5">
        <h3 className="section-title flex items-center gap-2">
          <Rocket size={16} className="text-brand-600" /> Keyingi yaxshilash takliflari
        </h3>
        <div className="mt-4 space-y-3">
          {NEXT.map(([priority, title, text]) => (
            <div key={title} className="rounded-lg border border-[#e5ece7] bg-[#fbfdfb] p-3">
              <div className="flex items-center gap-2">
                <Badge tone={priority === "P1" ? "green" : priority === "P2" ? "blue" : "neutral"}>
                  {priority}
                </Badge>
                <p className="text-xs font-semibold">{title}</p>
              </div>
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-5 text-[#899a8f]">
                <CircleDot size={12} className="mt-1 shrink-0 text-[#b3c0b6]" /> {text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
