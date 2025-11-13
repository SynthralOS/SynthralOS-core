export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
            About SynthralOS
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Building the future of automation, one workflow at a time
          </p>
        </div>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Our Mission</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              At SynthralOS, we believe that automation should be accessible to everyone. Our mission is to democratize workflow automation by providing a platform that combines the power of visual programming with native AI capabilities, making it possible for anyone—from developers to business users—to build sophisticated automations without writing code.
            </p>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              We're building the next generation of automation tools that don't just connect apps, but understand context, make intelligent decisions, and adapt to your needs.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">What Makes Us Different</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">AI-First Architecture</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Unlike other automation platforms that treat AI as an add-on, we've built AI capabilities into the core of our platform. Every workflow can leverage intelligent agents, LLMs, and RAG pipelines natively.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">Enterprise-Ready from Day One</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Built with scale in mind. Multi-tenant architecture, comprehensive RBAC, SSO support, and audit logging are not afterthoughts—they're foundational features.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">Developer-Friendly</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Start with no-code, extend with code when needed. Our platform supports custom JavaScript/Python nodes, REST APIs, and a plugin marketplace for unlimited extensibility.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">Transparent & Open</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  We believe in transparency. Clear pricing, open communication, and a commitment to building in the open with our community.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Our Vision</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              We envision a world where repetitive work is eliminated, where teams can focus on creative problem-solving and innovation rather than manual data entry and routine tasks. SynthralOS is our contribution to making that vision a reality.
            </p>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              As we continue to evolve, we're committed to pushing the boundaries of what's possible with automation, always with the goal of making powerful tools accessible to everyone.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Join Us</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              We're just getting started, and we'd love for you to be part of our journey. Whether you're looking to automate your workflows, contribute to our platform, or just learn more about what we're building, we'd love to hear from you.
            </p>
            <div className="flex gap-4">
              <a
                href="/signup"
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold"
              >
                Get Started Free
              </a>
              <a
                href="/contact"
                className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-semibold"
              >
                Contact Us
              </a>
            </div>
          </section>
        </div>
      </div>
  );
}

