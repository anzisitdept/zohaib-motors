"use client";

import * as React from "react";
import { SearchSelector } from "@/components/ui/SearchSelector";

interface Vehicle {
  id: string;
  brandName: string;
  model: string;
  modelYear?: string | number;
  year?: string | number;
  color?: string;
  chassisNumber?: string;
  chassisNo?: string;
  registrationNumber?: string;
  registrationNo?: string;
  purchasePrice?: number | string;
  [key: string]: any;
}

interface VehicleSelectorProps {
  vehicles: Vehicle[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showCost?: boolean;
  disabled?: boolean;
}

export function VehicleSelector({
  vehicles,
  value,
  onChange,
  placeholder = "Choose a vehicle...",
  showCost = false,
  disabled = false,
}: VehicleSelectorProps) {
  return (
    <SearchSelector
      items={vehicles}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      searchPlaceholder="Search by model, chassis, or registration..."
      noItemsText="No matching vehicles found."
      getSearchFields={(v) => {
        const name = `${v.brandName} ${v.model}`;
        const chassis = v.chassisNumber || v.chassisNo || "";
        const reg = v.registrationNumber || v.registrationNo || "";
        return [name, v.brandName, v.model, chassis, reg];
      }}
      itemKey={(v) => v.id}
      dropdownWidthClassName="w-[450px]"
      renderTrigger={(selected) =>
        selected ? (
          <span className="truncate flex items-center justify-between w-full">
            <span className="truncate">
              <span className="font-semibold text-foreground">{selected.brandName} {selected.model}</span>
              <span className="text-muted-foreground text-xs ml-2">
                {selected.modelYear || selected.year} · {selected.color} · {(selected.chassisNumber || selected.chassisNo)?.slice(-6) || "N/A"}
                {showCost && ` · Cost: Rs. ${Number(selected.purchasePrice || 0).toLocaleString()}`}
              </span>
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground truncate">{placeholder}</span>
        )
      }
      renderItem={(v) => (
        <div className="flex flex-col w-full text-left">
          <div className="flex justify-between items-center gap-2">
            <span className="font-semibold text-foreground text-sm">{v.brandName} {v.model}</span>
            <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded shrink-0">
              {(v.chassisNumber || v.chassisNo) || "N/A"}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
            <span className="truncate pr-2">
              {v.modelYear || v.year} · {v.color} · {v.registrationNumber || v.registrationNo || "Unregistered"}
            </span>
            {showCost && (
              <span className="font-medium text-primary shrink-0">
                Cost: Rs. {Number(v.purchasePrice || 0).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    />
  );
}
