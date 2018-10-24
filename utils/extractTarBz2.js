const fs = require('fs')
const fsp = require('fs').promises
const path = require('path')
const Bunzip = require('seek-bzip')
const tar = require('tar')

module.exports = async (src, dst, item) => {
	// Uncompress
	const compressedData = await fsp.readFile(src)
	const data = Bunzip.decode(compressedData)
	await fsp.writeFile(`${src}.temp.tar`, data)

	return new Promise((resolve, reject) => {
		// Untar
		const extractor = tar.extract({
			path  : path.resolve(dst, 'tools'),
			strip : 0
		})
		extractor.on('error', reject)
		extractor.on('end', async () => {
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
			// console.log('extractTarBz2 - end', src, dst)
			resolve()
		})

		fs.createReadStream(`${src}.temp.tar`)
			.on('error', reject)
			.pipe(extractor)
	})
}
