import Hero from "@/components/Hero";
import Features from "../components/Features";
import Benefits from "../components/Benefits";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import HorizontalScroll from "@/components/HorizontalScroll";

export default function Home() {
  return (
    <>
      <HorizontalScroll />
      <main className="snap-x snap-mandatory overflow-x-scroll h-screen flex flex-row">
        <Hero />
        <Features />
        <Benefits />
        <FAQ />
        <Contact />
      </main>
    </>
  );
}
