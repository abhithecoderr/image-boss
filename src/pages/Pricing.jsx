import { Link } from 'react-router-dom';

const Pricing = () => {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out Image Boss',
      features: [
        '10 image processes per day',
        'Standard processing speed',
        'Watermarked outputs',
        'Basic support',
        'Access to all services'
      ],
      cta: 'Get Started',
      popular: false
    },
    {
      name: 'Pro',
      price: '$19',
      period: '/month',
      description: 'For power users and professionals',
      features: [
        'Unlimited image processing',
        'Priority processing speed',
        'No watermarks',
        'Priority email support',
        'Batch processing',
        'Advanced model access',
        'Export in multiple formats'
      ],
      cta: 'Start Pro Trial',
      popular: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For teams and businesses',
      features: [
        'Unlimited everything',
        'Dedicated server',
        'API access',
        'Custom model training',
        '24/7 phone support',
        'SLA guarantee',
        'Team management',
        'White-label options'
      ],
      cta: 'Contact Sales',
      popular: false
    }
  ];

  return (
    <div className="pricing-page">
      <header className="pricing-header">
        <Link to="/" className="back-link">← Back to Home</Link>
        <h1>Simple, Transparent Pricing</h1>
        <p>Choose the plan that fits your needs</p>
      </header>

      <section className="pricing-section">
        <div className="pricing-grid">
          {plans.map((plan, index) => (
            <div key={index} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
              {plan.popular && <div className="popular-badge">Most Popular</div>}
              <h3 className="plan-name">{plan.name}</h3>
              <div className="plan-price">
                <span className="price-amount">{plan.price}</span>
                {plan.period && <span className="price-period">{plan.period}</span>}
              </div>
              <p className="plan-description">{plan.description}</p>
              <ul className="plan-features">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="feature">
                    <span className="feature-icon">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/services" className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'} btn-large`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="faq-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-grid">
          <div className="faq-item">
            <h3>What image formats are supported?</h3>
            <p>We support PNG, JPEG, WebP, and most common image formats.</p>
          </div>
          <div className="faq-item">
            <h3>Is my data secure?</h3>
            <p>Yes, all processing happens in your browser. Your images never leave your device.</p>
          </div>
          <div className="faq-item">
            <h3>Can I cancel anytime?</h3>
            <p>Absolutely. You can cancel your subscription at any time with no penalties.</p>
          </div>
          <div className="faq-item">
            <h3>Do you offer refunds?</h3>
            <p>We offer a 7-day money-back guarantee for all paid plans.</p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Not sure which plan to choose?</h2>
        <p>Start with our free plan and upgrade when you're ready</p>
        <Link to="/services" className="btn btn-primary btn-large">
          Try for Free
        </Link>
      </section>
    </div>
  );
};

export default Pricing;
