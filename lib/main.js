// this exports a masked version of the WrapUp class.

var WrapUp = require("./wrapup")

var mask = function(){

	var wrup = new WrapUp

	this.up = this.toString = function(){
		return wrup.up.apply(wrup, arguments)
	}

	this.package = function(){
		wrup.package.apply(wrup, arguments)
		return this
	}

	this.module = function(){
		wrup.module.apply(wrup, arguments)
		return this
	}
}

module.exports = function(){
	return new mask()
}
