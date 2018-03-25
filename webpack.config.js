"use strict";

const webpack = require('webpack');
const path = require('path');

module.exports = [
	{
		/*
		This target produces a file suitable for embedding onto any webpage via a <script> tag.
		*/
		name: 'script-tag',
		entry: './src/fengari-web.js',
		target: 'web',
		output: {
			path: path.resolve(__dirname, 'dist'),
			filename: 'fengari-web.js',
			library: 'fengari',
			libraryTarget: 'umd'
		},
		node: false,
		module: {
			rules: [
				{
					test: [/\.js$/],
					loader: 'babel-loader',
					options: {
						presets: [['env', {
							"targets": {
								"browsers": ["last 2 versions", "safari >= 7"]
							}
						}]]
					}
				}
			]
		},
		plugins: [
			new webpack.DefinePlugin({
				"typeof process": JSON.stringify("undefined")
			})
		]
	},
	{
		/*
		This target exists to create a bundle that has the node-specific paths eliminated.
		It is expected that most people would minify this with their own build process
		*/
		name: 'bundle',
		entry: './src/fengari-web.js',
		target: 'web',
		output: {
			path: path.resolve(__dirname, 'dist'),
			filename: 'fengari-web.bundle.js',
			libraryTarget: 'commonjs2'
		},
		node: false,
		plugins: [
			new webpack.DefinePlugin({
				"typeof process": JSON.stringify("undefined")
			})
		]
	}
];
