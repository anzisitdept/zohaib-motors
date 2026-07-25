"use client";
import { useState, useEffect, FormEvent } from "react";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, deleteDoc, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  models: string[];
}

export const BrandManager = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [newBrand, setNewBrand] = useState("");
  const [newModelInput, setNewModelInput] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const q = query(collection(db, "brands"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBrands(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Brand)));
    });
    return () => unsubscribe();
  }, []);

  const addBrand = async (e: FormEvent) => {
    e.preventDefault();
    if (!newBrand.trim()) return;
    await addDoc(collection(db, "brands"), { name: newBrand, models: [] });
    setNewBrand("");
  };

  const deleteBrand = async (id: string) => {
    if (confirm("Delete this brand?")) await deleteDoc(doc(db, "brands", id));
  };

  const addModel = async (brandId: string) => {
    const modelName = newModelInput[brandId];
    if (!modelName?.trim()) return;

    await updateDoc(doc(db, "brands", brandId), {
      models: arrayUnion(modelName)
    });
    setNewModelInput({ ...newModelInput, [brandId]: "" });
  };

  const removeModel = async (brandId: string, modelName: string) => {
    await updateDoc(doc(db, "brands", brandId), {
      models: arrayRemove(modelName)
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Add Brand Form */}
      <Card className="p-6 h-fit">
        <h3 className="text-lg font-semibold mb-4">Add Manufacturer</h3>
        <form onSubmit={addBrand} className="flex gap-2">
          <Input 
            placeholder="e.g. Toyota, Honda" 
            value={newBrand} 
            onChange={(e) => setNewBrand(e.target.value)} 
          />
          <Button type="submit">Add</Button>
        </form>
      </Card>

      {/* Brand List */}
      <div className="space-y-4">
        {brands.map((brand) => (
          <Card key={brand.id} className="p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg">{brand.name}</h3>
              <Button variant="ghost" size="sm" onClick={() => deleteBrand(brand.id)} className="text-red-500">
                <Trash2 size={16} />
              </Button>
            </div>

            {/* Model List */}
            <div className="flex flex-wrap gap-2 mb-4">
              {brand.models?.map((model) => (
                <div key={model} className="bg-muted px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  {model}
                  <button onClick={() => removeModel(brand.id, model)} className="text-muted-foreground hover:text-red-500">×</button>
                </div>
              ))}
              {(!brand.models || brand.models.length === 0) && <span className="text-xs text-muted-foreground italic">No models added</span>}
            </div>

            {/* Add Model Input */}
            <div className="flex gap-2">
              <Input 
                placeholder={`Add ${brand.name} model...`} 
                value={newModelInput[brand.id] || ""} 
                onChange={(e) => setNewModelInput({ ...newModelInput, [brand.id]: e.target.value })}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={() => addModel(brand.id)} className="h-8">
                <Plus size={14} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};