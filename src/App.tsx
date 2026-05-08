import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Favorites from "./pages/Favorites.tsx";
import Auth from "./pages/Auth.tsx";
import Friends from "./pages/Friends.tsx";
import Profile from "./pages/Profile.tsx";
import NotFound from "./pages/NotFound.tsx";
import { RequireAuth } from "./components/RequireAuth.tsx";
import News from "./pages/News.tsx";
import VenueAuth from "./pages/venue/VenueAuth.tsx";
import VenueDashboard from "./pages/venue/VenueDashboard.tsx";
import SendBlast from "./pages/venue/SendBlast.tsx";
import AdminClaims from "./pages/admin/AdminClaims.tsx";
import { LocationPingTracker } from "./components/LocationPingTracker.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LocationPingTracker />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<RequireAuth><Index /></RequireAuth>} />
          <Route path="/favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
          <Route path="/friends" element={<RequireAuth><Friends /></RequireAuth>} />
          <Route path="/friends/add" element={<RequireAuth><Friends /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/u/:handle" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/news" element={<RequireAuth><News /></RequireAuth>} />
          <Route path="/venue/auth" element={<VenueAuth />} />
          <Route path="/venue" element={<RequireAuth><VenueDashboard /></RequireAuth>} />
          <Route path="/venue/send" element={<RequireAuth><SendBlast /></RequireAuth>} />
          <Route path="/admin/venue-claims" element={<RequireAuth><AdminClaims /></RequireAuth>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
