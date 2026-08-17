"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface BusinessSetting {
  key: string;
  value: string;
}

export const useBusinessSettings = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = query(collection(db, "settings_business"), orderBy("key"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<string, string> = {};
      snapshot.docs.forEach((doc) => {
        const { key, value } = doc.data();
        data[key] = value;
      });
      setSettings(data);
    });
    return () => unsubscribe();
  }, []);

  return settings;
};