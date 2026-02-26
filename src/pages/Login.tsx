﻿import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signInAsViewer } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: error.message === "Invalid login credentials" 
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "مرحباً بك",
        description: "تم تسجيل الدخول بنجاح",
      });
      navigate("/");
    }

    setIsLoading(false);
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (guestPassword !== "OPVM2026") {
      toast({
        title: "خطأ",
        description: "كلمة المرور غير صحيحة",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signInAsViewer();
    
    if (error) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "مرحباً بك",
        description: "تم الدخول كمشاهد",
      });
      navigate("/");
    }

    setIsLoading(false);
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url('/images/login-bg.webp')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Banner Header Image - Top Center */}
      <div className="relative z-10 mb-6">
        <img 
          src="/images/opvm-banner.webp" 
          alt="OPVM Banner" 
          className="max-w-[750px] w-full h-auto object-contain rounded-lg shadow-lg"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* Glassmorphism Card */}
      <Card className="w-full max-w-md relative z-10 backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex flex-col items-center">
            <img
              src="/Capture.PNG"
              alt="شعار ديوان حماية وادي ميزاب وترقيته - Bureau Logo"
              className="w-72 max-w-md h-auto object-contain mb-6 rounded-lg shadow-2xl border-2 border-white/20"
              loading="eager"
              decoding="async"
              quality="95"
              style={{ 
                imageRendering: 'crisp-edges',
                WebkitFontSmoothing: 'antialiased',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div>
              <CardTitle className="text-2xl font-bold text-white">ديوان حماية وادي ميزاب وترقيته</CardTitle>
              <CardDescription className="mt-2 text-white/80">نظام إدارة ملفات التعمير</CardDescription>
              <p className="text-sm text-white/60 mt-1">المرسوم التنفيذي 15-19</p>
            </div>
          </div>
        </CardHeader>

        <Tabs defaultValue="user" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mx-auto max-w-[90%] bg-white/10">
            <TabsTrigger value="user" className="text-white data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#2D2926]">
              تسجيل دخول
            </TabsTrigger>
            <TabsTrigger value="guest" className="text-white data-[state=active]:bg-[#D4AF37] data-[state=active]:text-[#2D2926]">
              مشاهد
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user">
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="أدخل بريدك الإلكتروني"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      required
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">كلمة المرور</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="أدخل كلمة المرور"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      required
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button 
                  type="submit" 
                  className="w-full font-semibold"
                  style={{ backgroundColor: '#D4AF37', color: '#2D2926' }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري تسجيل الدخول...
                    </>
                  ) : (
                    "تسجيل الدخول"
                  )}
                </Button>
                <p className="text-sm text-white/70 text-center">
                  ليس لديك حساب؟{" "}
                  <Link to="/register" className="font-medium hover:underline" style={{ color: '#D4AF37' }}>
                    إنشاء حساب جديد
                  </Link>
                </p>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="guest">
            <form onSubmit={handleGuestLogin}>
              <CardContent className="space-y-4 pt-4">
                <div className="p-3 rounded-lg bg-white/10 border border-white/20">
                  <p className="text-sm text-white/80 text-center">
                    وضع المشاهدة يتيح لك البحث والاطلاع على الملفات فقط
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestPassword" className="text-white">كلمة المرور العامة</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <Input
                      id="guestPassword"
                      type="password"
                      placeholder="أدخل كلمة المرور العامة"
                      value={guestPassword}
                      onChange={(e) => setGuestPassword(e.target.value)}
                      className="pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      required
                      dir="ltr"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="w-full font-semibold"
                  style={{ backgroundColor: '#2D2926', color: '#D4AF37', border: '1px solid #D4AF37' }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الدخول...
                    </>
                  ) : (
                    "دخول كمشاهد"
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
