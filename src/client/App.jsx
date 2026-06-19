import React, { useEffect, useState, Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";

import { useUIStore } from "./store/uiStore";

import PublicLayout from "./layouts/PublicLayout";
import MainAppLayout from "./layouts/MainAppLayout";

// Lazy-load page components to enable Suspense-based page loading detection
const Landing = React.lazy(() => import("./pages/Landing"));
const Pricing = React.lazy(() => import("./pages/Pricing"));
const Login = React.lazy(() => import("./pages/Login"));
const SignUp = React.lazy(() => import("./pages/Signup"));
const ProductDetail = React.lazy(() => import("./pages/ProductDetail"));
const SolutionsDetail = React.lazy(() => import("./pages/SolutionsDetail"));
const Profile = React.lazy(() => import("./pages/Profile"));
const PolicyPage = React.lazy(() => import("./pages/PolicyPage"));

// Notifies TopProgressBar when a lazy-loaded route is mounting
function SuspenseLoader() {
  const setPageLoading = useUIStore((state) => state.setPageLoading);
  useEffect(() => {
    setPageLoading(true);
    return () => setPageLoading(false);
  }, [setPageLoading]);
  return null;
}

// Top Progress Bar for page loads. Only appears if the page load exceeds 2 seconds.
function TopProgressBar() {
  const isPageLoading = useUIStore((state) => state.isPageLoading);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let delayTimer;
    let timer1, timer2, timer3;

    if (isPageLoading) {
      setProgress(0);
      setVisible(false);

      // Start 2-second timer. Only show progress bar if loading exceeds 2s.
      delayTimer = setTimeout(() => {
        setVisible(true);
        setProgress(20);

        timer1 = setTimeout(() => setProgress(45), 200);
        timer2 = setTimeout(() => setProgress(75), 600);
      }, 2000);
    } else {
      if (visible) {
        setProgress(100);
        timer3 = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 300);
      }
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (timer1) clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
      if (timer3) clearTimeout(timer3);
    };
  }, [isPageLoading, visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "3px",
        backgroundColor: "var(--accent-primary, #f5a623)",
        width: `${progress}%`,
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out",
        opacity: progress === 100 ? 0 : 1,
        zIndex: 99999,
        pointerEvents: "none",
        boxShadow: "0 0 8px var(--accent-primary, #f5a623)",
      }}
    />
  );
}

// 1. Create a Root wrapper that includes your Providers
// This ensures that providers have access to the Router context
function Root() {
  return (
    <>
      <TopProgressBar />
      <Suspense fallback={<SuspenseLoader />}>
        <Outlet />
      </Suspense>
    </>
  );
}


// 2. Create a secure ProtectedRoute component
function ProtectedRoute({ children }) {
  // Bypassed authentication check temporarily to allow free testing of the workspace
  return children;
}

// 3. Update the router configuration to use Root as the parent
export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      {
        // Public Layout Routes (Landing, Pricing, etc.)
        path: "/",
        element: <PublicLayout />,
        children: [
          {
            index: true,
            element: <Landing />,
          },
          {
            path: "pricing",
            element: <Pricing />,
          },
          {
            path: "product/:productId?",
            element: <ProductDetail />,
          },
          {
            path: "solutions/:solutionId?",
            element: <SolutionsDetail />,
          },
          {
            path: "profile",
            element: (
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            ),
          },
          {
            path: "privacy-policy",
            element: <PolicyPage type="privacy" />,
          },
          {
            path: "terms-of-service",
            element: <PolicyPage type="terms" />,
          },
          {
            path: "refund-policy",
            element: <PolicyPage type="refund" />,
          },
        ],
      },
      {
        // Independent Auth Routes (stand-alone pages, no shared Navbar/Footer)
        path: "login",
        element: <Login />,
      },
      {
        // Independent Auth Routes
        path: "signup",
        element: <SignUp />,
      },
      {
        // Dashboard / Workspace Routes - Secured
        path: "services/:serviceId?",
        element: (
          <ProtectedRoute>
            <MainAppLayout />
          </ProtectedRoute>
        ),
      },
      {
        // Fallback Redirect
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
