module.exports = {
    webpack: {
        configure: {
            resolve: {
                fallback: {
                    "path": require.resolve("path-browserify"),
                    "os": require.resolve("os-browserify/browser"),
                    "crypto": require.resolve("crypto-browserify"),
                    "stream": require.resolve("stream-browserify"),
                    "buffer": require.resolve("buffer/"),
                }
            }
        }
    },
    devServer: {
        hot: true,
        client: {
            overlay: true,
        }
    }
}; 