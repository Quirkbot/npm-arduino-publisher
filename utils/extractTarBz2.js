const fs = require('fs')
const path = require('path')
const Bunzip = require('seek-bzip')
const tar = require('tar')
const rimraf = require('./rimraf')

module.exports = async (src, dst, item) => {
	await rimraf(dst)
	await fs.promises.mkdir(path.resolve(dst, 'tools'), { recursive : true })

	// Uncompress
	const compressedData = await fs.promises.readFile(src)
	const data = Bunzip.decode(compressedData)
	await fs.promises.writeFile(`${src}.temp.tar`, data)

	await new Promise((resolve, reject) => {
		// Untar
		const extractor = tar.extract({
			cwd   : path.resolve(dst, 'tools'),
			strip : 0
		})
		extractor.on('error', reject)
		extractor.on('end', async () => {
			if (item.toolName) {
				try {
					// Write the builtin_tools_versions.txt
					await fs.promises.access(path.resolve(dst, 'tools', 'avr'), fs.F_OK)
					await fs.promises.writeFile(
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
