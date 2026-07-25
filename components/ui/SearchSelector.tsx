"use client";

import * as React from "react";
import { Search, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchSelectorProps<T> {
  items: T[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  noItemsText?: string;
  getSearchFields: (item: T) => (string | null | undefined)[];
  renderItem: (item: T) => React.ReactNode;
  renderTrigger: (selectedItem: T | undefined) => React.ReactNode;
  itemKey: (item: T) => string;
  className?: string;
  dropdownWidthClassName?: string;
  disabled?: boolean;
  actionNode?: React.ReactNode;
}

export function SearchSelector<T>({
  items,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  noItemsText = "No items found.",
  getSearchFields,
  renderItem,
  renderTrigger,
  itemKey,
  className,
  dropdownWidthClassName = "w-[400px]",
  disabled = false,
  actionNode,
}: SearchSelectorProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedItem = React.useMemo(() => {
    return items.find((item) => itemKey(item) === value);
  }, [items, value, itemKey]);

  const filteredItems = React.useMemo(() => {
    if (!searchQuery) return items;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const fields = getSearchFields(item);
      return fields.some((f) => f && f.toLowerCase().includes(lowerQuery));
    });
  }, [items, searchQuery, getSearchFields]);

  // Reset active index when filtered items change
  React.useEffect(() => {
    setActiveIndex(0);
  }, [filteredItems]);

  // Focus input when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [open]);

  // Scroll active item into view
  React.useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const listEl = listRef.current;
      const activeEl = listEl.children[activeIndex] as HTMLElement;
      if (activeEl) {
        const listHeight = listEl.clientHeight;
        const activeTop = activeEl.offsetTop;
        const activeHeight = activeEl.clientHeight;

        if (activeTop < listEl.scrollTop) {
          listEl.scrollTop = activeTop;
        } else if (activeTop + activeHeight > listEl.scrollTop + listHeight) {
          listEl.scrollTop = activeTop + activeHeight - listHeight;
        }
      }
    }
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filteredItems[activeIndex];
      if (item) {
        onChange(itemKey(item));
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between bg-card font-normal hover:bg-muted border-border text-left h-10 px-3",
            className
          )}
        >
          {renderTrigger(selectedItem)}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0 shadow-lg border border-border rounded-xl bg-card z-[100]", dropdownWidthClassName)} align="start">
        <div className="flex items-center border-b border-border px-3 py-1.5 bg-muted/50 rounded-t-xl">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex h-9 w-full rounded-md bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
          />
        </div>
        <div
          ref={listRef}
          className="max-h-[250px] overflow-y-auto p-1.5 space-y-0.5"
        >
          {filteredItems.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {noItemsText}
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = value === itemKey(item);
              const isActive = idx === activeIndex;
              return (
                <div
                  key={itemKey(item)}
                  onClick={() => {
                    onChange(itemKey(item));
                    setOpen(false);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-sm outline-none transition-colors duration-150",
                    isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-foreground",
                    isActive && !isSelected ? "bg-muted text-foreground" : "",
                    isActive && isSelected ? "bg-blue-100/70" : ""
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2.5 h-4 w-4 shrink-0 transition-opacity",
                      isSelected ? "opacity-100 text-blue-600" : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    {renderItem(item)}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {actionNode && (
          <div className="border-t border-border p-1.5 bg-muted/50 rounded-b-xl">
            {actionNode}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
