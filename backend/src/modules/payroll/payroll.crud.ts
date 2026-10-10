/**
 * ЗАРПЛАТА — CRUD barrel: формулы, сетки, привязка.
 */
export {
  type FormulaListRow,
  listFormulas,
  getFormulaForEngine,
  createFormula,
  patchFormula
} from "./payroll.formulas.crud";
export { type GridListRow, listGrids, createGrid, patchGrid } from "./payroll.grids.crud";
export { listAssignments, saveAssignments } from "./payroll.grids.crud";
