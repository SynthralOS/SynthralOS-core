export default function Changelog() {
  const changelogEntries = [
    {
      version: '1.0.0',
      date: '2024-12-01',
      type: 'major',
      changes: [
        { type: 'feature', text: 'Initial release of SynthralOS' },
        { type: 'feature', text: 'Visual workflow builder with drag-and-drop interface' },
        { type: 'feature', text: 'Native AI integration with LLM nodes' },
        { type: 'feature', text: 'Multi-tenant architecture with RBAC' },
        { type: 'feature', text: 'Real-time execution monitoring' },
        { type: 'feature', text: '500+ app integrations' },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
            Changelog
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Stay up to date with the latest features and improvements
          </p>
        </div>

        <div className="space-y-8">
          {changelogEntries.map((entry, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Version {entry.version}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {new Date(entry.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-400 rounded-full text-sm font-semibold">
                  {entry.type === 'major' ? 'Major Release' : entry.type === 'minor' ? 'Minor Update' : 'Patch'}
                </span>
              </div>
              <div className="space-y-3">
                {entry.changes.map((change, idx) => (
                  <div key={idx} className="flex items-start space-x-3">
                    <span className={`flex-shrink-0 mt-1 ${
                      change.type === 'feature' ? 'text-emerald-600 dark:text-emerald-400' :
                      change.type === 'improvement' ? 'text-blue-600 dark:text-blue-400' :
                      change.type === 'fix' ? 'text-red-600 dark:text-red-400' :
                      'text-gray-600 dark:text-gray-400'
                    }`}>
                      {change.type === 'feature' && '✨'}
                      {change.type === 'improvement' && '⚡'}
                      {change.type === 'fix' && '🐛'}
                      {change.type === 'security' && '🔒'}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">{change.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Want to be notified of new releases?
          </p>
          <a
            href="/signup"
            className="inline-block px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all text-lg font-semibold"
          >
            Sign Up for Updates
          </a>
        </div>
      </div>
  );
}

