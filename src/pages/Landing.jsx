import React from 'react';
import HomeSandbox from '../components/home/HomeSandbox';
import ServiceCarousel from '../components/home/ServiceCarousel';
import ValuePropSection from '../components/home/ValuePropSection';

/* 
 Landing Page:
 The central entry page for Image Boss.
 Renders the interactive sandbox playground, tool showreel, and core value props.
*/
const Landing = () => {
  return (
    <div className="landing-page marketing-container">
      {/* 1. Hero & Branding Title */}
      <section className="landing-hero animate-fade-in" style={{ paddingBottom: '0' }}>
        <div className="landing-hero-content" style={{ margin: '0 auto', textAlign: 'center', maxWidth: '750px' }}>
          <h1 className="landing-hero-title" style={{ justifyContent: 'center' }}>
            <span className="brand-icon">🚀</span>
            <span className="brand-text">Image Boss</span>
          </h1>
          <p className="landing-hero-subtitle" style={{ fontSize: '1.4rem' }}>
            All image tools you need in one place.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '-12px', marginBottom: 'var(--space-6)' }}>
            Transform your photos directly in your browser using state-of-the-art web-local AI models.
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
