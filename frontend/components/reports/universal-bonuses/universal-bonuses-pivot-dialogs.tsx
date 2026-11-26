"use client";

import type { ConditionalFormatRule, PivotConfig, PivotField } from "@salec/pivot-engine";
import { VirtualPivotFieldsModal } from "@/components/reports/virtual-pivot-fields-modal";
import {
  DEFAULT_CELL_FORMAT,
  VirtualPivotConditionalDialog,
  VirtualPivotFormatCellsDialog,
  applyCellFormatToConfig,
  cellFormatFromConfig
} from "@/components/reports/virtual-pivot-format-dialogs";
import { VirtualPivotDateFormatDialog } from "@/components/reports/virtual-pivot-date-format-dialog";
import {
  VirtualPivotLayoutOptionsDialog,
  type LayoutOptionsSelection
} from "@/components/reports/virtual-pivot-layout-options-dialog";
import {
  DEFAULT_PIVOT_DATE_FORMAT,
  applyDateFormatToConfig,
  dateFormatStateFromConfig
} from "@/lib/pivot-date-format";
import type { PivotLayoutForm } from "@/lib/pivot-layout-form";

type Props = {
  fieldsOpen: boolean;
  setFieldsOpen: (v: boolean) => void;
  currentLayoutForm: PivotLayoutForm;
  pivotFields: PivotField[];
  config: PivotConfig;
  fieldsSnapshot: PivotConfig;
  filterSummaries: Record<string, string>;
  // usePivot handlers — forwarded to Fields modal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pivotHandlers: Record<string, any>;
  expandAll: () => void;
  optionsOpen: boolean;
  setOptionsOpen: (v: boolean) => void;
  layoutInitial: LayoutOptionsSelection;
  onApplyLayout: (sel: LayoutOptionsSelection) => void;
  formatCellsOpen: boolean;
  setFormatCellsOpen: (v: boolean) => void;
  conditionalOpen: boolean;
  setConditionalOpen: (v: boolean) => void;
  draftConditionalRules: ConditionalFormatRule[];
  setDraftConditionalRules: (r: ConditionalFormatRule[]) => void;
  dateFormatOpen: boolean;
  setDateFormatOpen: (v: boolean) => void;
};

export function UniversalBonusesPivotDialogs({
  fieldsOpen,
  setFieldsOpen,
  currentLayoutForm,
  pivotFields,
  config,
  fieldsSnapshot,
  filterSummaries,
  pivotHandlers,
  expandAll,
  optionsOpen,
  setOptionsOpen,
  layoutInitial,
  onApplyLayout,
  formatCellsOpen,
  setFormatCellsOpen,
  conditionalOpen,
  setConditionalOpen,
  draftConditionalRules,
  setDraftConditionalRules,
  dateFormatOpen,
  setDateFormatOpen
}: Props) {
  const valueFields = config.values.map((v) => ({
    id: v.fieldId,
    label: pivotFields.find((f) => f.id === v.fieldId)?.label ?? v.label ?? v.fieldId
  }));

  return (
    <>
      <VirtualPivotFieldsModal
        open={fieldsOpen}
        schema={currentLayoutForm}
        fields={pivotFields}
        config={config}
        onAddField={pivotHandlers.addField}
        onRemoveField={pivotHandlers.removeField}
        onUpdateAggregation={pivotHandlers.updateValueAggregation}
        onAddCalculatedPreset={pivotHandlers.addCalculatedPreset}
        onAddCalculatedMeasure={pivotHandlers.addCalculatedMeasure}
        onUpdateCalculatedMeasure={pivotHandlers.updateCalculatedMeasure}
        onRemoveCalculatedMeasure={pivotHandlers.removeCalculatedMeasure}
        onReorderFields={pivotHandlers.reorderFields}
        onValuesAxisLayoutChange={(layout) => {
          pivotHandlers.updateConfig({
            options: {
              ...config.options,
              valuesPosition: layout.position,
              valuesAxisIndex: layout.valuesAxisIndex
            }
          });
          if (layout.position === "rows") window.setTimeout(() => expandAll(), 0);
        }}
        onSetFlatColumnOrder={pivotHandlers.setFlatColumnOrder}
        onConfigureFilter={() => undefined}
        filterSummaries={filterSummaries}
        onApply={() => setFieldsOpen(false)}
        onCancel={() => {
          pivotHandlers.updateConfig(fieldsSnapshot);
          setFieldsOpen(false);
        }}
      />

      <VirtualPivotLayoutOptionsDialog
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        initial={layoutInitial}
        onApply={onApplyLayout}
      />

      <VirtualPivotFormatCellsDialog
        open={formatCellsOpen}
        onOpenChange={setFormatCellsOpen}
        initial={{ ...DEFAULT_CELL_FORMAT, ...cellFormatFromConfig(config) }}
        valueFields={valueFields}
        onApply={(state) => {
          pivotHandlers.updateConfig(applyCellFormatToConfig(config, state));
          setFormatCellsOpen(false);
        }}
      />

      <VirtualPivotConditionalDialog
        open={conditionalOpen}
        onOpenChange={setConditionalOpen}
        rules={draftConditionalRules}
        onChange={setDraftConditionalRules}
        valueFields={valueFields}
        onApply={() => {
          pivotHandlers.updateConfig({
            options: { ...config.options, conditionalFormats: draftConditionalRules }
          });
          setConditionalOpen(false);
        }}
      />

      <VirtualPivotDateFormatDialog
        open={dateFormatOpen}
        onOpenChange={setDateFormatOpen}
        initial={dateFormatStateFromConfig(config) ?? DEFAULT_PIVOT_DATE_FORMAT}
        onApply={(state) => {
          pivotHandlers.updateConfig(applyDateFormatToConfig(config, pivotFields, state));
        }}
      />
    </>
  );
}
