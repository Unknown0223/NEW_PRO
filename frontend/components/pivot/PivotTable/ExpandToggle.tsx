"use client";

import { getPivotStrings } from "@salec/pivot-engine";
import styles from "./pivot-grid.module.css";

type Props = {
  expanded: boolean;
  onToggle: () => void;
};

/** WDR-style boxed +/− hierarchy control. */
export function ExpandToggle({ expanded, onToggle }: Props) {
  const t = getPivotStrings().table;
  return (
    <button
      type="button"
      className={styles.expandBtn}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      aria-expanded={expanded}
      aria-label={expanded ? t.collapse : t.expand}
      title={expanded ? t.collapse : t.expand}
    >
      {expanded ? "−" : "+"}
    </button>
  );
}

export function ExpandSpacer() {
  return <span className={styles.expandSpacer} aria-hidden />;
}
