import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface Vehicle {
    id: string;
    brandName?: string;
    model: string;
    chassisNumber: string;
    registrationNumber?: string;
    [key: string]: any;
}

interface VehicleSelectorProps {
    vehicles: Vehicle[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function VehicleSelector({ vehicles, value, onChange, placeholder = "Select Vehicle..." }: VehicleSelectorProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const selectedVehicle = vehicles.find((v) => v.id === value);

    const filteredVehicles = useMemo(() => {
        if (!searchQuery) return vehicles;
        const lowerQuery = searchQuery.toLowerCase();

        return vehicles.filter((v) => {
            const name = `${v.brandName || ""} ${v.model}`.toLowerCase();
            const reg = (v.registrationNumber || "").toLowerCase();
            const chassis = (v.chassisNumber || "").toLowerCase();

            return name.includes(lowerQuery) || reg.includes(lowerQuery) || chassis.includes(lowerQuery);
        });
    }, [vehicles, searchQuery]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-card font-normal hover:bg-muted border-border"
                >
                    {selectedVehicle ? (
                        <span className="truncate flex items-center gap-2">
                            <span className="font-semibold">{selectedVehicle.brandName} {selectedVehicle.model}</span>
                            <span className="text-muted-foreground text-xs">| {selectedVehicle.chassisNumber}</span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                        placeholder="Search by name, reg no, or chassis..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground border-none focus-visible:ring-0 px-0"
                    />
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {filteredVehicles.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center">
                            <Car className="h-8 w-8 mb-2 opacity-20" />
                            No vehicle found.
                        </div>
                    ) : (
                        filteredVehicles.map((vehicle) => (
                            <div
                                key={vehicle.id}
                                onClick={() => {
                                    onChange(vehicle.id);
                                    setOpen(false);
                                    setSearchQuery("");
                                }}
                                className={cn(
                                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-muted cursor-pointer transition-colors",
                                    value === vehicle.id ? "bg-muted text-primary" : "text-foreground"
                                )}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4 shrink-0",
                                        value === vehicle.id ? "opacity-100 text-primary" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <span className="font-medium">{vehicle.brandName} {vehicle.model}</span>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="font-mono bg-muted px-1 rounded">{vehicle.chassisNumber}</span>
                                        {vehicle.registrationNumber && (
                                            <span className="font-mono text-primary">{vehicle.registrationNumber}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
