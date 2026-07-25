"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { User, Clock } from "lucide-react";

interface Log extends DocumentData {
  id: string;
  action: string;
  timestamp: { seconds: number };
  type?: string;
  performedBy?: string; // Field storing the User UID
}

interface UserMap {
  [userId: string]: string; // Maps UID to Name
}

export default function LogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [userNames, setUserNames] = useState<UserMap>({});

  useEffect(() => {
    if (!user) return;

    // 1. Fetch Users to build a ID -> Name map
    // We listen to the users collection so names update in real-time
    const usersUnsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const map: UserMap = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Fallback to "Unknown" if name is missing
        map[doc.id] = data.name || "Unknown User";
      });
      setUserNames(map);
    });

    // 2. Fetch Logs
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    const logsUnsub = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log)));
    });

    // Cleanup listeners on unmount
    return () => {
      usersUnsub();
      logsUnsub();
    };
  }, [user]);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Logs" description="Audit trail of all system actions." />
      <Card className="p-0 overflow-hidden border-border shadow-sm">
        <div className="divide-y divide-slate-100">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-4 p-4 hover:bg-muted transition-colors">
              {/* Status Dot */}
              <div className={`mt-2 h-2 w-2 rounded-full shrink-0 ${
                  log.type === 'REGISTRY' ? 'bg-blue-500' :
                  log.type === 'STATUS_UPDATE' ? 'bg-orange-500' : 
                  log.type === 'ADMIN_ACTION' ? 'bg-red-500' : 'bg-slate-300'
                }`} 
              />
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{log.action}</p>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                  {/* Time */}
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-muted-foreground" />
                    {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'Just now'}
                  </span>

                  {/* User Name */}
                  {log.performedBy && (
                    <span className="flex items-center gap-1 font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
                        <User size={12} className="text-muted-foreground" />
                        {userNames[log.performedBy] || "System/Unknown"}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Log Type Badge */}
              {log.type && (
                  <span className="text-[10px] px-2 py-1 rounded border border-border bg-card text-muted-foreground uppercase tracking-wider font-medium">
                      {log.type}
                  </span>
              )}
            </div>
          ))}
          
          {logs.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">
                No activity recorded yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}