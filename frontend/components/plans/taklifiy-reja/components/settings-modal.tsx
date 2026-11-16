import { useState } from "react";
import { Settings2 } from "lucide-react";
import type { ProposalController } from "@taklifiy/hooks/use-proposal";
import { kpiLabel } from "@taklifiy/lib/catalog";
import { Button, Field, Modal, Select, Toggle } from "./ui";

export function SettingsModal({
  c,
  open,
  onClose
}: {
  c: ProposalController;
  open: boolean;
  onClose: () => void;
}) {
  const [kpiId, setKpiId] = useState(c.allKpiIds[0] ?? 1);
  const config = c.configs[String(kpiId)];
  if (!config) return null;
  const s = config.settings;
  const update = (fn: (d: typeof config) => void) => c.updateConfig(kpiId, fn);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hisob sozlamalari"
      subtitle="Tanlangan KPI guruhi uchun manba maqomi, yaxlitlash va MTD prognozi."
      wide
    >
      <Field label="KPI GURUHI">
        <Select
          aria-label="Sozlamalar KPI guruhi"
          value={kpiId}
          onChange={(e) => setKpiId(Number(e.target.value))}
        >
          {c.allKpiIds.map((id) => (
            <option key={id} value={id}>
              {kpiLabel(c, id)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="OLDI REJA MAQOMI">
          <Select
            value={s.sourceStatus}
            onChange={(e) =>
              update((d) => {
                d.settings.sourceStatus = e.target.value as typeof s.sourceStatus;
              })
            }
          >
            <option value="approved_only">Faqat «Tasdiqlangan»</option>
            <option value="official">Tasdiqlangan + tasdiqlashga yuborilgan</option>
          </Select>
        </Field>
        <Field label="YAKUNIY YAXLITLASH">
          <Select
            value={s.roundingStep}
            onChange={(e) =>
              update((d) => {
                d.settings.roundingStep = e.target.value;
              })
            }
          >
            <option value="100">1 so‘mgacha</option>
            <option value="10000">100 so‘mgacha</option>
            <option value="100000">1 000 so‘mgacha</option>
            <option value="1000000">10 000 so‘mgacha</option>
          </Select>
        </Field>
        <Field label="KATTA O‘SISH OGOHLANTIRISHI, %">
          <input
            type="number"
            min={0}
            max={1000}
            className="field"
            value={s.growthWarningPercent}
            onChange={(e) =>
              update((d) => {
                d.settings.growthWarningPercent = Math.max(
                  0,
                  Math.min(1000, Number(e.target.value))
                );
              })
            }
          />
        </Field>
        <Field label="OUTLIER UCHUN TARIX OYLARI">
          <input
            type="number"
            min={0}
            max={12}
            className="field"
            value={s.outlierLookbackMonths}
            onChange={(e) =>
              update((d) => {
                d.settings.outlierLookbackMonths = Math.max(
                  0,
                  Math.min(12, Number(e.target.value))
                );
              })
            }
          />
        </Field>
      </div>
      <div className="mt-4 rounded-lg border border-[#e4ebe6] p-3">
        <Toggle
          checked={s.projection.enabled}
          onChange={(enabled) =>
            update((d) => {
              d.settings.projection.enabled = enabled;
            })
          }
          label="MTDni ish kunlariga prognozlash"
          description="Faqat to‘liq bo‘lmagan faktga. Eski rejaga ta’sir qilmaydi."
        />
        {s.projection.enabled && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="O‘TGAN ISH KUNI">
              <input
                aria-label="O‘tgan ish kuni"
                type="number"
                min={0}
                max={s.projection.totalWorkingDays}
                className="field"
                value={s.projection.elapsedWorkingDays}
                onChange={(e) =>
                  update((d) => {
                    d.settings.projection.elapsedWorkingDays = Math.max(
                      0,
                      Math.min(s.projection.totalWorkingDays, Number(e.target.value))
                    );
                  })
                }
              />
            </Field>
            <Field label="JAMI ISH KUNI">
              <input
                aria-label="Jami ish kuni"
                type="number"
                min={Math.max(1, s.projection.elapsedWorkingDays)}
                max={31}
                className="field"
                value={s.projection.totalWorkingDays}
                onChange={(e) =>
                  update((d) => {
                    d.settings.projection.totalWorkingDays = Math.max(
                      1,
                      Math.min(31, Number(e.target.value))
                    );
                  })
                }
              />
            </Field>
          </div>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button
          onClick={() => {
            c.updateAllConfigs((d) => {
              d.settings = JSON.parse(JSON.stringify(s));
            });
            c.notify("Sozlamalar barcha KPI guruhlariga qo‘llandi");
          }}
        >
          Barcha KPIlarga qo‘llash
        </Button>
        <Button variant="primary" onClick={onClose}>
          <Settings2 size={13} /> Yopish
        </Button>
      </div>
    </Modal>
  );
}
