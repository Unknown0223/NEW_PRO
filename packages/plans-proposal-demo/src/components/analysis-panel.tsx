import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Code2,
  Database,
  GitBranch,
  ListChecks,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Badge, Button, Segmented, cx } from "./ui";
import type { ProposalController } from "@/hooks/use-proposal";
import { SuggestionsPanel } from "./suggestions-panel";

const CHECKS = [
  ["To‘liq manba oyi", "Manba oyini Oktabr 2026 qiling. «Yakunlangan oy» belgisini tekshiring."],
  ["Fakt + foiz", "Fakt savdosi +10%: sof fakt 100 mln bo‘lsa, taklif 110 mln bo‘lishi kerak."],
  [
    "Fakt + summa",
    "Summada rejimga o‘ting, +5 mln kiriting. Har bir tayyor qatorga aynan 5 mln qo‘shiladi."
  ],
  [
    "Eski reja usullari",
    "Eski oy rejasini tanlang. Foiz va summa rejimlarida eski reja ustunidan hisoblanishini solishtiring."
  ],
  [
    "Filial bloklari",
    "Sahifa default yig‘ilgan ochiladi. Filialni oching, ichida supervayzer blokini oching. Boshqa blok ochilsa avvalgisi yopiladi."
  ],
  [
    "Joyida kengayuvchi tahrir",
    "Katakni bosing: modal emas, o‘sha ustun yon tomonga kengayib editor ochiladi. Enter saqlaydi, Escape yopadi."
  ],
  [
    "Katak darajasida tanlash",
    "Katak, agent, ustun yoki blok checkboxlarini belgilang. Expanded editorda «Blokda hammasini tanlash» ham bor. Ommaviy panel faqat tanlangan kataklarga qo‘llaydi."
  ],
  [
    "Ustun tepasida blokka o‘rnatish",
    "KPI ustunidagi «Hammasiga» tugmasi shu supervayzer bloki ichida joyida ochiladi va faqat o‘sha blok kataklariga formulani yozadi."
  ],
  [
    "Ustuvorlik",
    "Hisobdan chiqarish > qo‘lda qiymat > jadval/ommaviy katak formulasi > maxsus qoida > umumiy qoida. Reset katak formulasini olib tashlaydi."
  ],
  [
    "Yetishmayotgan ma’lumot",
    "Bobur Nazarov (AG-007) fakti yo‘q. 0 emas, «Ma’lumot kerak». Otabek Umarov (AG-009) da fakt manfiy: katak va inline editorda eski reja summasi chiqadi, «Eski rejaga o‘tish» bilan asos qilib olinadi."
  ],
  [
    "MTD va prognoz",
    "Noyabr manbasida MTD ogohlantirishi chiqadi. Sozlamalarda prognozni yoqib, asos o‘zgarishini ko‘ring."
  ],
  [
    "Oqlash tahlili va umumiy draft",
    "Yopilgan oy uchun qaysi usul o‘zini oqlaganini ko‘ring. Umumiy draft jadvalida qatorni tahrirlang, o‘chiring va katak tarixini tekshiring."
  ],
  [
    "Eksport",
    "CSV yuklab oling. Qo‘lda sabablar, qoida, ogohlantirishlar va tayyor emas belgisi borligini tekshiring."
  ]
] as const;

export function AnalysisPanel({ c }: { c: ProposalController }) {
  const [tab, setTab] = useState<"logic" | "project" | "checklist" | "suggestions">("logic");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  return (
    <div className="animate-enter space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <BookOpen size={17} className="text-brand-600" />
              Modul mantiqi va loyiha analizi
            </h2>
            <p className="mt-1 text-xs text-[#8b9b90]">
              Nima hisoblanadi, nima tekshiriladi va asosiy tizimga qanday ulanadi.
            </p>
          </div>
          <Badge tone="amber">Sintetik ma’lumotlar · backend ulanmagan</Badge>
        </div>
        <div className="mt-5 max-w-xl">
          <Segmented
            label="Analiz bo‘limi"
            value={tab}
            onChange={setTab}
            options={[
              { value: "logic", label: "Hisob mantiqi" },
              { value: "project", label: "Loyiha analizi" },
              { value: "checklist", label: "Sinov checklist" },
              { value: "suggestions", label: "Takliflar" }
            ]}
          />
        </div>
      </section>
      {tab === "logic" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-5">
            <h3 className="section-title">To‘rtta asosiy formula</h3>
            <div className="mt-4 space-y-3">
              {[
                ["Fakt + foiz", "Sof fakt × (1 + P / 100)", "100 mln +10% → 110 mln"],
                ["Fakt + summa", "Sof fakt + S", "100 mln +5 mln → 105 mln"],
                ["Eski reja + foiz", "Eski reja × (1 + P / 100)", "90 mln +10% → 99 mln"],
                ["Eski reja + summa", "Eski reja + S", "90 mln +5 mln → 95 mln"]
              ].map(([title, formula, example]) => (
                <div key={title} className="rounded-lg border border-[#e5ece7] bg-[#fbfdfb] p-3">
                  <p className="text-[11px] font-semibold">{title}</p>
                  <p className="mt-1 font-mono text-xs text-brand-700">{formula}</p>
                  <p className="mt-1 text-[10px] text-[#98a59c]">{example}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] leading-5 text-[#8c9c91]">
              P manfiy bo‘lsa kamaytirish. Summa KPIning o‘z birligida. Natija 0 dan past bo‘lmaydi,
              keyin belgilangan qadamga yaxlitlanadi. Hisob BigInt minor birliklarda.
            </p>
          </section>
          <section className="card p-5">
            <h3 className="section-title">Ustuvorlik va xavfsizlik qoidalari</h3>
            <ol className="mt-4 space-y-4">
              {[
                [
                  "01",
                  "Hisobdan chiqarish",
                  "Katak yakuniy summadan chiqadi; formula va manual qiymat natijani o‘zgartirmaydi."
                ],
                [
                  "02",
                  "Qo‘lda kiritish",
                  "Sabab bilan kiritilgan aniq qiymat barcha formulalardan ustun. Olib tashlansa formula hisobi qaytadi."
                ],
                [
                  "03",
                  "Katak formulasi",
                  "Inline yoki ommaviy tanlangan katak formulasi (`cellFormulas`). Ustun/blok ommaviy amali ham shu qatlamga yoziladi."
                ],
                [
                  "04",
                  "Maxsus va umumiy qoida",
                  "Faol qoidalar ro‘yxatida oxirgi mos qoida yutadi; topilmasa KPI default formulasi ishlaydi."
                ],
                [
                  "05",
                  "Ma’lumot sifati",
                  "Yo‘q fakt/reja ≠ 0. Tasdiqlanmagan reja default olinmaydi. MTD alohida belgilanadi; prognoz faqat opt-in."
                ],
                [
                  "06",
                  "Yakuniy nazorat",
                  "0 natija, yo‘q manba, nofaol yoki bog‘lanmagan xodim bloklanadi. Katta sakrash ogohlantiradi, lekin avtomatik kesilmaydi."
                ]
              ].map(([n, title, text]) => (
                <li key={n} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[10px] font-bold text-brand-600">
                    {n}
                  </span>
                  <div>
                    <p className="text-xs font-semibold">{title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-[#8c9b91]">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
      {tab === "project" && (
        <div className="space-y-5">
          <section className="card p-5">
            <h3 className="section-title flex items-center gap-2">
              <Database size={16} className="text-brand-600" />
              Mavjud SALEC arxitekturasi
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                [
                  "SalesKpiPlan",
                  "Oy × yil × yo‘nalish × KPI guruhi. draft → pending_approval → approved."
                ],
                [
                  "SalesKpiPlanTarget",
                  "Xodim × reja: cost, count, volume, acb, order_count. Ushbu prototip faqat cost (summa) bilan ishlaydi."
                ],
                [
                  "KpiGroupAgent / KpiGroupProduct",
                  "Agent a’zoligi va KPI mahsulotlari. Bir xodimning bir mahsuloti faqat bitta faol KPI guruhida."
                ],
                [
                  "Fakt manbalari",
                  "Kunlik KPI created_at bo‘yicha, payroll delivered_at bo‘yicha hisoblaydi. Yangi modul uchun yagona kanonik fakt kontrakti kerak."
                ]
              ].map(([title, text]) => (
                <div key={title} className="rounded-lg border border-[#e5ece7] p-4">
                  <code className="text-[11px] font-semibold text-brand-700">{title}</code>
                  <p className="mt-2 text-[11px] leading-5 text-[#899a8f]">{text}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="card p-5">
            <h3 className="section-title flex items-center gap-2">
              <GitBranch size={16} className="text-brand-600" /> Tavsiya etilgan integratsiya
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                [
                  "1",
                  "Read-only analiz",
                  "Manba snapshoti, kanonik sof fakt, yangi plans.taklifiy_reja.* RBAC. GET setup ichidagi yashirin yozuvlardan ajratish."
                ],
                [
                  "2",
                  "Draft va audit",
                  "Alohida proposal modeli, qoidalar JSON, versiya / optimistik lock, manual sabab, audit. Taklif asosiy rejani bevosita o‘zgartirmaydi."
                ],
                [
                  "3",
                  "Ko‘chirish va tasdiq",
                  "Faqat draft targetlarga atomik ko‘chirish, approved/pending himoyasi, mavjud approver zanjiri, rollback va eksport."
                ]
              ].map(([n, title, text]) => (
                <div key={n} className="rounded-xl bg-[#f6f9f6] p-4">
                  <Badge tone="green">Bosqich {n}</Badge>
                  <h4 className="mt-3 text-xs font-semibold">{title}</h4>
                  <p className="mt-2 text-[11px] leading-5 text-[#8b9b91]">{text}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-2 text-[10px] text-[#97a59b]">
              <Code2 size={13} />
              To‘liq texnik reja: docs/PLANS_TAKLIFIY_REJA_ANALIZ_VA_REJA.md
            </p>
          </section>
        </div>
      )}
      {tab === "suggestions" && <SuggestionsPanel />}
      {tab === "checklist" && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e8eee9] px-5 py-4">
            <h3 className="section-title flex items-center gap-2">
              <ListChecks size={16} className="text-brand-600" />
              Qo‘lda sinov rejasi
            </h3>
            <Badge tone="green">
              {checked.size} / {CHECKS.length} bajarildi
            </Badge>
          </div>
          <div className="divide-y divide-[#edf1ee]">
            {CHECKS.map(([title, text], i) => (
              <label
                key={title}
                className={cx(
                  "flex cursor-pointer items-start gap-3 px-5 py-4 transition hover:bg-[#fafcfb]",
                  checked.has(i) && "bg-brand-50/40"
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked.has(i)}
                  onChange={() =>
                    setChecked((old) => {
                      const next = new Set(old);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })
                  }
                />
                {checked.has(i) ? (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-500" />
                ) : (
                  <Circle size={18} className="mt-0.5 shrink-0 text-[#c5d1c8]" />
                )}
                <span>
                  <span
                    className={cx(
                      "block text-xs font-semibold",
                      checked.has(i) && "text-brand-700"
                    )}
                  >
                    {i + 1}. {title}
                  </span>
                  <span className="mt-1 block text-[11px] leading-5 text-[#8d9c92]">{text}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-[#e8eee9] px-5 py-4">
            <Button variant="ghost" onClick={() => setChecked(new Set())}>
              Belgilarni tozalash
            </Button>
            <Button variant="primary" onClick={() => c.setTab("calculator")}>
              <Sparkles size={13} />
              Hisob-kitobni ochish
              <ArrowRight size={13} />
            </Button>
          </div>
        </section>
      )}
      <p className="flex items-center gap-2 px-1 text-[10px] text-[#98a69c]">
        <ShieldCheck size={13} />
        Bu sahifa qaror qabul qilishni tekshirish uchun. Yakuniy reja maqomi va huquqlar production
        integratsiyada server tomonida tekshiriladi.
      </p>
    </div>
  );
}
