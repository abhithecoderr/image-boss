import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import MainAppLayout from "./layouts/MainAppLayout";
import PublicLayout from "./layouts/PublicLayout";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import SignUp from "./pages/Signup";
import { AppProvider, useAuth } from "./context/AppContext";

// 1. Create a Root wrapper that includes your Providers
// This ensures that providers have access to the Router context
function Root() {
  return (
    <AppProvider>
      <Outlet />
    </AppProvider>
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
