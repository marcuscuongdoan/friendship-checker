const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    mode: 'development',
    entry:
    {
        index: ['./src/index.js', './src/styles.css'],
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'docs'),
        clean: true,
    },
    devServer: {
        static: './docs',
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Friendship Checker',
            filename: 'index.html',
            template: 'src/index.html',
            favicon: 'favicon.ico'
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'public/assets', to: 'assets' }
            ]
        }),
        new MiniCssExtractPlugin({
            filename: "[name].css",
        }),
    ],
};