import obsidianmd from 'eslint-plugin-obsidianmd';
import { DEFAULT_BRANDS } from 'eslint-plugin-obsidianmd/dist/lib/rules/ui/brands.js';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'.opencode',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.mts',
						'manifest.json',
						'vitest.config.ts',
					],
				},
				tsconfigRootDir: import.meta.dirname as string,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		rules: {
			'obsidianmd/ui/sentence-case': [
				'warn',
				{
					brands: [
						...DEFAULT_BRANDS,
						'VocabWeave',
						'AnkiConnect',
						'ComfyUI',
						'Automatic1111',
					],
				},
			],
		},
	},
	// Tests run in Node under Vitest, not in an Obsidian window.
	{
		files: ['src/**/*.test.ts', 'src/test/**'],
		rules: {
			'obsidianmd/no-global-this': 'off',
			'obsidianmd/prefer-window-timers': 'off',
			'obsidianmd/no-tfile-tfolder-cast': 'off',
			'obsidianmd/prefer-create-el': 'off',
		},
	},
);
