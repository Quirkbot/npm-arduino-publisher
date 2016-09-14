var path = require('path')
var fs = require('fs')
var rimraf = require('rimraf')
var request = require('request')
var Downloader = require('mt-files-downloader')
var Bunzip = require('seek-bzip')
var pack = require('tar-pack').pack

//var tarFs = require('tar-fs')
var tar = require('tar')
var unzip = require('unzip')
//var zlib = require('zlib')
var s3 = require('s3')
var downloader = new Downloader()
var s3Client = s3.createClient({
	s3Options: {
		accessKeyId: process.env.S3_ACCESS_KEY_ID,
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
	}
})
var downloadDir = '.downloads'
var uploadDir = '.uploads'

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
var download = function (url, dest, port, method) {
	return new Promise(function (resolve, reject) {

		var dl = downloader.download(url, dest)
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
			console.log('download - start - ' + url + ' >> ' + dest)
		})

		// Called in case of error
		dl.on('error', function() {
			console.log('download - error - ' + url + ' >> ' + dest)
			console.log(dl.error)
			reject(dl.error)
		})

		// Called when the download is finished
		dl.on('end', function() {
			console.log('download - end - ' + url + ' >> ' + dest)
			resolve(dest)
		})

		// Start the download
		dl.start()
	})
}
var upload = function (src, dest) {
	return new Promise(function (resolve, reject) {
		var params = {
			localFile: src,
			s3Params: {
				Bucket: process.env.S3_BUCKET,
				Key: dest,
				ContentType: 'application/x-gzip'
			}
		}
		var uploader = s3Client.uploadFile(params)
		console.log('upload - start - ' + src)
		uploader.on('error', function(err) {
			console.log('upload - error - ' + src)
			reject(err)
		})

		uploader.on('end', function() {
			console.log('upload - end - ' + src)
			resolve()
		})
	})
}
var extractTarBz2 = function (src, dest, item) {
	return new Promise(function (resolve, reject) {
		console.log('extractTarBz2 - start', src, dest)
		// Uncompress
		var compressedData = fs.readFileSync(src)
		var data = Bunzip.decode(compressedData)
		fs.writeFileSync(dest + '.temptar', data)

		// Untar
		// We need a useless nested path, as node-pre-gyp will skip the first level
		var extractor = tar.Extract({
			path: path.resolve(__dirname, dest + '_temp', 'dummy'),
			strip: 0
		})
		.on('error', reject)
		.on('end', function () {
			if(item.toolName){
				try {
					// Write the builtin_tools_versions.txt
					fs.accessSync(path.resolve(dest + '_temp','dummy','avr'), fs.F_OK)
					fs.writeFileSync(
						path.resolve(dest + '_temp','dummy','avr','builtin_tools_versions.txt'),
						'arduino.' + item.toolName + '=' + item.toolVersion
					)
				} catch (e) {
					//console.log(e)
				}


			}
			console.log('extractTarBz2 - end', src, dest)
			resolve()
			/*var writeStream = fs.createWriteStream(dest)
			writeStream.on('finish', function () {
				console.log('extractTarBz2 - end', src, dest)
				resolve()
			})
			writeStream.on('error', reject)
			tarFs.pack(dest + '_temp').pipe(writeStream)*/
		})

		fs.createReadStream(dest + '.temptar')
		.on('error', reject)
		.pipe(extractor)
	})
}
var extractTarZip = function (src, dest, item) {
	return new Promise(function (resolve, reject) {
		console.log('extractTarZip - start', src, dest)
		// We need a useless nested path, as node-pre-gyp will skip the first level
		var readStream = fs.createReadStream(src)
		readStream.pipe(unzip.Extract({ path: path.resolve(dest + '_temp','dummy')}))
		readStream.on('end', function(){
			if(item.toolName){
				try {
					// Write the builtin_tools_versions.txt
					fs.accessSync(path.resolve(dest + '_temp','dummy','avr'), fs.F_OK)
					fs.writeFileSync(
						path.resolve(dest + '_temp','dummy','avr','builtin_tools_versions.txt'),
						'arduino.' + item.toolName + '=' + item.toolVersion
					)
				} catch (e) {
					//console.log(e)
				}
			}
			console.log('extractTarZip - end', src, dest)
			resolve()
			/*var writeStream = fs.createWriteStream(dest)
			// writeStream.on('finish', function () {
			// 	console.log('extractTarZip - end', src, dest)
			// 	resolve()
			// })
			setTimeout(function () {
				console.log('extractTarZip - end', src, dest)
				resolve()
			}, 10000)
			writeStream.on('error', reject)
			tarFs.pack(dest + '_temp').pipe(writeStream)*/


		})
		readStream.on('error', reject)
	})
}
/*var gzip = function (src, dest) {
	return new Promise(function (resolve, reject) {
		console.log('gzip - start', src, dest);
		var gzip = zlib.createGzip();
		var inp = fs.createReadStream(src);
		inp.on('error', reject);
		var out = fs.createWriteStream(dest);
		out.on('finish', function (argument) {
			console.log('gzip - end', src, dest);
			resolve();
		});
		out.on('error', reject);
		inp.pipe(gzip).pipe(out);
	});
}*/
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
			rimraf(path, function(error) {
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
var clear = function () {
	var payload = arguments
	var promise = function(resolve){
		pass()
		.then(deleteDir(downloadDir))
		.then(deleteDir(uploadDir))
		.then(mkdir(downloadDir))
		.then(mkdir(uploadDir))
		.then(function() {
			resolve.apply(null, payload)
		})
	}
	return new Promise(promise)


}

var processItem = function(item) {
	return new Promise(function (resolve, reject) {
		downloadItem(item)
		.then(extractItem)
		.then(compressItem)
		.then(copyItem)
		.then(uploadItem)
		.then(function () {
			console.log('item processed ', item)
		})
		.then(resolve)
		.catch(reject)
	})
}
var downloadItem = function(item) {
	return new Promise(function (resolve, reject) {
		download(item.url, path.resolve(downloadDir , item.dest))
		.then(function () {
			resolve(item)
		})
		.catch(reject)
	})
}
var extractItem = function(item) {
	return new Promise(function (resolve, reject) {
		var func
		if(item.dest.indexOf('.tar.bz2') !== -1){
			func = extractTarBz2
		}
		else if (item.dest.indexOf('.zip') !== -1){
			func = extractTarZip
		}
		if(func){
			func(
				path.resolve(downloadDir, item.dest),
				path.resolve(downloadDir, item.dest  + '.tar'),
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
var compressItem = function(item) {
	return new Promise(function (resolve, reject) {
		console.log('compressItem - start', item.newName)

		var writeStream = fs.createWriteStream(path.resolve(uploadDir, item.newName))
		writeStream.on('error', function (error) {
			console.log('compress error')
			reject(error)
		})

		pack(path.resolve(downloadDir, item.dest  + '.tar_temp'))
		.pipe(writeStream)
		.on('error', function (error) {
			console.log('compress error')
			reject(error)
		})
		.on('close', function () {
			console.log('compressItem - end', item.newName)
			resolve(item)
		})
		/*gzip(
			path.resolve(downloadDir, item.dest  + '.tar'),
			path.resolve(uploadDir, item.newName)
		)*/
		/*targz().compress(
			path.resolve(downloadDir, item.dest  + '.tar_temp'),
			path.resolve(uploadDir, item.newName)
		)*/
		/*.then(function () {
			resolve(item)
		})
		.catch(reject)*/
	})
}
var copyItem = function(item) {
	return new Promise(function (resolve, reject) {
		var src = path.resolve(downloadDir, item.dest)
		var dest =  path.resolve(uploadDir, item.newName)
		console.log('copy - start', src, dest)

		var inp = fs.createReadStream(src)
		inp.on('error', reject)
		var out = fs.createWriteStream(dest)
		out.on('finish', function () {
			console.log('copy - end', src, dest)
			resolve(item)
		})
		inp.pipe(out)
	})
}
var uploadItem = function(item) {
	return new Promise(function (resolve, reject) {
		upload(path.resolve(uploadDir,item.newName), item.newName)
		.then(function () {
			resolve(item)
		})
		.catch(reject)
	})
}
var processList = function(list) {
	var promises = list.map(function(item) {
		return processItem(item)
	})
	return Promise.all(promises)
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
				resolve(tools)
				// Only the latest
				/*if(tools.length){
					resolve([tools[tools.length-1]])
				}
				resolve([])*/
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

				Object.keys(hostMap).forEach(function(plaform){
					Object.keys(hostMap[plaform]).forEach(function(arch){
						var token = findOneObjectByKey(tool.systems, 'host', hostMap[plaform][arch])
						flatList.push({
							url: token.url,
							dest: token.archiveFileName,
							newName: [toolName.replace(/-/g, '_'), toolVersion, plaform, arch].join('-') + '.tar.gz',
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
			})
			/*.filter(function(tag, index){
				if(index < 1) return true
			})*/
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
				Object.keys(hostMap).forEach(function(plaform){
					Object.keys(hostMap[plaform]).forEach(function(arch){
						var filename = 'arduino-builder-' + hostMap[plaform][arch].slug + '-' + version + '.' + hostMap[plaform][arch].ext
						flatList.push({
							url: 'http://downloads.arduino.cc/tools/' + filename,
							dest: filename,
							newName: ['arduino_builder', version, plaform, arch].join('-') + '.tar.gz'
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
var findIndexesByKey = function(list, path, value) {
	var result = []
	if(!list || !list.length){
		return result
	}

	for (var i = 0; i < list.length; i++) {
		if(getDeep(list[i], path) === value){
			result.push(i)
		}
	}
	return result
}
var findObjectsByKey = function(list, path, value) {
	var indexes = findIndexesByKey(list, path, value)
	return	indexes.map(function(index){
		return list[index]
	})
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
exports.download = download
exports.upload = upload
exports.extractTarBz2 = extractTarBz2
exports.extractTarZip = extractTarZip

exports.clear = clear
exports.processItem = processItem
exports.downloadItem = downloadItem
exports.extractItem = extractItem
exports.compressItem = compressItem
exports.processList = processList

exports.extractToolsFromPackage = extractToolsFromPackage
exports.extractFlatListFromTools = extractFlatListFromTools

exports.extractLatestTagsFromReleases = extractLatestTagsFromReleases
exports.extractFlatListFromTags = extractFlatListFromTags

exports.getDeep = getDeep
exports.findIndexesByKey = findIndexesByKey
exports.findObjectsByKey = findObjectsByKey
exports.findOneIndexByKey = findOneIndexByKey
exports.findOneObjectByKey = findOneObjectByKey
