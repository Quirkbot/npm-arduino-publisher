const { exec } = require('child_process')

module.exports = (command, resolveError) => new Promise((resolve, reject) => {
	exec(command, { maxBuffer : 1024 * 500 }, (error, stdout, stderr) => {
		if (!resolveError && error !== null) {
			reject(stderr)
		} else {
			resolve({ stdout, stderr })
		}
	})
})
