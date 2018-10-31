const Downloader = require('mt-files-downloader')

const downloader = new Downloader()
module.exports = (url, dst, port, method) => new Promise((resolve, reject) => {
	const dl = downloader.download(url, dst)
	dl.setRetryOptions({
		maxRetries    : 3, // Default: 5
		retryInterval : 1000 // Default: 2000
	})

	// Optional, set download options
	dl.setOptions({
		threadsCount : 5, // Default : 2, Set the total number of download threads
		method, // Default : GET, HTTP method
		port, // Default : 80, HTTP port
		timeout      : 5000, // Default : 5000, If no data is received, the download times out (milliseconds)
		range        : '0-100', // Default : 0-100, Control the part of file that needs to be downloaded.
	})

	// Called when the download will start
	dl.on('start', () => {})

	// Called in case of error
	dl.on('error', () => {
		// console.log('download - error - ' + url + ' >> ' + dst)
		// console.log(dl.error)
		reject(dl.error)
	})

	// Called when the download is finished
	dl.on('end', () => {
		// console.log('download - end - ' + url + ' >> ' + dst)
		resolve(dst)
	})

	// Start the download
	dl.start()
})
