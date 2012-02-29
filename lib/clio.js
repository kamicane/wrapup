// clio: a smartly stupid command line helper
// inspired by commander.js

module.exports = function(){

	return new (function(){

		var spc = function(num){
			var str = ""
			for (var i = 0; i < num; i++) str += " "
			return str
		}

		var shortcuts = {},
			rshortcuts = {},
			options = {},
			parsers = {}

		this.option = function(mm, m, msg, parse){
			options[mm] = msg
			shortcuts[m] = mm
			parsers[mm] = parse
			rshortcuts[mm] = m

			return this
		}

		this.help = function(indent){
			if (indent == null) indent = 2
			indent = spc(indent)
			var helpstring = ""

			var commands = []

			for (var option in options){
				var shortcut = rshortcuts[option]
				if (shortcut) option += ", " + shortcut
				commands.push(option)
			}

			var lengths = commands.map(function(i){
				return i.length
			})

			var max = Math.max.apply(Math, lengths), i = 0

			for (var option in options){
				var usage = options[option], command = commands[i]
				helpstring += indent + command + spc(max - command.length) + " : " + usage + "\n"
				i++
			}
			
			return helpstring
		}

		this.parse = function(args){
			var commands, command

			args.forEach(function(arg){
				if (arg.indexOf("-") == 0){
					var shortcut = shortcuts[arg]
					if (shortcut) arg = shortcuts[arg]
					if (!options[arg]) return
					command = arg
					if (!commands) commands = {}
					commands[command] || (commands[command] = [])
				} else if (command){
					commands[command].push(arg)
				}
			})

			var parsed = null

			for (command in commands){
				if (!parsed) parsed = {}
				parsed[command.replace('--', '')] = parsers[command].apply(null, commands[command])
			}

			return parsed
		}

	})
	
}