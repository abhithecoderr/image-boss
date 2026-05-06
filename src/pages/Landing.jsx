import { Link } from 'react-router-dom';
import { SERVICE_ORDER } from '../config/app';
import { SERVICES } from '../config/services';

const Landing = () => {
  const servicesToShow = SERVICE_ORDER.filter(id => !SERVICES[id].disabled);

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="brand-icon">🚀</span>
            <span className="brand-text">Image Boss</span>
          </h1>
          <p className="hero-subtitle">
            AI-Powered Image Suite - Transform your images with cutting-edge AI tools
          </p>
          <div className="hero-actions">
            <Link to="/services" className="btn btn-primary btn-large">
              Try Services
            </Link>
            <Link to="/pricing" className="btn btn-secondary btn-large">
              View Pricing
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-cards">
            {servicesToShow.slice(0, 3).map((id, index) => (
              <div key={id} className="hero-card" style={{ animationDelay: `${index * 0.1}s` }}>
                <span className="hero-card-icon">{SERVICES[id].icon}</span>
                <span className="hero-card-name">{SERVICES[id].name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Highlights */}
      <section className="services-section">
        <h2 className="section-title">Powerful AI Services</h2>
        <p className="section-subtitle">Everything you need to transform your images</p>
        <div className="services-grid">
          {servicesToShow.map((id) => (
            <Link key={id} to="/services" className="service-card">
              <div className="service-card-icon">{SERVICES[id].icon}</div>
              <h3 className="service-card-name">{SERVICES[id].name}</h3>
              <p className="service-card-desc">{SERVICES[id].description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2>Ready to Transform Your Images?</h2>
        <p>Start using our AI-powered tools today</p>
        <Link to="/services" className="btn btn-primary btn-large">
          Get Started Free
        </Link>
      </section>
    </div>
  );
};

export default Landing;
