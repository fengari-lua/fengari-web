"use strict";

const webpack = require('webpack');
const path = require('path');

module.exports = [
    {
        entry: './src/web-cli-lua.js',
        target: 'web',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'fengari-web-cli-lua.js'
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
                WEB: JSON.stringify(true),
            })
        ]
    }
];
