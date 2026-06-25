import React, { useState } from 'react';
import { SERVICE_ORDER } from '../../config/app';
import { SERVICES } from '../../config/services';
import ServiceIcon from '../ui/ServiceIcon';

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

  const renderSimulation = (id) => {
    switch (id) {
      case 'background-removal':
        return (
          <div className="sim-bg-removal sim-container">
            <div className="sim-checkerboard" />
            <div className="sim-subject-back" />
            <div className="sim-slide-overlay" />
            <div className="sim-subject" />
          </div>
        );
      case 'upscaling':
        return (
          <div className="sim-upscale sim-container">
            <div className="sim-upscale-blurred">Image Boss</div>
            <div className="sim-upscale-hd">
              <div className="sim-upscale-hd-content">Image Boss</div>
            </div>
          </div>
        );
      case 'object-segmentation':
        return (
          <div className="sim-segment sim-container">
            <div className="sim-seg-box b1" />
            <div className="sim-seg-box b2 active" />
            <div className="sim-seg-dot" />
          </div>
        );
      case 'magic-erase':
        return (
          <div className="sim-erase sim-container">
            <div className="sim-erase-target" />
            <div className="sim-erase-brush" />
          </div>
        );
      case 'blur':
        return (
          <div className="sim-face-blur sim-container">
            <div className="sim-card">
              <div className="sim-avatar">
                <div className="sim-avatar-blur" />
                <div className="sim-detect-box" />
              </div>
              <div className="sim-line" />
              <div className="sim-line" style={{ width: '25px' }} />
            </div>
          </div>
        );
      case 'captioning':
        return (
          <div className="sim-caption sim-container">
            <div className="sim-cap-img">🏞️</div>
            <div className="sim-cap-box">
              <span>[ "Sunset view", "Mountain path" ]</span>
              <span className="sim-cap-cursor" />
            </div>
          </div>
        );
      case 'file-conversion':
        return (
          <div className="sim-convert sim-container">
            <span className="sim-badge png">PNG</span>
            <span className="sim-arrow">➜</span>
            <span className="sim-badge webp">WEBP</span>
          </div>
        );
      case 'line-art':
        return (
          <div className="sim-lineart sim-container">
            <div className="sim-lineart-source" />
            <div className="sim-lineart-art" />
          </div>
        );
      case 'image-editor':
        return (
          <div className="sim-editor sim-container">
            <div className="sim-edit-grid">
              <div className="sim-crop-box" />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="home-carousel-section">
      <div className="carousel-header">
        <h2 className="carousel-heading">
          Explore AI Capabilities
        </h2>
        <p className="carousel-subtitle">
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
            <ServiceIcon id={id} style={{ width: '16px', height: '16px' }} /> {SERVICES[id].name}
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
              <ServiceIcon id={service.id} style={{ width: '20px', height: '20px' }} /> {service.name}
            </span>
            <p className="carousel-service-desc">
              {service.description}
            </p>
            <div className="carousel-badge-wrap">
              <span className="carousel-exec-badge">
                ⚡ Browser-Side Execution
              </span>
            </div>
          </div>

          {/* Interactive Demo View Panel */}
          <div className="carousel-demo-pane">
            {renderSimulation(service.id)}
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
