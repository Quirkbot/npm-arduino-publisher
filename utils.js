var path = require('path')
var fs = require('fs-extra')
var request = require('request')
var Downloader = require('mt-files-downloader')
var Bunzip = require('seek-bzip')
var tar = require('tar')
var unzip = require('unzip')
var downloader = new Downloader()

const LIMIT = process.argv[3] || 1
const TEMP = path.resolve('.downloads')
const DIST = path.resolve('dist')

var pass = function () {
	var payload = arguments
	return new Promise(function (resolve) {
		resolve.apply(this, payload)
	})
}
var get = function(url) {
	return new Promise(function (resolve, reject) {
		request(
			{
				url :url,
				headers: {
					'User-Agent': 'bogus'
				}
			},
			function (error, response, body) {
				if (!error && response.statusCode == 200) {
					resolve(body)
				}
				else{
					reject(error)
				}
			}
		)
	})
}
var download = function (url, dst, port, method) {
	return new Promise(function (resolve, reject) {

		var dl = downloader.download(url, dst)
		dl.setRetryOptions({
			maxRetries: 3,		// Default: 5
			retryInterval: 1000 // Default: 2000
		})

		// Optional, set download options
		dl.setOptions({
			threadsCount: 5, // Default: 2, Set the total number of download threads
			method: method,	  // Default: GET, HTTP method
			port: port,		  // Default: 80, HTTP port
			timeout: 5000,   // Default: 5000, If no data is received, the download times out (milliseconds)
			range: '0-100',  // Default: 0-100, Control the part of file that needs to be downloaded.
		})

		// Called when the download will start
		dl.on('start', function() {
			// console.log('download - start - ' + url + ' >> ' + dst)
		})

		// Called in case of error
		dl.on('error', function() {
			// console.log('download - error - ' + url + ' >> ' + dst)
			// console.log(dl.error)
			reject(dl.error)
		})

		// Called when the download is finished
		dl.on('end', function() {
			// console.log('download - end - ' + url + ' >> ' + dst)
			resolve(dst)
		})

		// Start the download
		dl.start()
	})
}
var extractTarBz2 = function (src, dst, item) {
	return new Promise(function (resolve, reject) {
		// console.log('extractTarBz2 - start', src, dst)
		// Uncompress
		var compressedData = fs.readFileSync(src)
		var data = Bunzip.decode(compressedData)
		fs.writeFileSync(`${src}.temp.tar`, data)

		// Untar
		var extractor = tar.Extract({
			path: path.resolve(dst, 'tools'),
			strip: 0
		})
		.on('error', reject)
		.on('end', function () {
			if(item.toolName){
				try {
					// Write the builtin_tools_versions.txt
					fs.accessSync(path.resolve(dst, 'tools', 'avr'), fs.F_OK)
					fs.writeFileSync(
						path.resolve(dst, 'tools', 'avr', 'builtin_tools_versions.txt'),
						`arduino.${item.toolName}=${item.toolVersion}`
					)
				} catch (e) {/**/}


			}
			// console.log('extractTarBz2 - end', src, dst)
			resolve()
		})
		fs.createReadStream(`${src}.temp.tar`)
		.on('error', reject)
		.pipe(extractor)
	})
}
var extractTarZip = function (src, dst, item) {
	return new Promise(function (resolve, reject) {
		// console.log('extractTarZip - start', src, dst)
		// We need a useless nested path, as node-pre-gyp will skip the first level
		var readStream = fs.createReadStream(src)
		readStream.pipe(unzip.Extract({ path: path.resolve(dst, 'tools')}))
		readStream.on('end', function(){
			if(item.toolName){
				try {
					// Write the builtin_tools_versions.txt
					fs.accessSync(path.resolve(dst, 'tools', 'avr'), fs.F_OK)
					fs.writeFileSync(
						path.resolve(dst, 'tools', 'avr', 'builtin_tools_versions.txt'),
						`arduino.${item.toolName}=${item.toolVersion}`
					)
				} catch (e) {/**/}
			}
			// console.log('extractTarZip - end', src, dst)
			resolve()

		})
		readStream.on('error', reject)
	})
}
var mkdir = function(path){

	return function(){
		var payload = arguments
		var promise = function(resolve, reject){
			fs.mkdir(path, function(error) {
				if (error) {
					reject(error)
					return
				}
				resolve.apply(null, payload)
			})
		}
		return new Promise(promise)
	}
}
var deleteDir = function(path){
	return function(){
		var payload = arguments
		var promise = function(resolve, reject){
			fs.remove(path, function(error) {
				if (error) {
					reject(error)
					return
				}
				resolve.apply(null, payload)
			})
		}
		return new Promise(promise)
	}
}
var clearAll = function () {
	var payload = arguments
	var promise = function(resolve){
		pass()
		.then(deleteDir(TEMP))
		.then(deleteDir(DIST))
		.then(mkdir(TEMP))
		.then(mkdir(DIST))
		.then(function() {
			resolve.apply(null, payload)
		})
	}
	return new Promise(promise)
}

var clear = function () {
	var payload = arguments
	var promise = function(resolve){
		pass()
		.then(deleteDir(TEMP))
		.then(function() {
			resolve.apply(null, payload)
		})
	}
	return new Promise(promise)
}

var processItem = function(item) {
	return new Promise(function (resolve) {
		pass(item)
		.then(item => {
			console.log('START:', item.newName)
			return item
		})
		.then(downloadItem)
		.then(extractItem)
		.then(cloneItem)
		.then(item => {
			console.log('SUCCESS:', item.newName)
			return item
		})
		.then(resolve)
		.catch(error => {
			console.log('ERROR:', item.newName, error)
			return item
		})
	})
}
var downloadItem = function(item) {
	return new Promise(function (resolve, reject) {
		download(item.url, path.join(TEMP , item.dst))
		.then(function () {
			resolve(item)
		})
		.catch(reject)
	})
}
var extractItem = function(item) {
	return new Promise(function (resolve, reject) {
		var func
		if(item.dst.indexOf('.tar.bz2') !== -1){
			func = extractTarBz2
		}
		else if (item.dst.indexOf('.zip') !== -1){
			func = extractTarZip
		}
		if(func){
			func(
				path.join(TEMP, item.dst),
				path.join(DIST, item.newName),
				item
			)
			.then(function () {
				resolve(item)
			})
			.catch(reject)
		}
		else {
			reject('Cannot extract this extension.')
		}

	})
}
var cloneItem = function(item) {
	return new Promise(function (resolve) {
		// This helps with the linking problem when publishing to npm

		const src = path.join(DIST, item.newName)
		const tmp = path.join(DIST, `${item.newName}tmp`)

		require('child_process').execSync(
			`cp -r ${src} ${tmp} && rm -r ${src} && mv ${tmp} ${src}`
		)

		resolve(item)
	})
}
var fixSymlinks = function() {
	return new Promise(function (resolve) {
		console.log('Fixing symlinks...')
		require('child_process').execSync('sh fixsymlinks.sh')
		console.log('Fixed!')
		resolve()
	})
}


var processList = function(list) {
	var promises = list.map(function(item) {
		return processItem(item)
	})
	return Promise.all(promises)
	.then(fixSymlinks)
}

var extractToolsFromPackage = function (toolsNames) {
	return function (rawPackage) {
		return new Promise(function(resolve, reject){
			var index = JSON.parse(rawPackage)
			var arduino
			var tools
			if(index.packages){
				index.packages.forEach(function (pkg) {
					if(pkg.name === 'arduino'){
						arduino = pkg
					}
				})
			}
			if(arduino.tools){
				tools = arduino.tools.filter(function(tool) {
					if(tool.name === toolsNames){
						return true
					}
				})
			}
			if(tools){
				//resolve(tools)
				// Only the latest
				if(tools.length){
					resolve(tools.filter(function(value, index){
						if(index >= (tools.length - LIMIT)) return true
					}))
				}
				else {
					resolve([])
				}
			}
			else{
				reject('Could not extract tool')
			}

		})
	}
}
var extractFlatListFromTools = function (hostMap) {
	return function (tools) {
		return new Promise(function(resolve){
			var flatList = []
			tools.forEach(function(tool){
				var toolName = tool.name
				var toolVersion = tool.version

				Object.keys(hostMap).forEach(function(platform){
					Object.keys(hostMap[platform]).forEach(function(arch){
						var token = findOneObjectByKey(tool.systems, 'host', hostMap[platform][arch])
						flatList.push({
							url: token.url,
							dst: token.archiveFileName,
							newName: path.join(`${toolName}-${toolVersion}`, `${platform}-${arch}`),
							toolName: toolName,
							toolVersion: toolVersion
						})
					})
				})
			})
			resolve(flatList)
		})
	}
}

var extractLatestTagsFromReleases = function(rawReleases) {
	return new Promise(function(resolve, reject){
		try{
			var releases = JSON.parse(rawReleases)
			.map(function(item){
				return item['tag_name']
			}).filter(function(tag, index){
				if(index < LIMIT) return true
			})
			resolve(releases)
		}
		catch (e){
			reject(e)
		}

	})
}
var extractFlatListFromTags = function (hostMap) {
	return function (versions) {
		return new Promise(function(resolve){
			var flatList = []
			versions.forEach(function (version) {
				Object.keys(hostMap).forEach(function(platform){
					Object.keys(hostMap[platform]).forEach(function(arch){
						var filename = 'arduino-builder-' + hostMap[platform][arch].slug + '-' + version + '.' + hostMap[platform][arch].ext
						flatList.push({
							url: 'http://downloads.arduino.cc/tools/' + filename,
							dst: filename,
							newName: path.join(`arduino-builder-${version}`, `${platform}-${arch}`)
						})
					})
				})
			})
			resolve(flatList)
		})
	}
}

var getDeep = function(object, path){
	try{
		var paths = path.split('.')
		var current = object
		var i

		for (i = 0; i < paths.length; ++i) {
			if (current[paths[i]] === undefined) {
				return
			} else {
				current = current[paths[i]]
			}
		}
		return current
	}
	catch(e){
		return
	}
}

var findOneIndexByKey = function(list, path, value) {
	if(!list || !list.length){
		return -1
	}

	for (var i = 0; i < list.length; i++) {
		if(getDeep(list[i], path) === value){
			return i
		}
	}
	return -1
}
var findOneObjectByKey = function(list, path, value) {
	if(!list || !list.length){
		return
	}
	var index = findOneIndexByKey(list, path, value)
	return	list[index]
}

exports.pass = pass
exports.get = get

exports.clear = clear
exports.clearAll = clearAll
exports.processList = processList

exports.extractToolsFromPackage = extractToolsFromPackage
exports.extractFlatListFromTools = extractFlatListFromTools

exports.extractLatestTagsFromReleases = extractLatestTagsFromReleases
exports.extractFlatListFromTags = extractFlatListFromTags

