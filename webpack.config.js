module.exports = {
  mode: 'production',
  entry: ['./src/runners/lambda.js'],
  target: 'node',
  output: {
    path: `${process.cwd()}/dist`,
    filename: 'lambda.js',
    libraryTarget: 'umd',
  },
  optimization: {
    minimize: false,
  },
  externals: {
    'aws-sdk': 'aws-sdk',
  },
}
