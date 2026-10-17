"use client";

import { useEffect, useRef } from "react";

/** Ro‘yxat qidiruvi: birinchi renderda chaqirmaydi, keyin yozilgan matnni kechiktirib beradi. */
export function useDebouncedSearchCommit(
  draft: string,
  commit: (query: string) => void,
  delay = 300
) {
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const timer = window.setTimeout(() => commitRef.current(draft.trim()), delay);
    return () => window.clearTimeout(timer);
  }, [draft, delay]);
}
