import { Link } from 'react-router-dom';
import { SERVICE_ORDER } from '../config/app';
import { SERVICES } from '../config/services';

const Landing = () => {
  const servicesToShow = SERVICE_ORDER.filter(id => !SERVICES[id].disabled);

  return (
    <div className="landing-page marketing-container">
      {/* Hero Section */}
      <section className="landing-hero animate-fade-in">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            <span className="brand-icon">🚀</span>
            <span className="brand-text">Image Boss</span>
          </h1>
          <p className="landing-hero-subtitle">
            AI-Powered Image Suite - Transform your images with cutting-edge AI tools
          </p>
          <div className="landing-hero-actions">
            <Link to="/services" className="btn btn-primary btn-large">
              Try Services
            </Link>
            <Link to="/pricing" className="btn btn-secondary btn-large">
              View Pricing
            </Link>
          </div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-hero-cards">
            {servicesToShow.slice(0, 3).map((id, index) => (
              <div key={id} className="landing-hero-card" style={{ animationDelay: `${index * 0.1}s` }}>
                <span className="landing-hero-card-icon">{SERVICES[id].icon}</span>
                <span className="landing-hero-card-name">{SERVICES[id].name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Highlights */}
      <section className="landing-services-section">
        <h2 className="landing-section-title">Powerful AI Services</h2>
        <p className="landing-section-subtitle">Everything you need to transform your images</p>
        <div className="landing-services-grid">
          {servicesToShow.map((id) => (
            <Link key={id} to="/services" className="landing-service-card">
              <div className="landing-service-icon">{SERVICES[id].icon}</div>
              <h3 className="landing-service-name">{SERVICES[id].name}</h3>
              <p className="landing-service-desc">{SERVICES[id].description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta-section">
        <h2 className="landing-cta-title">Ready to Transform Your Images?</h2>
        <p className="landing-cta-subtitle">Start using our AI-powered tools today</p>
        <Link to="/services" className="btn btn-primary btn-large">
          Get Started Free
        </Link>
      </section>
    </div>
  );
};

export default Landing;
