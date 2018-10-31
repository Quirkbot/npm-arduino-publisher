const path = require('path')

module.exports = module =>
	path.resolve(require.resolve(path.join(module, 'package.json')), '..')
