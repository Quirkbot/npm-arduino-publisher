const path = require('path')
const findOneObjectByKey = require('./findOneObjectByKey')

module.exports = (hostMap, tools) => {
	const flatList = []
	tools.forEach((tool) => {
		const toolName = tool.name
		const toolVersion = tool.version

		Object.keys(hostMap).forEach((platform) => {
			Object.keys(hostMap[platform]).forEach((arch) => {
				const token = findOneObjectByKey(tool.systems, 'host', hostMap[platform][arch])
				flatList.push({
					url     : token.url,
					dst     : token.archiveFileName,
					newName : path.join(`${toolName}-${toolVersion}`, `${platform}-${arch}`),
					toolName,
					toolVersion
				})
			})
		})
	})
	return flatList
}
