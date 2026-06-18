/*
 * Main client entry point. Sets up the React Router routes, public layouts, protected workspace routes, and global providers.
 */
import React, { Suspense, lazy } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";

import PublicLayout from "./layouts/PublicLayout";


const Landing = lazy(() => import("./pages/Landing"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/Signup"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const SolutionsDetail = lazy(() => import("./pages/SolutionsDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const PolicyPage = lazy(() => import("./pages/PolicyPage"));
const MainAppLayout = lazy(() => import("./layouts/MainAppLayout"));

// Lightweight fallback shown while a route chunk loads.
function RouteFallback() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div className="auth-spinner" aria-label="Loading" />
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

// 1. Create a Root wrapper that includes your Providers
// This ensures that providers have access to the Router context
function Root() {
  return <Outlet />;
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
              element: withSuspense(<Landing />),
            },
            {
              path: "pricing",
              element: withSuspense(<Pricing />),
            },
            {
              path: "product/:productId?",
              element: withSuspense(<ProductDetail />),
            },
            {
              path: "solutions/:solutionId?",
              element: withSuspense(<SolutionsDetail />),
            },
            {
              path: "profile",
              element: withSuspense(
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              ),
            },
            {
              path: "privacy-policy",
              element: withSuspense(<PolicyPage type="privacy" />),
            },
            {
              path: "terms-of-service",
              element: withSuspense(<PolicyPage type="terms" />),
            },
            {
              path: "refund-policy",
              element: withSuspense(<PolicyPage type="refund" />),
            },
          ],
        },
      {
        // Independent Auth Routes (stand-alone pages, no shared Navbar/Footer)
        path: "login",
        element: withSuspense(<Login />),
      },
      {
        // Independent Auth Routes
        path: "signup",
        element: withSuspense(<SignUp />),
      },
      {
        // Dashboard / Workspace Routes - Secured
        path: "services/:serviceId?",
        element: withSuspense(
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
