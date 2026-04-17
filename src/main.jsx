import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import App from "./App.jsx";
import CardPreview from "./pages/CardPreview/index.jsx";

function Root() {
  const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash : '');
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (hash === '#card-mocks') return <CardPreview />;
  return <App />;
}

createRoot(document.getElementById("root")).render(<Root />);
