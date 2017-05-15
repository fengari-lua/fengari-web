/*jshint esversion: 6 */
"use strict";

const webpack = require('webpack');
const path = require('path');
const BabiliPlugin = require("babili-webpack-plugin");

module.exports = [
    {
        entry: './src/web-cli.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'fengari-web-cli.js',
            library: 'fengari_web_cli'
        },
        plugins: [
            new BabiliPlugin(),
            new webpack.DefinePlugin({
                WEB: JSON.stringify(true),
            })
        ]
    }
];
