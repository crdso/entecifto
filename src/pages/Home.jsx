import React from "react";
import Header from "@/components/entec/Header";
import Hero from "@/components/entec/Hero";
import ShirtSection from "@/components/entec/ShirtSection";
import Schedule from "@/components/entec/Schedule";
import EntecAoVivo from "@/components/entec/EntecAoVivo";
import LocationSection from "@/components/entec/LocationSection";
import Footer from "@/components/entec/Footer";

export default function Home() {
  return (
    <div className="relative min-h-screen text-data font-body overflow-x-hidden">
      <Header />
      <main>
        <Hero />
        <EntecAoVivo />
        <ShirtSection />
        <Schedule />
        <LocationSection />
      </main>
      <Footer />
    </div>
  );
}  