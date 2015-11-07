var path = require('path');
var fs = require('fs');
var fstream = require("fstream")
var request = require('request');
var Downloader = require('mt-files-downloader');
var Bunzip = require('seek-bzip');
var tarFs = require('tar-fs');
var tar = require('tar');
var unzip = require('unzip');
var zlib = require('zlib');
var s3 = require('s3');
var execSync = require('child_process').execSync;
var downloader = new Downloader();
var s3Client = s3.createClient({
	s3Options: {
		accessKeyId: process.env.S3_ACCESS_KEY_ID,
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
	}
});
var downloadDir = '.downloads';
var uploadDir = '.uploads';

var pass = function () {
	var payload = arguments;
	return new Promise(function (resolve) {
		resolve.apply(this, payload);
	});
}
var get = function(url) {
	return new Promise(function (resolve, reject) {
		request({
				url :url,
				headers: {
					'User-Agent': 'bogus'
				}
			},function (error, response, body) {
			if (!error && response.statusCode == 200) {
				resolve(body);
			}
			else{
				reject(error);
			}
		});
	});
}
var download = function (url, dest, port, method) {
	return new Promise(function (resolve, reject) {

		var dl = downloader.download(url, dest);
		dl.setRetryOptions({
			maxRetries: 3,		// Default: 5
			retryInterval: 1000 // Default: 2000
		});

		// Optional, set download options
		dl.setOptions({
			threadsCount: 5, // Default: 2, Set the total number of download threads
			method: method,	  // Default: GET, HTTP method
			port: port,		  // Default: 80, HTTP port
			timeout: 5000,   // Default: 5000, If no data is received, the download times out (milliseconds)
			range: '0-100',  // Default: 0-100, Control the part of file that needs to be downloaded.
		});

		// Called when the download will start
		dl.on('start', function() {
			console.log('download - start - ' + url + ' >> ' + dest);
		});

		// Called in case of error
		dl.on('error', function() {
			console.log('download - error - ' + url + ' >> ' + dest);
			console.log(dl.error);
			reject(dl.error)
		});

		// Called when the download is finished
		dl.on('end', function() {
			console.log('download - end - ' + url + ' >> ' + dest);
			resolve(dest)
		});

		// Start the download
		dl.start();
	});
}
var upload = function (src, dest, method) {
	return new Promise(function (resolve, reject) {
		var params = {
			localFile: src,
			s3Params: {
				Bucket: process.env.S3_BUCKET,
				Key: dest
			}
		};
		var uploader = s3Client.uploadFile(params);
		console.log('upload - start - ' + src);
		uploader.on('error', function(err) {
			console.log('upload - error - ' + src);
			reject(err);
		});

		uploader.on('end', function() {
			console.log('upload - end - ' + src);
			resolve();
		});
	});
}
var extractTarBz2 = function (src, dest) {
	return new Promise(function (resolve, reject) {
		console.log('extractTarBz2 - start', src, dest);
		// Uncompress
		var compressedData = fs.readFileSync(src);
		var data = Bunzip.decode(compressedData);
		fs.writeFileSync(dest + '.temptar', data);

		// Untar
		// We need a useless nested path, as node-pre-gyp will skip the first level
		var extractor = tar.Extract({path: __dirname + '/' + dest + '_temp/dummy', strip: 0})
		.on('error', reject)
		.on('end', function () {
			var writeStrem = fs.createWriteStream(dest)
			writeStrem.on('finish', function () {
				console.log('extractTarBz2 - end', src, dest);
				resolve();
			});
			writeStrem.on('error', reject);
			tarFs.pack(dest + '_temp').pipe(writeStrem);
		});

		fs.createReadStream(dest + '.temptar')
		.on('error', reject)
		.pipe(extractor);
	});
}
var extractTarZip = function (src, dest) {
	return new Promise(function (resolve, reject) {
		console.log('extractTarZip - start', src, dest);
		// We need a useless nested path, as node-pre-gyp will skip the first level
		var tempDest = dest + '_temp/dummy';
		var readStream = fs.createReadStream(src);
		readStream.pipe(unzip.Extract({ path: dest + '_temp/dummy'}))
		readStream.on('end', function(){
			var writeStrem = fs.createWriteStream(dest)
			writeStrem.on('finish', function () {
				console.log('extractTarZip - end', src, dest);
				resolve();
			});
			writeStrem.on('error', reject);
			tarFs.pack(dest + '_temp').pipe(writeStrem);
		});
		readStream.on('error', reject);
	});
}
var gzip = function (src, dest) {
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
}

var clear = function () {
	var payload = arguments;
	return new Promise(function (resolve, reject) {
		execSync('rm -r ' + downloadDir + '; mkdir ' + downloadDir);
		execSync('rm -r ' + uploadDir + '; mkdir ' + uploadDir);
		resolve.apply(this, payload);
	});
}

var processItem = function(item) {
	return new Promise(function (resolve, reject) {
		downloadItem(item)
		.then(extractItem)
		.then(compressItem)
		.then(uploadItem)
		.then(resolve)
		.catch(reject);
	});
}
var downloadItem = function(item) {
	return new Promise(function (resolve, reject) {
		download(item.url, downloadDir + '/' + item.dest)
		.then(function () {
			resolve(item)
		})
		.catch(reject);
	});
}
var extractItem = function(item) {
	return new Promise(function (resolve, reject) {
		var func;
		if(item.dest.indexOf('.tar.bz2') !== -1){
			func = extractTarBz2;
		}
		else if (item.dest.indexOf('.zip') !== -1){
			func = extractTarZip;
		}
		if(func){
			func(downloadDir + '/' + item.dest, downloadDir + '/' + item.dest  + '.tar')
			.then(function () {
				resolve(item)
			})
			.catch(reject);
		}
		else {
			reject('Cannot extract this extension.');
		}

	});
}
var compressItem = function(item) {
	return new Promise(function (resolve, reject) {
		gzip(downloadDir + '/' + item.dest  + '.tar', uploadDir + '/' + item.newName)
		.then(function () {
			resolve(item)
		})
		.catch(reject)
	});
}
var uploadItem = function(item) {
	return new Promise(function (resolve, reject) {
		upload(uploadDir + '/' + item.newName, item.newName)
		.then(function () {
			resolve(item)
		})
		.catch(reject);
	});
}
var processList = function(list) {
	var promises = list.map(function(item) {
		return processItem(item)
	});
	return Promise.all(promises)
}

var extractToolsFromPackage = function (toolsNames) {
	return function (rawPackage) {
		return new Promise(function(resolve, reject){
			var index = JSON.parse(rawPackage);
			var arduino;
			var tools;
			if(index.packages){
				index.packages.forEach(function (package) {
					if(package.name === 'arduino'){
						arduino = package;
					}
				})
			}
			if(arduino.tools){
				tools = arduino.tools.filter(function(tool) {
					if(tool.name === toolsNames){
						return true;
					}
				})
			}
			if(tools){
				resolve(tools);
			}
			else{
				reject('Could not extract tool');
			}

		});
	}
}
var extractFlatListFromTools = function (hostMap) {
	return function (tools) {
		return new Promise(function(resolve, reject){
			var flatList = [];
			tools.forEach(function(tool){
				var toolName = tool.name;
				var version = tool.version

				Object.keys(hostMap).forEach(function(plaform){
					Object.keys(hostMap[plaform]).forEach(function(arch){
						var token = findOneObjectByKey(tool.systems, 'host', hostMap[plaform][arch]);
						flatList.push({
							url: token.url,
							dest: token.archiveFileName,
							newName: [toolName.replace(/-/g, '_'), version, plaform, arch].join('-') + '.tar.bz'
						})
					});
				});
			});
			resolve(flatList);
		});
	}
}

var extractLatestTagsFromReleases = function(rawReleases) {
	return new Promise(function(resolve, reject){
		try{
			var releases = JSON.parse(rawReleases)
			.map(function(item){
				return item['tag_name'];
			})
			.filter(function(tag, index){
				if(index < 3) return true;
			});
			resolve(releases);
		}
		catch (e){
			reject(e);
		}

	});
}
var extractFlatListFromTags = function (hostMap) {
	return function (versions) {
		return new Promise(function(resolve, reject){
			var flatList = [];
			versions.forEach(function (version) {
				Object.keys(hostMap).forEach(function(plaform){
					Object.keys(hostMap[plaform]).forEach(function(arch){
						var filename = 'arduino-builder-' + hostMap[plaform][arch].slug + '-' + version + '.' + hostMap[plaform][arch].ext;
						flatList.push({
							url: 'http://downloads.arduino.cc/tools/' + filename,
							dest: filename,
							newName: ['arduino_builder', version, plaform, arch].join('-') + '.tar.bz'
						})
					});
				});
			});
			resolve(flatList);
		});
	}
}

var getDeep = function(object, path){
	try{
		var paths = path.split('.');
		var current = object;
		var i;

		for (i = 0; i < paths.length; ++i) {
			if (current[paths[i]] === undefined) {
				return;
			} else {
				current = current[paths[i]];
			}
		}
		return current;
	}
	catch(e){
		return;
	}
}
var findIndexesByKey = function(list, path, value) {
	var result = [];
		if(!list || !list.length){
			return result;
		}

		for (var i = 0; i < list.length; i++) {
			if(getDeep(list[i], path) === value){
				result.push(i);
			}
		}
		return result;
}
var findObjectsByKey = function(list, path, value) {
	var indexes = findIndexesByKey(list, path, value);
	return	indexes.map(function(index){
		return list[index];
	});
}
var findOneIndexByKey = function(list, path, value) {
	if(!list || !list.length){
		return -1;
	}

	for (var i = 0; i < list.length; i++) {
		if(getDeep(list[i], path) === value){
			return i;
		}
	}
	return -1;
}
var findOneObjectByKey = function(list, path, value) {
	if(!list || !list.length){
		return;
	}
	var index = findOneIndexByKey(list, path, value);
	return	list[index];
}

exports.pass = pass;
exports.get = get;
exports.download = download;
exports.upload = upload;
exports.extractTarBz2 = extractTarBz2;
exports.extractTarZip = extractTarZip;
exports.gzip = gzip;

exports.clear = clear;
exports.processItem = processItem;
exports.downloadItem = downloadItem;
exports.extractItem = extractItem;
exports.compressItem = compressItem;
exports.processList = processList;

exports.extractToolsFromPackage = extractToolsFromPackage;
exports.extractFlatListFromTools = extractFlatListFromTools;

exports.extractLatestTagsFromReleases = extractLatestTagsFromReleases;
exports.extractFlatListFromTags = extractFlatListFromTags;

exports.getDeep = getDeep;
exports.findIndexesByKey = findIndexesByKey;
exports.findObjectsByKey = findObjectsByKey;
exports.findOneIndexByKey = findOneIndexByKey;
exports.findOneObjectByKey = findOneObjectByKey;
