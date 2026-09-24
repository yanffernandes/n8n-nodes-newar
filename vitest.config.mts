import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		environment: 'node',
		// Load n8n-workflow the way n8n loads it for the compiled nodes: its CommonJS build.
		alias: { 'n8n-workflow': require.resolve('n8n-workflow') },
	},
});
