import { type CSSProperties } from "react";
import type { PivotConfig, PivotField } from "@salec/pivot-engine";
import { type PivotThemeId } from "./themes/tokens.js";
import "./pivot-ui.css";
export type PivotAppOptions = {
    /** Default false — Options / host must opt in */
    drillThrough?: boolean;
    locale?: "ru" | "uz";
    theme?: PivotThemeId;
    useWorker?: boolean;
    workerThreshold?: number;
    className?: string;
    style?: CSSProperties;
    drillColumnIds?: string[];
};
export type PivotAppProps = {
    data: Record<string, unknown>[];
    fields: PivotField[];
    config?: Partial<PivotConfig>;
    onConfigChange?: (config: PivotConfig) => void;
    options?: PivotAppOptions;
};
export declare function PivotApp({ data, fields, config: initialConfig, onConfigChange, options }: PivotAppProps): import("react").JSX.Element;
//# sourceMappingURL=PivotApp.d.ts.map