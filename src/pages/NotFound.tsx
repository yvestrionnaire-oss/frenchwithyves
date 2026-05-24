import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="fw-card max-w-md p-10 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-3 text-3xl font-bold">Page introuvable</h1>
        <p className="mt-3 text-secondaryText">
          We couldn't find that page. It may have moved, or the link might be broken.
        </p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          <Home className="h-4 w-4" /> Back to home
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
