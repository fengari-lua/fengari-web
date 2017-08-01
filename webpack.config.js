/*jshint esversion: 6 */
"use strict";

const webpack = require('webpack');
const path = require('path');
const BabiliPlugin = require("babili-webpack-plugin");

module.exports = [
    {
        entry: './src/web-cli-lua.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'fengari-web-cli-lua.js',
            library: 'fengari_web_cli_lua'
        },
        plugins: [
            new webpack.DefinePlugin({
                WEB: JSON.stringify(true),
            }),
            new BabiliPlugin()
        ]
    }
];
