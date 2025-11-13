export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
            Terms of Service
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Agreement to Terms</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              By accessing or using SynthralOS, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this platform.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Use License</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              Permission is granted to temporarily use SynthralOS for personal or commercial purposes. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose without explicit permission</li>
              <li>Attempt to reverse engineer any software contained on the platform</li>
              <li>Remove any copyright or other proprietary notations from the materials</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">User Accounts</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
              <li>Provide accurate and complete information when creating an account</li>
              <li>Keep your account information up to date</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
              <li>Be responsible for all activities under your account</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Acceptable Use</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              You agree not to use SynthralOS to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others</li>
              <li>Transmit any harmful, offensive, or illegal content</li>
              <li>Interfere with or disrupt the platform or servers</li>
              <li>Attempt to gain unauthorized access to any part of the platform</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Service Availability</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              We strive to maintain high availability of our services, but we do not guarantee uninterrupted access. We reserve the right to modify, suspend, or discontinue any part of the service at any time with or without notice.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Limitation of Liability</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              In no event shall SynthralOS or its suppliers be liable for any damages arising out of the use or inability to use the platform, even if we have been notified of the possibility of such damage.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Changes to Terms</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new Terms of Service on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Contact Us</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-4">
              Email: <a href="mailto:legal@synthralos.ai" className="text-indigo-600 dark:text-indigo-400 hover:underline">legal@synthralos.ai</a>
            </p>
          </section>
        </div>
      </div>
  );
}

