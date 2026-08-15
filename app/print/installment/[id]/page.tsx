"use client";
import { useState, useEffect, use } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrintInstallmentPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const docRef = doc(db, "installmentPlans", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPlan({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error fetching plan:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center">Loading report...</div>;
  }

  if (!plan) {
    return <div className="p-8 text-center text-red-500">Plan not found.</div>;
  }

  const downPayment = plan.advancePaid || plan.downPayment || 0;
  const totalAmount = plan.totalAmount || 0;
  const outstandingBalance = plan.outstandingBalance || 0;
  const vehicleName = plan.vehicleName || "Unknown Vehicle";
  const clientName = plan.clientName || "Unknown Client";
  const clientPhone = plan.clientPhone || "N/A";
  const clientEmail = plan.clientEmail || "N/A";

  const schedule = plan.installmentSchedule || [];
  
  // Sort schedule chronologically just in case
  const sortedSchedule = [...schedule].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none print:w-full print:max-w-none">
        
        {/* Screen-only header */}
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center print:hidden">
          <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
            <ArrowLeft size={16} /> Back
          </Button>
          <Button onClick={() => window.print()} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Printer size={16} /> Print PDF
          </Button>
        </div>

        {/* Print Content */}
        <div className="p-8 sm:p-12">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-200 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Zohaib Motors</h1>
              <p className="text-sm text-gray-500 mt-1">Vehicle Installment & Deal Summary</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">Date: {new Date().toLocaleDateString()}</p>
              <p className="text-sm text-gray-500">Plan ID: {plan.id.slice(-6).toUpperCase()}</p>
            </div>
          </div>

          {/* Client & Vehicle Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Customer Details</h3>
              <p className="font-semibold text-gray-900">{clientName}</p>
              <p className="text-sm text-gray-600">Phone: {clientPhone}</p>
              <p className="text-sm text-gray-600">Email: {clientEmail}</p>
            </div>
            <div className="space-y-1 text-right">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Vehicle Details</h3>
              <p className="font-semibold text-gray-900">{vehicleName}</p>
              <p className="text-sm text-gray-600">File ID: {plan.vehicleFileId || "N/A"}</p>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8 border border-gray-100 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Total Sale Price</p>
              <p className="text-xl font-bold text-gray-900 mt-1">Rs. {Number(totalAmount).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Down Payment</p>
              <p className="text-xl font-bold text-gray-900 mt-1">Rs. {Number(downPayment).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-600 uppercase">Outstanding Balance</p>
              <p className="text-xl font-bold text-indigo-600 mt-1">Rs. {Number(outstandingBalance).toLocaleString()}</p>
            </div>
          </div>

          {/* Schedule Table */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Schedule</h3>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="py-3 px-2 font-bold text-gray-900 uppercase">Due Date</th>
                  <th className="py-3 px-2 font-bold text-gray-900 uppercase text-right">Amount</th>
                  <th className="py-3 px-2 font-bold text-gray-900 uppercase text-center">Status</th>
                  <th className="py-3 px-2 font-bold text-gray-900 uppercase text-right">Remaining Bal.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedSchedule.map((inst, index) => {
                  const instAmount = Number(inst.amount) || 0;
                  
                  // For remaining balance, we can calculate based on total - downpayment - sum(previous installments)
                  // Or use the outstanding balance logic: 
                  // Let's calculate a projected remaining balance if all payments up to this one are paid.
                  // Total financed = Total amount - Down payment
                  const totalFinanced = totalAmount - downPayment;
                  
                  let previousPaymentsSum = 0;
                  for (let i = 0; i <= index; i++) {
                     previousPaymentsSum += Number(sortedSchedule[i].amount) || 0;
                  }
                  const projectedBalance = totalFinanced - previousPaymentsSum;

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="py-3 px-2 text-gray-900">{new Date(inst.dueDate).toLocaleDateString()}</td>
                      <td className="py-3 px-2 text-gray-900 text-right font-medium">Rs. {instAmount.toLocaleString()}</td>
                      <td className="py-3 px-2 text-center">
                        {inst.paid ? (
                          <span className="inline-block px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-full border border-emerald-200">Paid</span>
                        ) : new Date(inst.dueDate).getTime() < new Date().getTime() ? (
                          <span className="inline-block px-2 py-1 text-xs font-bold text-red-700 bg-red-100 rounded-full border border-red-200">Overdue</span>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs font-bold text-gray-600 bg-gray-100 rounded-full border border-gray-200">Upcoming</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right text-gray-500 font-medium">Rs. {Math.max(0, projectedBalance).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Note */}
          <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
            <p>This is a computer-generated document and does not require a physical signature.</p>
            <p className="mt-1">If you have any questions regarding your installment plan, please contact our support.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
