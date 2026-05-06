import { Routes, Route, Navigate } from "react-router-dom";
import MainAppLayout from "./components/layout/MainAppLayout";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";

function App() {
  return (
    <div id="app">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/services/:serviceId?" element={<MainAppLayout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;

