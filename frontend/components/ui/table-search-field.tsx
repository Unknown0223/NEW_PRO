"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  defaultQuery?: string;
};

/**
 * Jadval qidiruvi — matn yoziladi, keyin lupa tugmasi yoki Enter bosiladi.
 * Har harfda qayta qidiruv/qayta render bo‘lmaydi.
 */
export function TableSearchField({
  onSearch,
  placeholder = "Поиск",
  className,
  inputClassName,
  defaultQuery = ""
}: Props) {
  const [value, setValue] = useState(defaultQuery);

  const submit = useCallback(() => {
    onSearch(value.trim());
  }, [onSearch, value]);

  return (
    <div className={cn("flex min-w-[200px] max-w-md flex-1 items-stretch gap-1.5", className)}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className={cn(
          "h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
          inputClassName
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={submit}
        aria-label="Поиск"
        title="Поиск"
      >
        <Search className="size-4" />
      </Button>
    </div>
  );
}
