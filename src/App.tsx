﻿import { Toaster } from "@/components/ui/toaster";
import 'leaflet/dist/leaflet.css';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";

// Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import NewFile from "@/pages/NewFile";
import Restudy from "@/pages/Restudy";
import Archive from "@/pages/Archive";
import Users from "@/pages/Users";
import Minutes from "@/pages/Minutes";
import Summons from "@/pages/Summons";
import LegalArchive from "@/pages/LegalArchive";
import Backup from "@/pages/Backup";
import RecycleBin from "@/pages/RecycleBin";
import UrbanMap from "@/pages/UrbanMap";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AdminProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Routes */}
                <Route
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/new-file" element={<NewFile />} />
                  <Route path="/restudy" element={<Restudy />} />
                  <Route path="/archive" element={<Archive />} />
                  <Route path="/minutes" element={<Minutes />} />
                  <Route path="/summons" element={<Summons />} />
                  <Route path="/legal-archive" element={<LegalArchive />} />
                  <Route
                    path="/users"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <Users />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/backup" element={<Backup />} />
                  <Route path="/urban-map" element={<UrbanMap />} />
                  <Route path="/recycle-bin" element={<RecycleBin />} />
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AdminProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
