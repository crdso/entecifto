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
import Admin from './pages/Admin';
import Privacidade from './pages/Privacidade';
import VisitTracker from './components/VisitTracker';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <VisitTracker />
        <AnimatedBackground />
        <PaymentReturn />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App