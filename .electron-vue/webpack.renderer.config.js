"use strict";

process.env.BABEL_ENV = "renderer";

const path = require("path");
const { dependencies } = require("../package.json");
const webpack = require("webpack");

const BabiliWebpackPlugin = require("babili-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { VueLoaderPlugin } = require("vue-loader");

let htmlWebpackPluginOptions = {
  filename: "index.html",
  template: path.resolve(__dirname, "../src/index.ejs"),
  minify: {
    collapseWhitespace: true,
    removeAttributeQuotes: true,
    removeComments: true,
  },
  nodeModules: false,
  nodeModules:
    process.env.NODE_ENV !== "production"
      ? path.resolve(__dirname, "../node_modules")
      : false,
};
// 判断node的版本号
try {
  const version = process.version.split(".")[0].replace("v", "");
  const v = parseInt(version);
  if (version && v > 11) {
    // node11 以上需要添加这个字段
    htmlWebpackPluginOptions.templateParameters = function(
      compilation,
      assets,
      options
    ) {
      return {
        compilation: compilation,
        webpack: compilation.getStats().toJson(),
        webpackConfig: compilation.options,
        htmlWebpackPlugin: {
          files: assets,
          options: options,
        },
        process,
      };
    };
  }
} catch (error) {}

/**
 * List of node_modules to include in webpack bundle
 *
 * Required for specific packages like Vue UI libraries
 * that provide pure *.vue files that need compiling
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/webpack-configurations.html#white-listing-externals
 */
let whiteListedModules = ["vue"];

let rendererConfig = {
  devtool: "#cheap-module-eval-source-map",
  entry: {
    renderer: path.join(__dirname, "../src/renderer/main.js"),
  },
  externals: [
    ...Object.keys(dependencies || {}).filter(
      (d) => !whiteListedModules.includes(d)
    ),
  ],
  module: {
    rules: [
      {
        test: /\.less$/,
        use: ["vue-style-loader", "css-loader", "less-loader"],
      },
      {
        test: /\.css$/,
        use: ["vue-style-loader", "css-loader"],
      },
      {
        test: /\.html$/,
        use: "vue-html-loader",
      },
      {
        test: /\.js$/,
        use: "babel-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.node$/,
        use: "node-loader",
      },
      {
        test: /\.vue$/,
        use: {
          loader: "vue-loader",
          options: {
            extractCSS: process.env.NODE_ENV === "production",
            loaders: {
              sass: "vue-style-loader!css-loader!sass-loader?indentedSyntax=1",
              scss: "vue-style-loader!css-loader!sass-loader",
              less: "vue-style-loader!css-loader!less-loader",
            },
          },
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        use: {
          loader: "url-loader",
          query: {
            limit: 10000,
            name: "imgs/[name]--[folder].[ext]",
          },
        },
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        loader: "url-loader",
        options: {
          limit: 10000,
          name: "media/[name]--[folder].[ext]",
        },
      },
      {
        test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
        use: {
          loader: "url-loader",
          query: {
            limit: 10000,
            name: "fonts/[name]--[folder].[ext]",
          },
        },
      },
    ],
  },
  node: {
    __dirname: process.env.NODE_ENV !== "production",
    __filename: process.env.NODE_ENV !== "production",
  },
  plugins: [
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin({ filename: "styles.css" }),
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: path.resolve(__dirname, "../src/index.ejs"),

      // node11 以上需要添加这个字段
      templateParameters(compilation, assets, options) {
        return {
          compilation: compilation,
          webpack: compilation.getStats().toJson(),
          webpackConfig: compilation.options,
          htmlWebpackPlugin: {
            files: assets,
            options: options,
          },
          process,
        };
      },
      // ====
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      nodeModules:
        process.env.NODE_ENV !== "production"
          ? path.resolve(__dirname, "../node_modules")
          : false,
    }),
    new HtmlWebpackPlugin(htmlWebpackPluginOptions),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
  ],
  output: {
    filename: "[name].js",
    libraryTarget: "commonjs2",
    path: path.join(__dirname, "../dist/electron"),
  },
  resolve: {
    alias: {
      "@": path.join(__dirname, "../src/renderer"),
      vue$: "vue/dist/vue.esm.js",
    },
    extensions: [".js", ".vue", ".json", ".css", ".node"],
  },
  target: "electron-renderer",
};

/**
 * Adjust rendererConfig for development settings
 */
if (process.env.NODE_ENV !== "production") {
  rendererConfig.plugins.push(
    new webpack.DefinePlugin({
      __static: `"${path.join(__dirname, "../static").replace(/\\/g, "\\\\")}"`,
    })
  );
}

/**
 * Adjust rendererConfig for production settings
 */
if (process.env.NODE_ENV === "production") {
  rendererConfig.devtool = "";

  rendererConfig.plugins.push(
    new BabiliWebpackPlugin(),
    new CopyWebpackPlugin([
      {
        from: path.join(__dirname, "../static"),
        to: path.join(__dirname, "../dist/electron/static"),
        ignore: [".*"],
      },
    ]),
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": '"production"',
      "__static": `"${path.join(__dirname, '../static').replace(/\\/g, '\\\\')}"`
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true,
    })
  );
}

module.exports = rendererConfig;
