const htmlDiffer = require("html-differ");
const path = require("path");

module.exports = {
    entry: './script.js',
    output: {
        path: path.resolve(__dirname, "."),
        filename: 'bundle.js'
    },
    mode: 'development',
    resolve: {
        alias: {
          'node_modules': path.join(__dirname, 'node_modules'),
        }
      }
    };
