"use client";
import { useState } from "react";
import { X, Printer } from "lucide-react";
import { useBusinessSettings } from "@/features/invoices/useBusinessSettings";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ *
 * IMPORTANT: these pieces used to be defined *inside*
 * PurchaseInvoicePrintModal. That meant a brand-new function (== a brand
 * component type, to React) was created on every render. Every
 * keystroke re-rendered the parent, which redefined these, which made
 * React unmount + remount the whole form instead of just updating the
 * input value — that's what was causing focus loss and the scroll
 * jumping to the top on every character typed.
 *
 * Moving them to module scope keeps their identity stable across
 * renders, so React just diffs/updates instead of remounting.
 * ------------------------------------------------------------------ */

// A single "Label ....... [editable input]" line, matching the printed underline field
const FieldLine = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="flex items-baseline gap-2 min-w-0">
    <span className="text-black text-[13px] whitespace-nowrap">{label}</span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder=""
      className="flex-1 min-w-0 border-0 border-b border-black text-[13px] px-1 leading-tight bg-transparent focus:outline-none focus:bg-blue-50 print:focus:bg-transparent"
    />
  </div>
);

// NIC boxes: 5 - 7 - 1 pattern, each box independently editable (1 char)
const NicBoxes = ({
  prefix,
  getEdited,
  handleChange,
}: {
  prefix: string;
  getEdited: (key: string, defaultVal?: any) => string;
  handleChange: (key: string, value: string) => void;
}) => {
  const box = (key: string) => (
    <input
      key={key}
      type="text"
      maxLength={1}
      value={getEdited(key, "")}
      onChange={(e) => handleChange(key, e.target.value.slice(0, 1))}
      className="w-4 h-5 border border-black -ml-px text-center text-[10px] leading-none p-0 bg-transparent focus:outline-none focus:bg-blue-50 print:focus:bg-transparent"
    />
  );
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[13px] font-semibold text-black w-14 shrink-0">N.I.C</span>
      <div className="flex">
        {[...Array(5)].map((_, i) => box(`${prefix}_a${i}`))}
        <span className="w-3 h-5 border-t border-b border-black flex items-center justify-center text-[10px]">
          –
        </span>
        {[...Array(7)].map((_, i) => box(`${prefix}_b${i}`))}
        <span className="w-3 h-5 border-t border-b border-black flex items-center justify-center text-[10px]">
          –
        </span>
        {box(`${prefix}_c0`)}
      </div>
    </div>
  );
};

const InvoiceDocument = ({
  invoice,
  settings,
  getEdited,
  handleChange,
  purchasePriceVal,
  downPaymentVal,
  remainingAmountVal,
  wahidPhone,
  hayatPhone,
  addressLine1,
}: {
  invoice: any;
  settings: Record<string, any>;
  getEdited: (key: string, defaultVal?: any) => string;
  handleChange: (key: string, value: string) => void;
  purchasePriceVal: number;
  downPaymentVal: number;
  remainingAmountVal: number;
  wahidPhone: string;
  hayatPhone: string;
  addressLine1: string;
}) => (
  <div
    id="print-content"
    className="bg-white p-6 md:p-8 max-w-3xl mx-auto text-black font-sans relative"
    style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
  >
    {/* ===== HEADER ===== */}
    <div className="flex items-start justify-between mb-2">
      <div>
        <h1
          className="text-4xl font-extrabold uppercase tracking-wide leading-none -rotate-1"
          style={{ color: "#A53A3A" }}
        >
          {settings["business_name_main"] || "Zohaib"}
        </h1>
        <h2 className="text-xl font-bold text-blue-700 uppercase tracking-wide mt-1">
          {settings["business_name_sub"] || "Motors Showroom"}
        </h2>
      </div>

      {/* Space reserved for vehicle photo — left blank intentionally */}
      <div className="w-32 h-16 shrink-0" />
    </div>

    {/* Address */}
    <div className="flex items-center gap-1 text-[12px] text-black mb-1">
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="black">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
      </svg>
      <span>{addressLine1}</span>
    </div>

    {/* Contact row */}
    <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-[13px] font-bold mb-3">
      <span className="text-blue-700">
        Wahid Bux <span className="font-normal ml-1">{wahidPhone}</span>
      </span>
      <span className="text-blue-700">
        Hayat Ali <span className="font-normal ml-1">{hayatPhone}</span>
      </span>
    </div>

    {/* Title block: both headings centered, no border row */}
    <div className="text-center mb-2">
      <div className="text-[13px] font-bold uppercase text-blue-800 tracking-wide">
        Purchase Receipt & Acquisition Letter
      </div>
      <div className="text-2xl font-extrabold text-blue-700 uppercase leading-tight">
        Commission Agent
      </div>
    </div>

    {/* Serial No: its own row below the headings */}
    <div className="flex items-center justify-end gap-1 text-[13px] font-semibold whitespace-nowrap mb-4">
      <span>Serial No</span>
      <input
        type="text"
        value={getEdited("serialNo", invoice.id?.slice(0, 8).toUpperCase() || "")}
        onChange={(e) => handleChange("serialNo", e.target.value)}
        className="border-0 border-b border-black min-w-[100px] px-1 text-center bg-transparent focus:outline-none focus:bg-blue-50 print:focus:bg-transparent"
      />
    </div>

    {/* ===== BODY FIELDS ===== */}
    <div className="space-y-2 mb-4">
      <FieldLine label="Date" value={getEdited("purchaseDate")} onChange={(v) => handleChange("purchaseDate", v)} />

      <div className="grid grid-cols-2 gap-x-6">
        <FieldLine
          label="Registration No"
          value={getEdited("registrationNumber")}
          onChange={(v) => handleChange("registrationNumber", v)}
        />
        <FieldLine label="Maker" value={getEdited("brandName")} onChange={(v) => handleChange("brandName", v)} />
      </div>

      <div className="grid grid-cols-3 gap-x-6">
        <FieldLine label="Model" value={getEdited("model")} onChange={(v) => handleChange("model", v)} />
        <FieldLine
          label="Hours Power"
          value={getEdited("engineCapacity")}
          onChange={(v) => handleChange("engineCapacity", v)}
        />
        <FieldLine label="Colour" value={getEdited("color")} onChange={(v) => handleChange("color", v)} />
      </div>

      <div className="grid grid-cols-2 gap-x-6">
        <FieldLine
          label="Chassis No:"
          value={getEdited("chassisNumber")}
          onChange={(v) => handleChange("chassisNumber", v)}
        />
        <FieldLine
          label="Engine No:"
          value={getEdited("engineNumber")}
          onChange={(v) => handleChange("engineNumber", v)}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-6">
        <FieldLine
          label="On this day"
          value={getEdited("purchaseDate2", invoice.purchaseDate || "")}
          onChange={(v) => handleChange("purchaseDate2", v)}
        />
        <FieldLine label="Time" value={getEdited("purchaseTime")} onChange={(v) => handleChange("purchaseTime", v)} />
      </div>

      <FieldLine
        label="Registration Named"
        value={getEdited("purchaserName", invoice.sellerClientName || "")}
        onChange={(v) => handleChange("purchaserName", v)}
      />
      <FieldLine
        label="Total Amount"
        value={getEdited(
          "totalAmount",
          purchasePriceVal ? `Rs. ${Number(purchasePriceVal).toLocaleString()}` : ""
        )}
        onChange={(v) => handleChange("totalAmount", v)}
      />
      <FieldLine
        label="Advance Rs."
        value={getEdited(
          "advanceRs",
          downPaymentVal ? `Rs. ${Number(downPaymentVal).toLocaleString()}` : ""
        )}
        onChange={(v) => handleChange("advanceRs", v)}
      />
      <FieldLine
        label="For sum of rupees"
        value={getEdited("forSumOfRupees")}
        onChange={(v) => handleChange("forSumOfRupees", v)}
      />
      <FieldLine
        label="Balance Rs."
        value={getEdited(
          "balanceRs",
          remainingAmountVal ? `Rs. ${Number(remainingAmountVal).toLocaleString()}` : ""
        )}
        onChange={(v) => handleChange("balanceRs", v)}
      />
    </div>

    {/* ===== SELLER / PURCHASER ===== */}
    <div className="grid grid-cols-2 gap-x-8 mb-2">
      <h4 className="font-bold uppercase text-base" style={{ color: "#A53A3A" }}>
        Seller's
      </h4>
      <h4 className="font-bold uppercase text-base" style={{ color: "#A53A3A" }}>
        Purchaser's
      </h4>
    </div>

    <div className="grid grid-cols-2 gap-x-8">
      <NicBoxes prefix="nicSeller" getEdited={getEdited} handleChange={handleChange} />
      <NicBoxes prefix="nicPurchaser" getEdited={getEdited} handleChange={handleChange} />

      <FieldLine label="Name:" value={getEdited("sellerName")} onChange={(v) => handleChange("sellerName", v)} />
      <FieldLine label="Name:" value={getEdited("purchaserName")} onChange={(v) => handleChange("purchaserName", v)} />

      <FieldLine
        label="S/o"
        value={getEdited("sellerFatherName")}
        onChange={(v) => handleChange("sellerFatherName", v)}
      />
      <FieldLine
        label="S/o"
        value={getEdited("purchaserFatherName")}
        onChange={(v) => handleChange("purchaserFatherName", v)}
      />

      <FieldLine label="RES:" value={getEdited("sellerRes")} onChange={(v) => handleChange("sellerRes", v)} />
      <FieldLine label="RES:" value={getEdited("purchaserRes")} onChange={(v) => handleChange("purchaserRes", v)} />

      <FieldLine
        label="Phone No:"
        value={getEdited("sellerPhone")}
        onChange={(v) => handleChange("sellerPhone", v)}
      />
      <FieldLine
        label="Phone No:"
        value={getEdited("purchaserPhone")}
        onChange={(v) => handleChange("purchaserPhone", v)}
      />

      <FieldLine label="Book" value={getEdited("book")} onChange={(v) => handleChange("book", v)} />
      <FieldLine
        label="Number Plate"
        value={getEdited("numberPlate")}
        onChange={(v) => handleChange("numberPlate", v)}
      />

      <FieldLine label="File" value={getEdited("file")} onChange={(v) => handleChange("file", v)} />
      <FieldLine label="Keys" value={getEdited("keys")} onChange={(v) => handleChange("keys", v)} />

      <div className="mt-3">
        <FieldLine
          label="Signature"
          value={getEdited("sellerSignature")}
          onChange={(v) => handleChange("sellerSignature", v)}
        />
      </div>
      <div className="mt-3">
        <FieldLine
          label="Signature"
          value={getEdited("purchaserSignature")}
          onChange={(v) => handleChange("purchaserSignature", v)}
        />
      </div>

      <FieldLine
        label="Witness"
        value={getEdited("sellerWitness")}
        onChange={(v) => handleChange("sellerWitness", v)}
      />
      <FieldLine
        label="Witness"
        value={getEdited("purchaserWitness")}
        onChange={(v) => handleChange("purchaserWitness", v)}
      />
    </div>

    <div className="grid grid-cols-2 gap-x-8 mt-3">
      <NicBoxes prefix="nicSellerBottom" getEdited={getEdited} handleChange={handleChange} />
      <NicBoxes prefix="nicPurchaserBottom" getEdited={getEdited} handleChange={handleChange} />
    </div>

    {/* ===== FOOTER ===== */}
    <div className="mt-4 bg-blue-800 text-white text-[12px] font-medium text-center px-3 py-2">
      This vehicle has been verified and confirmed from Excise Department/CPLC by the purchaser
      and found correct in all respects.
    </div>
  </div>
);

/* ------------------------------------------------------------------ *
 * EXPORT - the public modal component
 * ------------------------------------------------------------------ */

export const PurchaseInvoicePrintModal = ({ isOpen, onClose, invoice }: {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
}) => {
  // Hooks must run unconditionally, before any early return.
  const settings = useBusinessSettings();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  if (!isOpen || !invoice) return null;

  const wahidPhone = settings["wahid_phone"] || "0300-1234567";
  const hayatPhone = settings["hayat_phone"] || "0300-7654321";
  const addressLine1 = settings["address_line1"] || "Showroom No. X,";

  const purchasePriceVal = parseFloat(invoice.purchasePrice || "0");
  const downPaymentVal = parseFloat(invoice.downPayment || "0");
  const remainingAmountVal = purchasePriceVal - downPaymentVal;

  // ---- single source of truth for every editable cell on the form ----
  const getEdited = (key: string, defaultVal: any = "") => {
    if (editedValues[key] !== undefined) return editedValues[key];
    return invoice[key] ?? defaultVal;
  };

  const handleChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  const documentProps = {
    invoice,
    settings,
    getEdited,
    handleChange,
    purchasePriceVal,
    downPaymentVal,
    remainingAmountVal,
    wahidPhone,
    hayatPhone,
    addressLine1,
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body * {
            visibility: hidden;
          }
          #print-content,
          #print-content * {
            visibility: visible;
            /* keep the original text colors (red/blue headings etc.) instead
               of forcing everything to black */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          #print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background-color: white !important;
          }
          #print-content input {
            border-bottom: 1px solid black !important;
          }
          .print-hide {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 print-hide">
        <div className="w-full max-w-4xl h-[90vh] bg-white overflow-hidden rounded-lg flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-300 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <Printer className="text-gray-500" size={20} />
              <h3 className="font-semibold text-gray-900">Purchase Invoice Print Preview</h3>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Printer size={16} /> Print Invoice
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X size={18} />
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10">
            <div className="shadow-xl rounded overflow-hidden ring-1 ring-gray-300 bg-white">
              <InvoiceDocument {...documentProps} />
            </div>
          </div>
        </div>
      </div>

      <div className="hidden print:block">
        <InvoiceDocument {...documentProps} />
      </div>
    </>
  );
};