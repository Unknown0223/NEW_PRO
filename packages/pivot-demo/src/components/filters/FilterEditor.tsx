import { useState } from "react";
import type { PivotField, PivotFilter } from "@salec/pivot-engine";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { DateRangeFilter } from "./DateRangeFilter";
import { NumberRangeFilter } from "./NumberRangeFilter";
import { TopNFilter } from "./TopNFilter";

type Props = {
  field: PivotField;
  members: (string | number)[];
  allFields: PivotField[];
  filter?: PivotFilter;
  onApply: (filter: PivotFilter | null) => void;
  onClose: () => void;
};

export function FilterEditor({ field, members, allFields, filter, onApply, onClose }: Props) {
  const [view, setView] = useState<"default" | "topn">(
    filter?.type === "top_n" || filter?.type === "bottom_n" ? "topn" : "default"
  );

  if (view === "topn") {
    return (
      <TopNFilter
        field={field}
        measureFields={allFields.filter(
          (item) => item.dataType === "number" || item.dataType === "currency"
        )}
        filter={filter}
        onApply={onApply}
        onClose={() => {
          if (filter?.type === "top_n" || filter?.type === "bottom_n") onClose();
          else setView("default");
        }}
      />
    );
  }

  if (field.dataType === "date") {
    return (
      <DateRangeFilter
        fieldLabel={field.label}
        fieldId={field.id}
        filter={filter}
        onApply={onApply}
        onClose={onClose}
      />
    );
  }
  if (field.dataType === "number" || field.dataType === "currency") {
    return (
      <NumberRangeFilter
        fieldLabel={field.label}
        fieldId={field.id}
        filter={filter}
        onApply={onApply}
        onClose={onClose}
      />
    );
  }
  return (
    <MultiSelectFilter
      fieldLabel={field.label}
      members={members}
      filter={filter ? { ...filter, fieldId: field.id } : { fieldId: field.id, type: "include", values: [] }}
      onApply={(next: PivotFilter | null) => onApply(next ? { ...next, fieldId: field.id } : null)}
      onClose={onClose}
      onTopN={() => setView("topn")}
    />
  );
}
