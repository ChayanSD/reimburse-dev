import Features from "@/components/Features";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Pricing from "@/components/Pricing";
import Testimonial from "@/components/Testimonial";
import AmbassadorCallout from "@/components/AmbassadorCallout";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <AmbassadorCallout />
      <Testimonial />
      <Footer />
    </div>
  )
}
