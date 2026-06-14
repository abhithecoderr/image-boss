/*
 * The central entry page for Image Boss. Renders the interactive sandbox playground, tool showreel, and core value props.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store';
import HomeSandbox from '../components/home/HomeSandbox';
import ServiceCarousel from '../components/home/ServiceCarousel';
import ValuePropSection from '../components/home/ValuePropSection';

const Landing = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/services" replace />;
  }

  return (
    <div className="landing-page marketing-container">
      {/* 1. Hero & Branding Title */}
      <section className="landing-hero landing-hero--compact animate-fade-in">
        <div className="landing-hero-content">
          <div className="landing-hero-badge-wrap">
            <span className="landing-hero-badge">
              ⚡ 100% Free & Browser-Local AI
            </span>
          </div>
          <h1 className="landing-hero-heading">
            All image tools you need in one place.
          </h1>
          <p className="landing-hero-tagline">
            Transform your photos directly in your browser using state-of-the-art web-local AI models. Secure, private, and lightning fast.
          </p>
        </div>
      </section>

      {/* 2. Interactive Processing Sandbox */}
      <HomeSandbox />

      {/* 3. Service Capabilities Showcase */}
      <ServiceCarousel />

      {/* 4. Product Value Propositions Grid */}
      <ValuePropSection />
    </div>
  );
};

export default Landing;
