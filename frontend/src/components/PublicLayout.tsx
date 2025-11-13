import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useTheme } from '../contexts/ThemeContext';

// Temporarily disabled dot shader due to React Three Fiber compatibility issues
// const DotScreenShader = lazy(() => 
//   import('./ui/dot-shader-background').then(module => ({ default: module.DotScreenShader }))
//   .catch(() => ({ default: () => <div style={{ width: '100%', height: '100%' }} /> }))
// );

export default function PublicLayout() {
  const location = useLocation();
  const { user } = useUser();
  const isAuthenticated = !!user;
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const scrollToSection = (id: string) => {
    if (location.pathname === '/') {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.location.href = `/#${id}`;
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 overflow-hidden">
      {/* Dot Shader Background - Temporarily disabled */}
      {/* <div className="fixed inset-0 z-0 pointer-events-none">
        <Suspense fallback={<div style={{ width: '100%', height: '100%' }} />}>
          <DotScreenShader />
        </Suspense>
      </div> */}
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                SynthralOS
              </Link>
              <div className="hidden md:flex items-center space-x-6">
                <button onClick={() => scrollToSection('features')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  Features
                </button>
                <button onClick={() => scrollToSection('how-it-works')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  How It Works
                </button>
                <button onClick={() => scrollToSection('use-cases')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  Use Cases
                </button>
                <button onClick={() => scrollToSection('pricing')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  Pricing
                </button>
                <Link to="/docs" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  Docs
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Toggle theme"
              >
                {resolvedTheme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all"
                  >
                    Get Started
                  </Link>
                </>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="px-6 py-4 space-y-4">
              <button onClick={() => scrollToSection('features')} className="block w-full text-left text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                Features
              </button>
              <button onClick={() => scrollToSection('how-it-works')} className="block w-full text-left text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                How It Works
              </button>
              <button onClick={() => scrollToSection('use-cases')} className="block w-full text-left text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                Use Cases
              </button>
              <button onClick={() => scrollToSection('pricing')} className="block w-full text-left text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                Pricing
              </button>
              <Link to="/docs" className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
                Docs
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex-1 pt-20">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-transparent dark:bg-transparent border-t border-gray-300/50 dark:border-gray-700/50 py-12 px-6 mt-auto backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><button onClick={() => scrollToSection('features')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Features</button></li>
                <li><button onClick={() => scrollToSection('use-cases')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Use Cases</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Pricing</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><Link to="/support" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Support</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Contact</Link></li>
                <li><Link to="/security" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Security</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-gray-900 dark:text-gray-100 font-semibold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Terms of Service</Link></li>
                <li><Link to="/cookies" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-300/50 dark:border-gray-700/50 pt-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">© 2024 SynthralOS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

