export default function Security() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
            Security
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Your data security is our top priority. Learn about the measures we take to protect your information.
          </p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Data Encryption</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              All data transmitted between your browser and our servers is encrypted using industry-standard TLS (Transport Layer Security) encryption. This ensures that your data remains secure during transmission.
            </p>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Sensitive data stored in our databases is encrypted at rest using AES-256 encryption, providing an additional layer of protection.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Authentication & Access Control</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Multi-Factor Authentication</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  We support multi-factor authentication (MFA) to add an extra layer of security to your account. We strongly recommend enabling MFA for all accounts.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Role-Based Access Control</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Our platform includes comprehensive RBAC features, allowing you to control who has access to what resources within your organization.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Single Sign-On (SSO)</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Enterprise customers can integrate SSO with their identity providers for centralized authentication and access management.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Infrastructure Security</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Secure Hosting</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Our infrastructure is hosted on secure, enterprise-grade cloud platforms with regular security audits and compliance certifications.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Regular Security Audits</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  We conduct regular security audits and penetration testing to identify and address potential vulnerabilities.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Monitoring & Incident Response</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  We have 24/7 monitoring in place to detect and respond to security incidents quickly. Our incident response team is ready to address any security concerns.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Data Privacy</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              We are committed to protecting your privacy. We do not sell your data to third parties, and we only share data as necessary to provide our services or as required by law.
            </p>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              For more information about how we handle your data, please see our <a href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">Privacy Policy</a>.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Reporting Security Issues</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              If you discover a security vulnerability, we appreciate your help in disclosing it to us responsibly. Please email us at:
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              <a href="mailto:security@synthralos.ai" className="text-indigo-600 dark:text-indigo-400 hover:underline">security@synthralos.ai</a>
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-4">
              We will respond to security reports promptly and work with you to address any issues.
            </p>
          </section>
        </div>
      </div>
  );
}

