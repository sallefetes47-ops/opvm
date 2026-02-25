import { useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { Lock, X, ShieldCheck, Eye, EyeOff } from "lucide-react";

interface AdminLoginModalProps {
    open: boolean;
    onClose: () => void;
}

export function AdminLoginModal({ open, onClose }: AdminLoginModalProps) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const { loginAdmin } = useAdmin();

    if (!open) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const success = loginAdmin(password);
        if (success) {
            setPassword("");
            setError("");
            onClose();
        } else {
            setError("كلمة المرور غير صحيحة");
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
        }
    };

    const handleClose = () => {
        setPassword("");
        setError("");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div
                className={`relative w-full max-w-sm mx-4 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1a1a2e] to-[#16213e] p-8 shadow-2xl transition-transform ${isShaking ? "animate-shake" : ""
                    }`}
                style={{
                    animation: isShaking
                        ? "shake 0.5s cubic-bezier(.36,.07,.19,.97) both"
                        : undefined,
                }}
            >
                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute left-4 top-4 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>

                {/* Icon & Title */}
                <div className="mb-6 flex flex-col items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#b8952e] shadow-lg shadow-[#D4AF37]/20">
                        <ShieldCheck className="h-8 w-8 text-[#1a1a2e]" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-white">وضع المسؤول</h2>
                        <p className="mt-1 text-sm text-white/50">أدخل كلمة المرور للوصول</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError("");
                            }}
                            placeholder="كلمة المرور"
                            className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pr-10 pl-10 text-right text-white placeholder:text-white/30 outline-none transition focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/30"
                            dir="ltr"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                    </div>

                    {error && (
                        <p className="text-center text-sm font-medium text-red-400">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="w-full rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#c9a230] py-3 text-sm font-bold text-[#1a1a2e] shadow-lg shadow-[#D4AF37]/20 transition hover:shadow-[#D4AF37]/40 active:scale-[0.98]"
                    >
                        تسجيل الدخول
                    </button>
                </form>
            </div>

            {/* Shake animation style */}
            <style>{`
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
        </div>
    );
}
