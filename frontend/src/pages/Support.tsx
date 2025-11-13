import { Link } from 'react-router-dom';

export default function Support() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
            Support
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            We're here to help you succeed with SynthralOS
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Documentation</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Browse our comprehensive documentation to find answers to common questions and learn how to use SynthralOS effectively.
            </p>
            <Link
              to="/docs"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-semibold"
            >
              View Documentation
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Email Support</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Send us an email and we'll get back to you as soon as possible. We typically respond within 24 hours.
            </p>
            <a
              href="mailto:support@synthralos.ai"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-semibold"
            >
              Email Support
            </a>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-gray-900 dark:text-gray-100 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {
                question: 'How do I get started with SynthralOS?',
                answer: 'Getting started is easy! Sign up for a free account, and you can begin creating workflows immediately. Check out our documentation for step-by-step guides.',
              },
              {
                question: 'What integrations are available?',
                answer: 'We support 500+ integrations including popular services like Slack, GitHub, Google Workspace, AWS, and many more. You can also create custom integrations using our API.',
              },
              {
                question: 'Can I use custom code in my workflows?',
                answer: 'Yes! While SynthralOS is designed to be no-code, you can extend workflows with custom JavaScript or Python nodes when you need more control.',
              },
              {
                question: 'Is my data secure?',
                answer: 'Absolutely. We use industry-standard encryption, implement comprehensive security measures, and follow best practices to protect your data. See our Security page for more details.',
              },
              {
                question: 'What happens if I exceed my plan limits?',
                answer: 'We\'ll notify you before you reach your limits. You can upgrade your plan at any time to continue using the service without interruption.',
              },
            ].map((faq, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6"
              >
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">{faq.question}</h3>
                <p className="text-gray-600 dark:text-gray-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl p-8 border border-indigo-200/50 dark:border-indigo-800/50 text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Still Need Help?</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Can't find what you're looking for? Our support team is ready to assist you.
          </p>
          <Link
            to="/contact"
            className="inline-block px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all text-lg font-semibold"
          >
            Contact Support
          </Link>
        </div>
      </div>
  );
}

