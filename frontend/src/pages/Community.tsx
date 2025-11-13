export default function Community() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
            Community
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Join a growing community of automation enthusiasts
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Discord Community</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Join our Discord server to connect with other users, share workflows, get help, and stay updated on the latest features.
            </p>
            <a
              href="#"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-semibold"
            >
              Join Discord
            </a>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">GitHub</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Contribute to open-source components, report issues, and help shape the future of SynthralOS.
            </p>
            <a
              href="#"
              className="inline-block px-6 py-3 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-all font-semibold"
            >
              View on GitHub
            </a>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-gray-900 dark:text-gray-100 text-center">Community Resources</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Workflow Templates',
                description: 'Browse and share workflow templates created by the community',
              },
              {
                title: 'Plugin Marketplace',
                description: 'Discover and contribute custom nodes and integrations',
              },
              {
                title: 'Documentation',
                description: 'Community-contributed guides and tutorials',
              },
            ].map((resource, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-6"
              >
                <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">{resource.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{resource.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl p-8 border border-indigo-200/50 dark:border-indigo-800/50 text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Get Involved</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Whether you're a developer, designer, or automation enthusiast, there are many ways to contribute to the SynthralOS community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/signup"
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold"
            >
              Join the Community
            </a>
            <a
              href="/contact"
              className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-semibold"
            >
              Contact Us
            </a>
          </div>
        </div>
      </div>
  );
}

