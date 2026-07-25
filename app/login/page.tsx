"use client";
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock, Mail, Shield, Loader2 } from "lucide-react";
import { TENANT_CONFIG } from "@/config/tenant";

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    
    try {
      await login(email, password);
    } catch (err: any) {
      console.error(err);
      setError("Login failed. Please check your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-slate-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <Card className="w-full max-w-md p-6 shadow-xl border-slate-200/80 bg-white/95 backdrop-blur-sm relative z-10">
        {/* Header Section - Compact */}
        <div className="text-center mb-1">
          <div className="flex justify-center mb-1">
            <div className="relative">
              {TENANT_CONFIG.logoPath ? (
                <img 
                  src={TENANT_CONFIG.logoPath} 
                  alt={`${TENANT_CONFIG.name} Logo`} 
                  className="h-40 w-auto transition-transform duration-300" 
                />
              ) : (
                <div className="h-40 flex flex-col items-center justify-center p-4">
                  <h1 className="text-4xl font-black bg-gradient-to-r from-[#E5484D] to-[#8a1c20] bg-clip-text text-transparent tracking-tighter leading-none uppercase drop-shadow-sm mb-2">
                    {TENANT_CONFIG.logoText}
                  </h1>
                  <div className="h-1.5 w-16 bg-[#1C1F26] rounded-full opacity-80"></div>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Staff Portal
              </h1>
            </div>
            <p className="text-slate-500 text-xs font-medium">
              Secure Dashboard Access
            </p>
          </div>
        </div>

        {/* Login Form - Compact */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in duration-300">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
              {error}
            </div>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              Email Address
            </label>
            <div className="relative">
              <Input 
                type="email" 
                placeholder={TENANT_CONFIG.emailPlaceholder} 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9 h-10 text-sm transition-all duration-200 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                disabled={isSubmitting}
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              Password
            </label>
            <div className="relative">
              <Input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-9 pr-9 h-10 text-sm transition-all duration-200 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                disabled={isSubmitting}
                placeholder="Enter your password"
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full h-10 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md shadow-blue-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                Signing In...
              </>
            ) : (
              "Sign In to Dashboard"
            )}
          </Button>
        </form>

        {/* Footer - Compact */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <div className="text-center">
            <p className="text-xs text-slate-500">
              🔒 Secure staff authentication
            </p>
          </div>
        </div>
      </Card>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}