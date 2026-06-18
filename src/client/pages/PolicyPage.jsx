import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { POLICIES } from "../config/policies";
import "../styles/04-pages/policy-page.css";

const PolicyPage = ({ type }) => {
  const policy = POLICIES[type];

  if (!policy) {
    return (
      <div className="policy-container">
        <h1>Policy Not Found</h1>
        <div className="back-to-home">
          <Link to="/">← Back to Home</Link>
        </div>
      </div>
    );
  }

  // Determine which other policy pages to link to in the footer
  const otherPolicies = Object.keys(POLICIES)
    .filter((key) => key !== type)
    .map((key) => ({
      key,
      title: POLICIES[key].title,
      path: key === "privacy" ? "/privacy-policy" : key === "terms" ? "/terms-of-service" : "/refund-policy",
    }));

  return (
    <>
      <Helmet>
        <title>{policy.title} - Image Boss</title>
        <meta name="description" content={policy.description} />
      </Helmet>

      <div className="policy-container">
        <div className="policy-header">
          <h1>{policy.title}</h1>
          <p className="last-updated">Last Updated: {policy.lastUpdated}</p>
        </div>

        <div className="policy-content">
          {policy.sections.map((section, idx) => (
            <div key={idx} className="policy-section">
              {section.title && <h2>{section.title}</h2>}

              {/* Render highlight boxes if present */}
              {section.highlightBox && (
                <div className="highlight-box">
                  <h3>{section.highlightBox.title}</h3>
                  <p>{section.highlightBox.text}</p>
                </div>
              )}

              {/* Render standard paragraphs */}
              {section.paragraphs?.map((p, pIdx) => (
                <p key={pIdx}>{p}</p>
              ))}

              {/* Render lists if present */}
              {section.list && (
                <ul>
                  {section.list.map((item, itemIdx) => (
                    <li key={itemIdx}>{item}</li>
                  ))}
                </ul>
              )}

              {/* Render subsections if present */}
              {section.subsections?.map((sub, subIdx) => (
                <div key={subIdx} className="subsection">
                  {sub.title && <h3>{sub.title}</h3>}
                  {sub.paragraphs?.map((p, pIdx) => (
                    <p key={pIdx}>{p}</p>
                  ))}
                  {sub.list && (
                    <ul>
                      {sub.list.map((item, itemIdx) => (
                        <li key={itemIdx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}

              {/* Render contact card if present */}
              {section.contactCard && (
                <div className="contact-info">
                  <p>
                    <strong>Email:</strong>{" "}
                    <a href={`mailto:${section.contactCard.email}`} style={{ color: "var(--accent-primary)" }}>
                      {section.contactCard.email}
                    </a>
                  </p>
                  {section.contactCard.address && (
                    <div className="contact-address">
                      {section.contactCard.address.map((line, lIdx) => (
                        <React.Fragment key={lIdx}>
                          {line}
                          {lIdx < section.contactCard.address.length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="policy-footer">
            <p>
              This {policy.title} is part of our commitment to transparency and user trust. For more information, see our other legal policies:
            </p>
            
            <div className="policy-links">
              {otherPolicies.map((op) => (
                <Link key={op.key} to={op.path} className="policy-link">
                  {op.title}
                </Link>
              ))}
            </div>

            <div className="back-to-home">
              <Link to="/">← Back to Home</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PolicyPage;
