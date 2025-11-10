import Navigation from "@/components/Navigation";
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
      <Navigation />
      <main
        className="snap-x snap-mandatory overflow-x-auto overflow-y-hidden h-screen flex flex-row"
        style={{ boxSizing: 'border-box', scrollPaddingTop: 'var(--header-height)' }}
      >
        <Hero />
        <Features />
        <Benefits />
        <FAQ />
        <Contact />
      </main>
    </>
  );
}
