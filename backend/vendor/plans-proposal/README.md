# @salec/plans-proposal

Taklifiy KPI rejalari uchun framework-free, deterministik hisoblash yadrosi. DB, HTTP, React yoki brauzer xotirasiga bog‘liq emas.

## Kontrakt

- Pul: `Money` — integer minor birlik stringi (UZS tiyin). `1000000` tiyin = `10 000` so‘m. BigInt bilan aniq hisob.
- Foiz: `Formula.value` so‘mda emas, oddiy foiz soni (`10` = 10%, `12.5` = 12.5%). Ichkarida bps ga o‘tadi.
- Summa: `Formula.value` so‘m (`5000000` = 5 mln so‘m), 2 kasrgacha.
- Asos: `fact` yoki `previous_plan`; usul: `percent` yoki `amount`.
- Ustuvorlik: excluded > manual(reason) > jadval katak formulasi (`cellFormulas`) > oxirgi mos faol qoida > default.
- Ko‘p KPI: `calculateMultiProposal()` bitta yo‘nalishdagi bir nechta KPI datasetini alohida konfiguratsiyalar bilan hisoblaydi va umumiy totals qaytaradi.
- Yo‘q manba `null`; 0 manba alohida holat. Yakuniy 0, nofaol yoki KPIga bog‘lanmagan xodim bloklanadi.
- MTD prognozi faqat `settings.projection.enabled` bilan; eski rejaga ta’sir qilmaydi.
- Yakuniy yaxlitlash half-up, minor birlikdagi `roundingStep` ga.

## Ishlatish

```ts
import { calculateProposal, DEFAULT_CONFIG } from "@salec/plans-proposal";

const result = calculateProposal({ context, config: DEFAULT_CONFIG, employees });
console.log(result.totals.proposed); // minor birlik string
```

`validateConfig()` UI/API chegarasida chaqiriladi. `calculateProposal()` inputni o‘zgartirmaydi va bir xil inputga bir xil natija qaytaradi.

## Tekshiruv

```bash
npm test
npm run typecheck
```

27 unit test: 4 formula, manfiy/kamaytirish, bulk/selected, qoida ustuvorligi, inline katak formulasi, ko‘p KPI izolatsiyasi, manual sabab, excluded, yo‘q/0/manfiy manba, draft reja filtri, MTD/prognoz, outlier, yaxlitlash, yil chegarasi, validatsiya, determinizm.

Productionda Prisma Decimal/string adapter shu yadroni chaqiradi; frontend va backend bir xil mantiqni ishlatadi. Batafsil: `docs/PLANS_TAKLIFIY_REJA_ANALIZ_VA_REJA.md`.
