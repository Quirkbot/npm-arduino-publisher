const path = require('path')

module.exports = (hostMap, tags) => {
	const flatList = []
	tags.forEach((tag) => {
		Object.keys(hostMap).forEach((platform) => {
			Object.keys(hostMap[platform]).forEach((arch) => {
				const filename = `arduino-builder-${hostMap[platform][arch].slug}-${tag}.${hostMap[platform][arch].ext}`
				flatList.push({
					url     : `http://downloads.arduino.cc/tools/${filename}`,
					dst     : filename,
					newName : path.join(`arduino-builder-${tag}`, `${platform}-${arch}`)
				})
			})
		})
	})
	return flatList
}
