import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import Panel from "./panel/Panel.jsx";

// Enrutado mínimo por hash: `#/panel` abre el panel de administración y
// cualquier otra cosa el chat. Evita traer un router para dos pantallas.
function Root() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);

    window.addEventListener("hashchange", onChange);

    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return hash.startsWith("#/panel") ? <Panel /> : <App />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
