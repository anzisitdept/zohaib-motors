"use client";

import * as React from "react";
import { SearchSelector } from "@/components/ui/SearchSelector";

interface Client {
  id: string;
  name: string;
  phone: string;
  [key: string]: any;
}

interface ClientSelectorProps {
  clients: Client[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ClientSelector({
  clients,
  value,
  onChange,
  placeholder = "Select Client...",
}: ClientSelectorProps) {
  return (
    <SearchSelector
      items={clients}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      searchPlaceholder="Search client by name or phone..."
      noItemsText="No client found."
      getSearchFields={(c) => [c.name, c.phone]}
      itemKey={(c) => c.id}
      dropdownWidthClassName="w-[350px]"
      renderTrigger={(selected) =>
        selected ? (
          <span className="truncate">
            <span className="font-medium text-foreground">{selected.name}</span>
            {selected.phone && <span className="text-muted-foreground text-xs ml-1 font-mono">({selected.phone})</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )
      }
      renderItem={(c) => (
        <div className="flex flex-col text-left">
          <span className="font-semibold text-foreground text-sm">{c.name}</span>
          {c.phone && <span className="text-xs text-muted-foreground font-mono mt-0.5">{c.phone}</span>}
        </div>
      )}
    />
  );
}
