module.exports = (toolsNames, packageIndex) => {
	let arduino
	let tools
	if (packageIndex.packages) {
		packageIndex.packages.forEach((pkg) => {
			if (pkg.name === 'arduino') {
				arduino = pkg
			}
		})
	}
	if (arduino.tools) {
		tools = arduino.tools.filter((tool) => tool.name === toolsNames)
	}
	if (tools) {
		if (tools.length) {
			return tools.filter((value, index) => index >= (tools.length - 1))
		}
		return []
	}
	throw new Error('Could not extract tool')
}
