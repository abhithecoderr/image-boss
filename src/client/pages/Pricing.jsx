/*
 * Product pricing plans and feature comparisons.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store';

const Pricing = () => {
  const { isAuthenticated } = useAuth();
  const [expandedIdx, setExpandedIdx] = useState(null);

  const toggleFaq = (index) => {
    setExpandedIdx(expandedIdx === index ? null : index);
  };

  const faqs = [
    {
      q: 'What image formats are supported?',
      a: 'We support PNG, JPEG, WebP, and most common image formats.'
    },
    {
      q: 'Is my data secure?',
      a: 'Yes, all processing happens in your browser. Your images never leave your device.'
    },
    {
      q: 'Can I cancel anytime?',
      a: 'Absolutely. You can cancel your subscription at any time with no penalties.'
    },
    {
      q: 'Do you offer refunds?',
      a: 'We offer a 7-day money-back guarantee for all paid plans.'
    }
  ];

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
    <div className="pricing-page marketing-container section-padding animate-fade-in">
      <header className="pricing-header">
        <h1 className="pricing-title">Simple, Transparent Pricing</h1>
        <p className="pricing-subtitle">Choose the plan that fits your needs</p>
      </header>

      <section className="pricing-section">
        <div className="pricing-grid">
          {plans.map((plan, index) => (
            <div key={index} className={`pricing-card ${plan.popular ? 'is-popular' : ''}`}>
              {plan.popular && <div className="pricing-badge">Most Popular</div>}
              <h3 className="pricing-plan-name">{plan.name}</h3>
              <div className="pricing-price">
                {plan.price}
                {plan.period && <span className="pricing-period">{plan.period}</span>}
              </div>
              <p className="pricing-desc">{plan.description}</p>
              <ul className="pricing-features">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="pricing-feature">
                    {feature}
                  </li>
                ))}
              </ul>
              {isAuthenticated && plan.name === 'Free' ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-large"
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                >
                  Current Plan
                </button>
              ) : (
                <Link to="/services" className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'} btn-large`}>
                  {isAuthenticated && plan.name === 'Pro' ? 'Upgrade to Pro' : plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="faq-section mt-4 p-4" style={{ background: 'transparent' }}>
        <h2 className="pricing-title" style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 'var(--space-6)' }}>Frequently Asked Questions</h2>
        <div className="faq-accordion">
          {faqs.map((faq, index) => {
            const isExpanded = expandedIdx === index;
            return (
              <div key={index} className={`faq-accordion-item ${isExpanded ? 'is-expanded' : ''}`}>
                <div className="faq-accordion-header" onClick={() => toggleFaq(index)}>
                  <span>{faq.q}</span>
                  <span className="faq-accordion-icon">▼</span>
                </div>
                <div className="faq-accordion-content">
                  <p>{faq.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="cta-section section-padding" style={{ textAlign: 'center' }}>
        <h2 className="pricing-title" style={{ fontSize: '2rem' }}>Not sure which plan to choose?</h2>
        <p className="pricing-subtitle" style={{ marginBottom: 'var(--space-6)' }}>Start with our free plan and upgrade when you're ready</p>
        <Link to="/services" className="btn btn-primary btn-large">
          Try for Free
        </Link>
      </section>
    </div>
  );
};

export default Pricing;
