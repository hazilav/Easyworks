const { createJiti } = require('jiti');
const path = require('path');

const jiti = createJiti(__filename, {
  alias: {
    '@': path.resolve(__dirname, '../src'),
  },
});

jiti.import('./test-logo-lifecycle.ts').catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
