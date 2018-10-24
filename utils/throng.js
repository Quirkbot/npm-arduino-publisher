const cluster = require('cluster')
const EventEmitter = require('events').EventEmitter
const cpuCount = require('os').cpus().length

	const DEFAULT_OPTIONS = {
	workers  : cpuCount,
	lifetime : Infinity,
	grace    : 5000
}

const NOOP = () => {}

module.exports = (options) => {
	const opts = {
		...DEFAULT_OPTIONS,
		...options
	}
	let startFn = opts.start
	let masterFn = opts.master || NOOP

	if (typeof startFn !== 'function') {
		throw new Error('Start function required');
	}
	if (cluster.isWorker) {
		return startFn(cluster.worker.id)
	}

	let emitter = new EventEmitter()
	let running = true
	let runUntil = Date.now() + opts.lifetime

	listen()
	masterFn()
	fork()

	function listen() {
		cluster.on('exit', revive)
		emitter.once('shutdown', shutdown)
		process
			.on('SIGINT', proxySignal)
			.on('SIGTERM', proxySignal)
	}

	function fork() {
		for (var i = 0; i < opts.workers; i++) {
			cluster.fork()
		}
	}

	function proxySignal() {
		emitter.emit('shutdown')
	}

	function shutdown() {
		running = false
		for (var id in cluster.workers) {
			cluster.workers[id].process.kill()
		}
		setTimeout(forceKill, opts.grace).unref()
	}

	function revive(worker, code, signal) {
		if (running && Date.now() < runUntil) cluster.fork()
	}

	function forceKill() {
		for (var id in cluster.workers) {
			cluster.workers[id].kill()
		}
		process.exit()
	}
}
