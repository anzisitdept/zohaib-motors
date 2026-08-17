"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  User,
  UserCredential
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Fix for: Property '__initial_auth_token' does not exist on type 'Window'
declare global {
  interface Window {
    __initial_auth_token?: string;
  }
}

// Define the shape of the user data stored in Firestore
interface UserData {
  role: 'admin' | 'manager' | string;
  roleId?: string;
  permissions?: string[];
  name?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null; // Added userData to context
  loading: boolean;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check for custom token if provided by server context
    if (typeof window !== 'undefined' && window.__initial_auth_token) {
      signInWithCustomToken(auth, window.__initial_auth_token).catch(console.error);
    }

    let userDataUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // Clean up previous user data listener
      if (userDataUnsubscribe) {
        userDataUnsubscribe();
        userDataUnsubscribe = null;
      }

      if (u) {
        // Set up real-time listener for user data (including signature updates)
        const docRef = doc(db, "users", u.uid);
        userDataUnsubscribe = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserData;
            let permissions: string[] = [];

            // 1. If user has a roleId, fetch dynamic permissions
            if (data.roleId) {
              try {
                const roleRef = doc(db, "roles", data.roleId);
                const roleSnap = await getDoc(roleRef);
                if (roleSnap.exists()) {
                  permissions = roleSnap.data().permissions || [];
                }
              } catch (err) {
                console.error("Error fetching permissions for role:", data.roleId, err);
              }
            }
            // 2. Fallback/Legacy Logic
            else if (data.role === 'admin') {
              permissions = ['ALL']; // admin gets everything
            } else if (data.role === 'manager') {
              // Default manager permissions if no roleId attached
              permissions = ['dashboard', 'inventory', 'status', 'logs'];
            }

            setUserData({ ...data, permissions });
          } else {
            // Handle case where auth exists but no db record (fallback)
            console.warn("No user document found in Firestore for this UID");
            setUserData({ role: 'manager', permissions: [] });
          }
        }, (error) => {
          console.error("Error listening to user data:", error);
          setUserData(null);
        });
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      if (userDataUnsubscribe) {
        userDataUnsubscribe();
      }
    };
  }, []);

  // Auto logout on inactivity (15 minutes)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (user) {
        timeoutId = setTimeout(() => {
          signOut(auth).catch(console.error);
        }, 15 * 60 * 1000); // 15 minutes
      }
    };

    const handleActivity = () => {
      resetTimer();
    };

    const events = [
      'mousemove', 'keydown', 'wheel', 'mousedown', 'touchstart', 'touchmove'
    ];

    if (user) {
      resetTimer();
      events.forEach((event) => {
        window.addEventListener(event, handleActivity);
      });
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user]);

  const login = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, userData, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};