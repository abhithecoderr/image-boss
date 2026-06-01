import React, { useState } from 'react';
import { SERVICE_ORDER } from '../../config/app';
import { SERVICES } from '../../config/services';

/* 
 ServiceCarousel:
 The interactive features slideshow carousel showcase (Mockup 2).
 Toggles between services using chevrons and top horizontal tabs.
*/
export default function ServiceCarousel() {
  const activeServices = SERVICE_ORDER.filter(id => !SERVICES[id].disabled);
  const [activeIndex, setActiveIndex] = useState(0);

  const activeServiceId = activeServices[activeIndex];
  const service = SERVICES[activeServiceId];

  // Carousel navigation strategies
  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? activeServices.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === activeServices.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="home-carousel-section">
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 8px 0' }}>
          Explore AI Capabilities
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>
          Switch between services to preview what you can achieve inside the workspace
        </p>
      </div>

      {/* 1. Horizontal Tabs Triggers */}
      <div className="carousel-tabs-container">
        {activeServices.map((id, index) => (
          <button
            key={id}
            className={`carousel-tab-btn ${index === activeIndex ? 'active' : ''}`}
            onClick={() => setActiveIndex(index)}
          >
            {SERVICES[id].icon} {SERVICES[id].name}
          </button>
        ))}
      </div>

      {/* 2. Viewport Slider Display */}
      <div className="carousel-viewport-wrapper">
        <button className="carousel-arrow-btn" onClick={handlePrev}>
          ◀
        </button>

        <div className="carousel-card-display">
          {/* Info Details Panel */}
          <div className="carousel-info-pane">
            <span className="carousel-service-name">
              {service.icon} {service.name}
            </span>
            <p className="carousel-service-desc">
              {service.description}
            </p>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#81c784', background: 'rgba(76, 175, 80, 0.15)', padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                ⚡ Browser-Side Execution
              </span>
            </div>
          </div>

          {/* Interactive Demo View Panel */}
          <div className="carousel-demo-pane">
            <span className="carousel-demo-image">
              {service.id === 'background-removal' && '🎭'}
              {service.id === 'upscaling' && '🔍'}
              {service.id === 'object-segmentation' && '🎯'}
              {service.id === 'magic-erase' && '🧽'}
              {service.id === 'blur' && '👤'}
              {service.id === 'captioning' && '📝'}
              {service.id === 'file-conversion' && '♻️'}
              {service.id === 'line-art' && '🎨'}
              {service.id === 'image-editor' && '📸'}
            </span>
            <span className="carousel-demo-label">Service Demo Preview</span>
          </div>
        </div>

        <button className="carousel-arrow-btn" onClick={handleNext}>
          ▶
        </button>
      </div>
    </div>
  );
}
