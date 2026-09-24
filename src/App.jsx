import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import AnimatedBackground from '@/components/entec/AnimatedBackground';
import PaymentReturn from '@/components/entec/PaymentReturn';
import Home from './pages/Home';
import Sobre from './pages/Sobre';
import Privacidade from './pages/Privacidade';
import Inscricao from './pages/Inscricao';
import VisitTracker from './components/VisitTracker';
import RouteMeta from './components/RouteMeta';

const Admin = lazy(() => import("./pages/Admin"));
const Resultados = lazy(() => import("./pages/Resultados"));

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <RouteMeta />
        <VisitTracker />
        <AnimatedBackground />
        <PaymentReturn />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/inscricao" element={<Inscricao />} />
          <Route path="/admin" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-void text-data text-sm">Carregando...</div>}><Admin /></Suspense>} />
          <Route path="/resultados" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-void text-data text-sm">Carregando...</div>}><Resultados /></Suspense>} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App