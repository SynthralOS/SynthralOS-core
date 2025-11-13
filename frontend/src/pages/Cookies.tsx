export default function Cookies() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
            Cookie Policy
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">What Are Cookies</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our platform.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">How We Use Cookies</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Essential Cookies</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  These cookies are necessary for the website to function properly. They enable core functionality such as security, network management, and accessibility. You cannot opt out of these cookies.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Analytics Cookies</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our website and services.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Preference Cookies</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  These cookies allow our website to remember information that changes the way the website behaves or looks, such as your preferred language or region.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Managing Cookies</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              You can control and manage cookies in various ways. Please keep in mind that removing or blocking cookies can impact your user experience and parts of our website may no longer be fully accessible.
            </p>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Most browsers allow you to refuse or accept cookies, and to delete cookies that have already been set. You can usually find these settings in your browser's preferences or options menu.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Third-Party Cookies</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              In addition to our own cookies, we may also use various third-party cookies to report usage statistics and deliver advertisements. These third parties may use cookies to collect information about your online activities across different websites.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Contact Us</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              If you have any questions about our use of cookies, please contact us at:
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-4">
              Email: <a href="mailto:privacy@synthralos.ai" className="text-indigo-600 dark:text-indigo-400 hover:underline">privacy@synthralos.ai</a>
            </p>
          </section>
        </div>
      </div>
  );
}

