import React from "react";
import Header from "@/components/entec/Header";
import Hero from "@/components/entec/Hero";
import ShirtSection from "@/components/entec/ShirtSection";
import Countdown from "@/components/entec/Countdown";
import Schedule from "@/components/entec/Schedule";
import Footer from "@/components/entec/Footer";

export default function Home() {
  return (
    <div className="relative min-h-screen text-data font-body overflow-x-hidden">
      <Header />
      <main>
        <Hero />
        <Countdown />
        <ShirtSection />
        <Schedule />
      </main>
      <Footer />
    </div>
  );
}  