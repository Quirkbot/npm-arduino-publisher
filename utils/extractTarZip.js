const fs = require('fs')
const fsp = require('fs').promises
const path = require('path')
const unzip = require('unzip')

module.exports = async (src, dst, item) => new Promise((resolve, reject) => {
	// We need a useless nested path, as node-pre-gyp will skip the first level
	const readStream = fs.createReadStream(src)
	readStream.pipe(unzip.Extract({ path : path.resolve(dst, 'tools') }))
	readStream.on('end', async () => {
		if (item.toolName) {
			try {
				// Write the builtin_tools_versions.txt
				await fsp.access(path.resolve(dst, 'tools', 'avr'), fs.F_OK)
				await fsp.writeFile(
					path.resolve(dst, 'tools', 'avr', 'builtin_tools_versions.txt'),
					`arduino.${item.toolName}=${item.toolVersion}`
				)
			} catch (e) {}
		}
		// console.log('extractTarZip - end', src, dst)
		resolve()
	})
	readStream.on('error', reject)
})
