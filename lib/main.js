// this exports a "masked" version of the WrapUp class.

var WrapUp = require("./wrapup")

module.exports = function(){
	return new WrapUp()
}
