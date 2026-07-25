"use client";
import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";

interface GenericItem {
  id: string;
  name: string;
  value?: string; // For things like Hex codes
}

interface GenericManagerProps {
  collectionName: string;
  title: string;
  hasValueField?: boolean; // If true, shows a second input (e.g., for Color Hex)
}

export const GenericManager = ({ collectionName, title, hasValueField }: GenericManagerProps) => {
  const [items, setItems] = useState<GenericItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GenericItem)));
    });
    return () => unsubscribe();
  }, [collectionName]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await addDoc(collection(db, collectionName), {
      name: newName,
      ...(hasValueField && { value: newValue }),
      createdAt: serverTimestamp()
    });
    setNewName("");
    setNewValue("");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this item?")) {
      await deleteDoc(doc(db, collectionName, id));
    }
  };

  return (
    <Card className="p-4 h-full flex flex-col">
      <h3 className="font-semibold text-foreground mb-4">{title}</h3>
      
      <div className="flex gap-2 mb-4">
        <Input 
          placeholder={`New ${title}...`} 
          value={newName} 
          onChange={(e) => setNewName(e.target.value)} 
        />
        {hasValueField && (
          <Input 
            type="color"
            className="w-12 p-1 h-9 cursor-pointer"
            value={newValue} 
            onChange={(e) => setNewValue(e.target.value)} 
          />
        )}
        <Button size="icon" onClick={handleAdd}><Plus size={18} /></Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded border border-border group">
            <div className="flex items-center gap-2">
              {hasValueField && (
                <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: item.value }} />
              )}
              <span className="text-sm font-medium">{item.name}</span>
            </div>
            <button onClick={() => handleDelete(item.id)} className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
};