import { Routes, Route, Navigate } from "react-router-dom";
import MainAppLayout from "./components/layout/MainAppLayout";
import MarketingLayout from "./components/layout/MarketingLayout";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";

function App() {
  return (
    <div id="app">
      <Routes>
        {/* Marketing / "Big Website" Routes */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          {/* Add future paths like /features or /about here */}
        </Route>

        {/* Dashboard / "Pro App" Routes */}
        <Route path="/services/:serviceId?" element={<MainAppLayout />} />
        
        {/* Auth routes can be added here later without Layout wrappers if needed */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;

