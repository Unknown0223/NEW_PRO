import { useCallback, useState } from "react";
import { validateFormula, type Formula } from "@salec/plans-proposal";

export type FormulaFieldsState = {
  basis: Formula["basis"];
  mode: Formula["mode"];
  raw: string;
  error: string | null;
  setBasis: (basis: Formula["basis"]) => void;
  setMode: (mode: Formula["mode"]) => void;
  setRaw: (raw: string) => void;
  reset: (formula: Formula) => void;
  read: () => Formula | null;
};

/** Editorlar uchun umumiy draft; validatsiyadan o‘tmaguncha hisobga yozilmaydi. */
export function useFormulaFields(initial: Formula): FormulaFieldsState {
  const [basis, setBasis] = useState(initial.basis);
  const [mode, setModeState] = useState(initial.mode);
  const [raw, setRawState] = useState(String(initial.value));
  const [error, setError] = useState<string | null>(null);
  const setMode = useCallback((next: Formula["mode"]) => {
    setModeState(next);
    setError(null);
  }, []);
  const setRaw = useCallback((next: string) => {
    setRawState(next);
    setError(null);
  }, []);
  const reset = useCallback((formula: Formula) => {
    setBasis(formula.basis);
    setModeState(formula.mode);
    setRawState(String(formula.value));
    setError(null);
  }, []);
  const read = useCallback(() => {
    const formula: Formula = {
      basis,
      mode,
      value: raw.trim() === "" ? NaN : Number(raw.trim().replace(",", "."))
    };
    const problem = validateFormula(formula);
    setError(problem);
    return problem ? null : formula;
  }, [basis, mode, raw]);
  return { basis, mode, raw, error, setBasis, setMode, setRaw, reset, read };
}
