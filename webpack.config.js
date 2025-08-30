const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const path = require("path");

module.exports = {
    mode: "development",
    entry: {
        "content-script": "./src/content-script.ts",
        background: "./src/background.ts",
        options: "./src/options.ts",
        "pdf.worker.min": "./node_modules/pdfjs-dist/build/pdf.worker.min.mjs"
    },
    output: {
        path: path.resolve(__dirname, "./dist"),
        filename: "[name].js"
    },
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                    loader: "ts-loader",
                },
            }
        ],
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    externals: [{}],
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: "public", to: "." }
            ],
        }),
        new CleanWebpackPlugin(),
    ]
};