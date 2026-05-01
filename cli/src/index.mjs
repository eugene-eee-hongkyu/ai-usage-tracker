#!/usr/bin/env node
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// ../node_modules/commander/index.js
var require_commander = __commonJS((exports, module) => {
  var EventEmitter = __require("events").EventEmitter;
  var spawn = __require("child_process").spawn;
  var path = __require("path");
  var dirname = path.dirname;
  var basename = path.basename;
  var fs = __require("fs");
  __require("util").inherits(Command, EventEmitter);
  exports = module.exports = new Command;
  exports.Command = Command;
  exports.Option = Option;
  function Option(flags, description) {
    this.flags = flags;
    this.required = flags.indexOf("<") >= 0;
    this.optional = flags.indexOf("[") >= 0;
    this.mandatory = false;
    this.negate = flags.indexOf("-no-") !== -1;
    flags = flags.split(/[ ,|]+/);
    if (flags.length > 1 && !/^[[<]/.test(flags[1]))
      this.short = flags.shift();
    this.long = flags.shift();
    this.description = description || "";
  }
  Option.prototype.name = function() {
    return this.long.replace(/^--/, "");
  };
  Option.prototype.attributeName = function() {
    return camelcase(this.name().replace(/^no-/, ""));
  };
  Option.prototype.is = function(arg) {
    return this.short === arg || this.long === arg;
  };

  class CommanderError extends Error {
    constructor(exitCode, code, message) {
      super(message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.code = code;
      this.exitCode = exitCode;
    }
  }
  exports.CommanderError = CommanderError;
  function Command(name) {
    this.commands = [];
    this.options = [];
    this._execs = new Set;
    this._allowUnknownOption = false;
    this._args = [];
    this._name = name || "";
    this._optionValues = {};
    this._storeOptionsAsProperties = true;
    this._passCommandToAction = true;
    this._actionResults = [];
    this._helpFlags = "-h, --help";
    this._helpDescription = "output usage information";
    this._helpShortFlag = "-h";
    this._helpLongFlag = "--help";
  }
  Command.prototype.command = function(nameAndArgs, actionOptsOrExecDesc, execOpts) {
    var desc = actionOptsOrExecDesc;
    var opts = execOpts;
    if (typeof desc === "object" && desc !== null) {
      opts = desc;
      desc = null;
    }
    opts = opts || {};
    var args = nameAndArgs.split(/ +/);
    var cmd = new Command(args.shift());
    if (desc) {
      cmd.description(desc);
      this.executables = true;
      this._execs.add(cmd._name);
      if (opts.isDefault)
        this.defaultExecutable = cmd._name;
    }
    cmd._noHelp = !!opts.noHelp;
    cmd._helpFlags = this._helpFlags;
    cmd._helpDescription = this._helpDescription;
    cmd._helpShortFlag = this._helpShortFlag;
    cmd._helpLongFlag = this._helpLongFlag;
    cmd._exitCallback = this._exitCallback;
    cmd._storeOptionsAsProperties = this._storeOptionsAsProperties;
    cmd._passCommandToAction = this._passCommandToAction;
    cmd._executableFile = opts.executableFile;
    this.commands.push(cmd);
    cmd.parseExpectedArgs(args);
    cmd.parent = this;
    if (desc)
      return this;
    return cmd;
  };
  Command.prototype.arguments = function(desc) {
    return this.parseExpectedArgs(desc.split(/ +/));
  };
  Command.prototype.addImplicitHelpCommand = function() {
    this.command("help [cmd]", "display help for [cmd]");
  };
  Command.prototype.parseExpectedArgs = function(args) {
    if (!args.length)
      return;
    var self = this;
    args.forEach(function(arg) {
      var argDetails = {
        required: false,
        name: "",
        variadic: false
      };
      switch (arg[0]) {
        case "<":
          argDetails.required = true;
          argDetails.name = arg.slice(1, -1);
          break;
        case "[":
          argDetails.name = arg.slice(1, -1);
          break;
      }
      if (argDetails.name.length > 3 && argDetails.name.slice(-3) === "...") {
        argDetails.variadic = true;
        argDetails.name = argDetails.name.slice(0, -3);
      }
      if (argDetails.name) {
        self._args.push(argDetails);
      }
    });
    return this;
  };
  Command.prototype.exitOverride = function(fn) {
    if (fn) {
      this._exitCallback = fn;
    } else {
      this._exitCallback = function(err) {
        if (err.code !== "commander.executeSubCommandAsync") {
          throw err;
        } else {}
      };
    }
    return this;
  };
  Command.prototype._exit = function(exitCode, code, message) {
    if (this._exitCallback) {
      this._exitCallback(new CommanderError(exitCode, code, message));
    }
    process.exit(exitCode);
  };
  Command.prototype.action = function(fn) {
    var self = this;
    var listener = function(args, unknown) {
      args = args || [];
      unknown = unknown || [];
      var parsed = self.parseOptions(unknown);
      outputHelpIfRequested(self, parsed.unknown);
      self._checkForMissingMandatoryOptions();
      if (parsed.unknown.length > 0) {
        self.unknownOption(parsed.unknown[0]);
      }
      if (parsed.args.length)
        args = parsed.args.concat(args);
      self._args.forEach(function(arg, i) {
        if (arg.required && args[i] == null) {
          self.missingArgument(arg.name);
        } else if (arg.variadic) {
          if (i !== self._args.length - 1) {
            self.variadicArgNotLast(arg.name);
          }
          args[i] = args.splice(i);
        }
      });
      var expectedArgsCount = self._args.length;
      var actionArgs = args.slice(0, expectedArgsCount);
      if (self._passCommandToAction) {
        actionArgs[expectedArgsCount] = self;
      } else {
        actionArgs[expectedArgsCount] = self.opts();
      }
      if (args.length > expectedArgsCount) {
        actionArgs.push(args.slice(expectedArgsCount));
      }
      const actionResult = fn.apply(self, actionArgs);
      let rootCommand = self;
      while (rootCommand.parent) {
        rootCommand = rootCommand.parent;
      }
      rootCommand._actionResults.push(actionResult);
    };
    var parent = this.parent || this;
    var name = parent === this ? "*" : this._name;
    parent.on("command:" + name, listener);
    if (this._alias)
      parent.on("command:" + this._alias, listener);
    return this;
  };
  Command.prototype._optionEx = function(config, flags, description, fn, defaultValue) {
    var self = this, option = new Option(flags, description), oname = option.name(), name = option.attributeName();
    option.mandatory = !!config.mandatory;
    if (typeof fn !== "function") {
      if (fn instanceof RegExp) {
        var regex = fn;
        fn = function(val, def) {
          var m = regex.exec(val);
          return m ? m[0] : def;
        };
      } else {
        defaultValue = fn;
        fn = null;
      }
    }
    if (option.negate || option.optional || option.required || typeof defaultValue === "boolean") {
      if (option.negate) {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        defaultValue = self.optionFor(positiveLongFlag) ? self._getOptionValue(name) : true;
      }
      if (defaultValue !== undefined) {
        self._setOptionValue(name, defaultValue);
        option.defaultValue = defaultValue;
      }
    }
    this.options.push(option);
    this.on("option:" + oname, function(val) {
      if (val !== null && fn) {
        val = fn(val, self._getOptionValue(name) === undefined ? defaultValue : self._getOptionValue(name));
      }
      if (typeof self._getOptionValue(name) === "boolean" || typeof self._getOptionValue(name) === "undefined") {
        if (val == null) {
          self._setOptionValue(name, option.negate ? false : defaultValue || true);
        } else {
          self._setOptionValue(name, val);
        }
      } else if (val !== null) {
        self._setOptionValue(name, option.negate ? false : val);
      }
    });
    return this;
  };
  Command.prototype.option = function(flags, description, fn, defaultValue) {
    return this._optionEx({}, flags, description, fn, defaultValue);
  };
  Command.prototype.requiredOption = function(flags, description, fn, defaultValue) {
    return this._optionEx({ mandatory: true }, flags, description, fn, defaultValue);
  };
  Command.prototype.allowUnknownOption = function(arg) {
    this._allowUnknownOption = arguments.length === 0 || arg;
    return this;
  };
  Command.prototype.storeOptionsAsProperties = function(value) {
    this._storeOptionsAsProperties = value === undefined || value;
    if (this.options.length) {
      console.error("Commander usage error: call storeOptionsAsProperties before adding options");
    }
    return this;
  };
  Command.prototype.passCommandToAction = function(value) {
    this._passCommandToAction = value === undefined || value;
    return this;
  };
  Command.prototype._setOptionValue = function(key, value) {
    if (this._storeOptionsAsProperties) {
      this[key] = value;
    } else {
      this._optionValues[key] = value;
    }
  };
  Command.prototype._getOptionValue = function(key) {
    if (this._storeOptionsAsProperties) {
      return this[key];
    }
    return this._optionValues[key];
  };
  Command.prototype.parse = function(argv) {
    if (this.executables)
      this.addImplicitHelpCommand();
    this.rawArgs = argv;
    this._name = this._name || basename(argv[1], ".js");
    if (this.executables && argv.length < 3 && !this.defaultExecutable) {
      argv.push(this._helpLongFlag);
    }
    var normalized = this.normalize(argv.slice(2));
    var parsed = this.parseOptions(normalized);
    var args = this.args = parsed.args;
    var result = this.parseArgs(this.args, parsed.unknown);
    if (args[0] === "help" && args.length === 1)
      this.help();
    if (args[0] === "help") {
      args[0] = args[1];
      args[1] = this._helpLongFlag;
    } else {
      this._checkForMissingMandatoryOptions();
    }
    var name = result.args[0];
    var subCommand = null;
    if (name) {
      subCommand = this.commands.find(function(command) {
        return command._name === name;
      });
    }
    if (!subCommand && name) {
      subCommand = this.commands.find(function(command) {
        return command.alias() === name;
      });
      if (subCommand) {
        name = subCommand._name;
        args[0] = name;
      }
    }
    if (!subCommand && this.defaultExecutable) {
      name = this.defaultExecutable;
      args.unshift(name);
      subCommand = this.commands.find(function(command) {
        return command._name === name;
      });
    }
    if (this._execs.has(name)) {
      return this.executeSubCommand(argv, args, parsed.unknown, subCommand ? subCommand._executableFile : undefined);
    }
    return result;
  };
  Command.prototype.parseAsync = function(argv) {
    this.parse(argv);
    return Promise.all(this._actionResults);
  };
  Command.prototype.executeSubCommand = function(argv, args, unknown, executableFile) {
    args = args.concat(unknown);
    if (!args.length)
      this.help();
    var isExplicitJS = false;
    var pm = argv[1];
    var bin = basename(pm, path.extname(pm)) + "-" + args[0];
    if (executableFile != null) {
      bin = executableFile;
      var executableExt = path.extname(executableFile);
      isExplicitJS = executableExt === ".js" || executableExt === ".ts" || executableExt === ".mjs";
    }
    var baseDir;
    var resolvedLink = fs.realpathSync(pm);
    baseDir = dirname(resolvedLink);
    var localBin = path.join(baseDir, bin);
    if (exists(localBin + ".js")) {
      bin = localBin + ".js";
      isExplicitJS = true;
    } else if (exists(localBin + ".ts")) {
      bin = localBin + ".ts";
      isExplicitJS = true;
    } else if (exists(localBin + ".mjs")) {
      bin = localBin + ".mjs";
      isExplicitJS = true;
    } else if (exists(localBin)) {
      bin = localBin;
    }
    args = args.slice(1);
    var proc;
    if (process.platform !== "win32") {
      if (isExplicitJS) {
        args.unshift(bin);
        args = incrementNodeInspectorPort(process.execArgv).concat(args);
        proc = spawn(process.argv[0], args, { stdio: "inherit" });
      } else {
        proc = spawn(bin, args, { stdio: "inherit" });
      }
    } else {
      args.unshift(bin);
      args = incrementNodeInspectorPort(process.execArgv).concat(args);
      proc = spawn(process.execPath, args, { stdio: "inherit" });
    }
    var signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
    signals.forEach(function(signal) {
      process.on(signal, function() {
        if (proc.killed === false && proc.exitCode === null) {
          proc.kill(signal);
        }
      });
    });
    const exitCallback = this._exitCallback;
    if (!exitCallback) {
      proc.on("close", process.exit.bind(process));
    } else {
      proc.on("close", () => {
        exitCallback(new CommanderError(process.exitCode || 0, "commander.executeSubCommandAsync", "(close)"));
      });
    }
    proc.on("error", function(err) {
      if (err.code === "ENOENT") {
        console.error("error: %s(1) does not exist, try --help", bin);
      } else if (err.code === "EACCES") {
        console.error("error: %s(1) not executable. try chmod or run with root", bin);
      }
      if (!exitCallback) {
        process.exit(1);
      } else {
        const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
        wrappedError.nestedError = err;
        exitCallback(wrappedError);
      }
    });
    this.runningCommand = proc;
  };
  Command.prototype.normalize = function(args) {
    var ret = [], arg, lastOpt, index, short, opt;
    for (var i = 0, len = args.length;i < len; ++i) {
      arg = args[i];
      if (i > 0) {
        lastOpt = this.optionFor(args[i - 1]);
      }
      if (arg === "--") {
        ret = ret.concat(args.slice(i));
        break;
      } else if (lastOpt && lastOpt.required) {
        ret.push(arg);
      } else if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
        short = arg.slice(0, 2);
        opt = this.optionFor(short);
        if (opt && (opt.required || opt.optional)) {
          ret.push(short);
          ret.push(arg.slice(2));
        } else {
          arg.slice(1).split("").forEach(function(c) {
            ret.push("-" + c);
          });
        }
      } else if (/^--/.test(arg) && ~(index = arg.indexOf("="))) {
        ret.push(arg.slice(0, index), arg.slice(index + 1));
      } else {
        ret.push(arg);
      }
    }
    return ret;
  };
  Command.prototype.parseArgs = function(args, unknown) {
    var name;
    if (args.length) {
      name = args[0];
      if (this.listeners("command:" + name).length) {
        this.emit("command:" + args.shift(), args, unknown);
      } else {
        this.emit("command:*", args, unknown);
      }
    } else {
      outputHelpIfRequested(this, unknown);
      if (unknown.length > 0 && !this.defaultExecutable) {
        this.unknownOption(unknown[0]);
      }
      if (this.commands.length === 0 && this._args.filter(function(a) {
        return a.required;
      }).length === 0) {
        this.emit("command:*");
      }
    }
    return this;
  };
  Command.prototype.optionFor = function(arg) {
    for (var i = 0, len = this.options.length;i < len; ++i) {
      if (this.options[i].is(arg)) {
        return this.options[i];
      }
    }
  };
  Command.prototype._checkForMissingMandatoryOptions = function() {
    for (var cmd = this;cmd; cmd = cmd.parent) {
      cmd.options.forEach((anOption) => {
        if (anOption.mandatory && cmd._getOptionValue(anOption.attributeName()) === undefined) {
          cmd.missingMandatoryOptionValue(anOption);
        }
      });
    }
  };
  Command.prototype.parseOptions = function(argv) {
    var args = [], len = argv.length, literal, option, arg;
    var unknownOptions = [];
    for (var i = 0;i < len; ++i) {
      arg = argv[i];
      if (literal) {
        args.push(arg);
        continue;
      }
      if (arg === "--") {
        literal = true;
        continue;
      }
      option = this.optionFor(arg);
      if (option) {
        if (option.required) {
          arg = argv[++i];
          if (arg == null)
            return this.optionMissingArgument(option);
          this.emit("option:" + option.name(), arg);
        } else if (option.optional) {
          arg = argv[i + 1];
          if (arg == null || arg[0] === "-" && arg !== "-") {
            arg = null;
          } else {
            ++i;
          }
          this.emit("option:" + option.name(), arg);
        } else {
          this.emit("option:" + option.name());
        }
        continue;
      }
      if (arg.length > 1 && arg[0] === "-") {
        unknownOptions.push(arg);
        if (i + 1 < argv.length && (argv[i + 1][0] !== "-" || argv[i + 1] === "-")) {
          unknownOptions.push(argv[++i]);
        }
        continue;
      }
      args.push(arg);
    }
    return { args, unknown: unknownOptions };
  };
  Command.prototype.opts = function() {
    if (this._storeOptionsAsProperties) {
      var result = {}, len = this.options.length;
      for (var i = 0;i < len; i++) {
        var key = this.options[i].attributeName();
        result[key] = key === this._versionOptionName ? this._version : this[key];
      }
      return result;
    }
    return this._optionValues;
  };
  Command.prototype.missingArgument = function(name) {
    const message = `error: missing required argument '${name}'`;
    console.error(message);
    this._exit(1, "commander.missingArgument", message);
  };
  Command.prototype.optionMissingArgument = function(option, flag) {
    let message;
    if (flag) {
      message = `error: option '${option.flags}' argument missing, got '${flag}'`;
    } else {
      message = `error: option '${option.flags}' argument missing`;
    }
    console.error(message);
    this._exit(1, "commander.optionMissingArgument", message);
  };
  Command.prototype.missingMandatoryOptionValue = function(option) {
    const message = `error: required option '${option.flags}' not specified`;
    console.error(message);
    this._exit(1, "commander.missingMandatoryOptionValue", message);
  };
  Command.prototype.unknownOption = function(flag) {
    if (this._allowUnknownOption)
      return;
    const message = `error: unknown option '${flag}'`;
    console.error(message);
    this._exit(1, "commander.unknownOption", message);
  };
  Command.prototype.variadicArgNotLast = function(name) {
    const message = `error: variadic arguments must be last '${name}'`;
    console.error(message);
    this._exit(1, "commander.variadicArgNotLast", message);
  };
  Command.prototype.version = function(str, flags, description) {
    if (arguments.length === 0)
      return this._version;
    this._version = str;
    flags = flags || "-V, --version";
    description = description || "output the version number";
    var versionOption = new Option(flags, description);
    this._versionOptionName = versionOption.long.substr(2) || "version";
    this.options.push(versionOption);
    var self = this;
    this.on("option:" + this._versionOptionName, function() {
      process.stdout.write(str + `
`);
      self._exit(0, "commander.version", str);
    });
    return this;
  };
  Command.prototype.description = function(str, argsDescription) {
    if (arguments.length === 0)
      return this._description;
    this._description = str;
    this._argsDescription = argsDescription;
    return this;
  };
  Command.prototype.alias = function(alias) {
    var command = this;
    if (this.commands.length !== 0) {
      command = this.commands[this.commands.length - 1];
    }
    if (arguments.length === 0)
      return command._alias;
    if (alias === command._name)
      throw new Error("Command alias can't be the same as its name");
    command._alias = alias;
    return this;
  };
  Command.prototype.usage = function(str) {
    var args = this._args.map(function(arg) {
      return humanReadableArgName(arg);
    });
    var usage = "[options]" + (this.commands.length ? " [command]" : "") + (this._args.length ? " " + args.join(" ") : "");
    if (arguments.length === 0)
      return this._usage || usage;
    this._usage = str;
    return this;
  };
  Command.prototype.name = function(str) {
    if (arguments.length === 0)
      return this._name;
    this._name = str;
    return this;
  };
  Command.prototype.prepareCommands = function() {
    return this.commands.filter(function(cmd) {
      return !cmd._noHelp;
    }).map(function(cmd) {
      var args = cmd._args.map(function(arg) {
        return humanReadableArgName(arg);
      }).join(" ");
      return [
        cmd._name + (cmd._alias ? "|" + cmd._alias : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : ""),
        cmd._description
      ];
    });
  };
  Command.prototype.largestCommandLength = function() {
    var commands = this.prepareCommands();
    return commands.reduce(function(max, command) {
      return Math.max(max, command[0].length);
    }, 0);
  };
  Command.prototype.largestOptionLength = function() {
    var options = [].slice.call(this.options);
    options.push({
      flags: this._helpFlags
    });
    return options.reduce(function(max, option) {
      return Math.max(max, option.flags.length);
    }, 0);
  };
  Command.prototype.largestArgLength = function() {
    return this._args.reduce(function(max, arg) {
      return Math.max(max, arg.name.length);
    }, 0);
  };
  Command.prototype.padWidth = function() {
    var width = this.largestOptionLength();
    if (this._argsDescription && this._args.length) {
      if (this.largestArgLength() > width) {
        width = this.largestArgLength();
      }
    }
    if (this.commands && this.commands.length) {
      if (this.largestCommandLength() > width) {
        width = this.largestCommandLength();
      }
    }
    return width;
  };
  Command.prototype.optionHelp = function() {
    var width = this.padWidth();
    var columns = process.stdout.columns || 80;
    var descriptionWidth = columns - width - 4;
    return this.options.map(function(option) {
      const fullDesc = option.description + (!option.negate && option.defaultValue !== undefined ? " (default: " + JSON.stringify(option.defaultValue) + ")" : "");
      return pad(option.flags, width) + "  " + optionalWrap(fullDesc, descriptionWidth, width + 2);
    }).concat([pad(this._helpFlags, width) + "  " + optionalWrap(this._helpDescription, descriptionWidth, width + 2)]).join(`
`);
  };
  Command.prototype.commandHelp = function() {
    if (!this.commands.length)
      return "";
    var commands = this.prepareCommands();
    var width = this.padWidth();
    var columns = process.stdout.columns || 80;
    var descriptionWidth = columns - width - 4;
    return [
      "Commands:",
      commands.map(function(cmd) {
        var desc = cmd[1] ? "  " + cmd[1] : "";
        return (desc ? pad(cmd[0], width) : cmd[0]) + optionalWrap(desc, descriptionWidth, width + 2);
      }).join(`
`).replace(/^/gm, "  "),
      ""
    ].join(`
`);
  };
  Command.prototype.helpInformation = function() {
    var desc = [];
    if (this._description) {
      desc = [
        this._description,
        ""
      ];
      var argsDescription = this._argsDescription;
      if (argsDescription && this._args.length) {
        var width = this.padWidth();
        var columns = process.stdout.columns || 80;
        var descriptionWidth = columns - width - 5;
        desc.push("Arguments:");
        desc.push("");
        this._args.forEach(function(arg) {
          desc.push("  " + pad(arg.name, width) + "  " + wrap(argsDescription[arg.name], descriptionWidth, width + 4));
        });
        desc.push("");
      }
    }
    var cmdName = this._name;
    if (this._alias) {
      cmdName = cmdName + "|" + this._alias;
    }
    var parentCmdNames = "";
    for (var parentCmd = this.parent;parentCmd; parentCmd = parentCmd.parent) {
      parentCmdNames = parentCmd.name() + " " + parentCmdNames;
    }
    var usage = [
      "Usage: " + parentCmdNames + cmdName + " " + this.usage(),
      ""
    ];
    var cmds = [];
    var commandHelp = this.commandHelp();
    if (commandHelp)
      cmds = [commandHelp];
    var options = [
      "Options:",
      "" + this.optionHelp().replace(/^/gm, "  "),
      ""
    ];
    return usage.concat(desc).concat(options).concat(cmds).join(`
`);
  };
  Command.prototype.outputHelp = function(cb) {
    if (!cb) {
      cb = function(passthru) {
        return passthru;
      };
    }
    const cbOutput = cb(this.helpInformation());
    if (typeof cbOutput !== "string" && !Buffer.isBuffer(cbOutput)) {
      throw new Error("outputHelp callback must return a string or a Buffer");
    }
    process.stdout.write(cbOutput);
    this.emit(this._helpLongFlag);
  };
  Command.prototype.helpOption = function(flags, description) {
    this._helpFlags = flags || this._helpFlags;
    this._helpDescription = description || this._helpDescription;
    var splitFlags = this._helpFlags.split(/[ ,|]+/);
    if (splitFlags.length > 1)
      this._helpShortFlag = splitFlags.shift();
    this._helpLongFlag = splitFlags.shift();
    return this;
  };
  Command.prototype.help = function(cb) {
    this.outputHelp(cb);
    this._exit(process.exitCode || 0, "commander.help", "(outputHelp)");
  };
  function camelcase(flag) {
    return flag.split("-").reduce(function(str, word) {
      return str + word[0].toUpperCase() + word.slice(1);
    });
  }
  function pad(str, width) {
    var len = Math.max(0, width - str.length);
    return str + Array(len + 1).join(" ");
  }
  function wrap(str, width, indent) {
    var regex = new RegExp(".{1," + (width - 1) + "}([\\s​]|$)|[^\\s​]+?([\\s​]|$)", "g");
    var lines = str.match(regex) || [];
    return lines.map(function(line, i) {
      if (line.slice(-1) === `
`) {
        line = line.slice(0, line.length - 1);
      }
      return (i > 0 && indent ? Array(indent + 1).join(" ") : "") + line.trimRight();
    }).join(`
`);
  }
  function optionalWrap(str, width, indent) {
    if (str.match(/[\n]\s+/))
      return str;
    const minWidth = 40;
    if (width < minWidth)
      return str;
    return wrap(str, width, indent);
  }
  function outputHelpIfRequested(cmd, options) {
    options = options || [];
    for (var i = 0;i < options.length; i++) {
      if (options[i] === cmd._helpLongFlag || options[i] === cmd._helpShortFlag) {
        cmd.outputHelp();
        cmd._exit(0, "commander.helpDisplayed", "(outputHelp)");
      }
    }
  }
  function humanReadableArgName(arg) {
    var nameOutput = arg.name + (arg.variadic === true ? "..." : "");
    return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
  }
  function exists(file) {
    try {
      if (fs.statSync(file).isFile()) {
        return true;
      }
    } catch (e) {
      return false;
    }
  }
  function incrementNodeInspectorPort(args) {
    return args.map((arg) => {
      var result = arg;
      if (arg.indexOf("--inspect") === 0) {
        var debugOption;
        var debugHost = "127.0.0.1";
        var debugPort = "9229";
        var match;
        if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
          debugOption = match[1];
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
          debugOption = match[1];
          if (/^\d+$/.test(match[3])) {
            debugPort = match[3];
          } else {
            debugHost = match[3];
          }
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
          debugOption = match[1];
          debugHost = match[3];
          debugPort = match[4];
        }
        if (debugOption && debugPort !== "0") {
          result = `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
        }
      }
      return result;
    });
  }
});

// src/index.ts
var import_commander = __toESM(require_commander(), 1);

// src/init.ts
import { execSync, spawn, spawnSync } from "child_process";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";
var __dirname2 = path.dirname(fileURLToPath(import.meta.url));
var SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";
var KEYTAR_SERVICE = "primus-usage-tracker";
var KEYTAR_ACCOUNT = "api-key";
var CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
var STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
var STABLE_SUBMIT = path.join(STABLE_DIR, "submit.mjs");
var CLI_PORT = 9988;
async function getKeytar() {
  try {
    const kt = await import("keytar");
    return kt.default ?? kt;
  } catch {
    return null;
  }
}
async function saveApiKey(apiKey) {
  const keytar = await getKeytar();
  if (keytar) {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, apiKey);
  }
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  fs.writeFileSync(fallbackPath, apiKey, { mode: 384 });
}
async function loadApiKey() {
  const keytar = await getKeytar();
  if (keytar) {
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (key)
      return key;
  }
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  if (fs.existsSync(fallbackPath)) {
    return fs.readFileSync(fallbackPath, "utf8").trim();
  }
  return null;
}
async function deleteApiKey() {
  const keytar = await getKeytar();
  if (keytar) {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
  }
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  if (fs.existsSync(fallbackPath))
    fs.unlinkSync(fallbackPath);
}
function openBrowser(url) {
  try {
    const platform = process.platform;
    if (platform === "darwin")
      execSync(`open "${url}"`);
    else if (platform === "win32")
      execSync(`start "" "${url}"`);
    else
      execSync(`xdg-open "${url}"`);
  } catch {}
}
function getApiKeyViaLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${CLI_PORT}`);
      const apiKey = url.searchParams.get("apiKey");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (apiKey) {
        res.end("<html><body style='font-family:sans-serif;padding:2em'><h2>&#x2705; Authentication Complete</h2><p>You can close this window.</p></body></html>");
        server.close();
        resolve(apiKey);
      } else {
        res.end("<html><body><h2>Waiting...</h2></body></html>");
      }
    });
    server.listen(CLI_PORT, "127.0.0.1", () => {
      const authUrl = `${SERVER_URL}/api/cli-auth?port=${CLI_PORT}`;
      console.log(`
브라우저에서 GitHub 계정으로 로그인하세요...`);
      console.log(`URL: ${authUrl}
`);
      openBrowser(authUrl);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(new Error(`포트 ${CLI_PORT}가 이미 사용 중입니다. 잠시 후 다시 시도하세요.`));
      } else {
        reject(err);
      }
    });
    setTimeout(() => {
      server.close();
      reject(new Error("인증 시간 초과 (5분)"));
    }, 300000);
  });
}
function registerLaunchd(submitPath) {
  const label = "com.primus.usage-tracker.daily";
  const plistDir = path.join(os.homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(plistDir, `${label}.plist`);
  const envPath = process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin";
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${submitPath}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${envPath}</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>0</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>6</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key>
  <string>${path.join(STABLE_DIR, "daily.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(STABLE_DIR, "daily-error.log")}</string>
</dict>
</plist>`;
  try {
    const uid = execSync("id -u", { encoding: "utf8" }).trim();
    const gui = `gui/${uid}`;
    fs.mkdirSync(plistDir, { recursive: true });
    try {
      execSync(`launchctl bootout ${gui} "${plistPath}"`, { stdio: "ignore" });
    } catch {}
    try {
      execSync(`launchctl bootout ${gui}/${label}`, { stdio: "ignore" });
    } catch {}
    fs.writeFileSync(plistPath, plist);
    execSync(`launchctl bootstrap ${gui} "${plistPath}"`, { stdio: "ignore" });
    console.log("✅ 자동 동기화 등록 완료 (0/6/12/18시, launchd)");
  } catch {
    console.log("⚠️  일간 자동 동기화 등록 실패 (선택 사항, 수동으로 등록 가능)");
  }
}
function registerWindowsTask(submitPath) {
  const taskName = "PrimusUsageTracker";
  const wrapperPath = path.join(STABLE_DIR, "daily-sync.cmd");
  const xmlPath = path.join(STABLE_DIR, "task.xml");
  fs.writeFileSync(wrapperPath, `@echo off\r
"${process.execPath}" "${submitPath}"\r
`);
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <CalendarTrigger><StartBoundary>2000-01-01T00:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
    <CalendarTrigger><StartBoundary>2000-01-01T06:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
    <CalendarTrigger><StartBoundary>2000-01-01T12:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
    <CalendarTrigger><StartBoundary>2000-01-01T18:00:00</StartBoundary><ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay></CalendarTrigger>
  </Triggers>
  <Settings>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
  </Settings>
  <Actions>
    <Exec><Command>${wrapperPath}</Command></Exec>
  </Actions>
</Task>`;
  fs.writeFileSync(xmlPath, Buffer.from("\uFEFF" + xml, "utf16le"));
  const result = spawnSync("schtasks", [
    "/Create",
    "/TN",
    taskName,
    "/XML",
    xmlPath,
    "/F"
  ], { stdio: "ignore" });
  if (result.status === 0) {
    console.log("✅ 자동 동기화 등록 완료 (0/6/12/18시, Task Scheduler)");
  } else {
    console.log("⚠️  일간 자동 동기화 등록 실패 (선택 사항, 수동으로 등록 가능)");
  }
}
function registerDailySchedule(submitPath) {
  if (process.platform === "darwin") {
    registerLaunchd(submitPath);
  } else if (process.platform === "win32") {
    registerWindowsTask(submitPath);
  }
}
function removeHook() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH))
    return;
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
  } catch {
    return;
  }
  const hooks = settings.hooks ?? {};
  let changed = false;
  for (const event of ["SessionStart", "SessionEnd"]) {
    const existing = hooks[event] ?? [];
    const cleaned = existing.filter((group) => !group.hooks?.some((h) => h.command.includes("submit.mjs")));
    if (cleaned.length !== existing.length) {
      hooks[event] = cleaned;
      changed = true;
    }
  }
  if (changed) {
    settings.hooks = hooks;
    fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log("✅ 기존 세션 hook 제거 완료");
  }
}
function runBackfill(apiKey) {
  const syncScript = path.join(__dirname2, "sync.mjs");
  const syncTs = path.join(__dirname2, "sync.js");
  const scriptPath = fs.existsSync(syncScript) ? syncScript : fs.existsSync(syncTs) ? syncTs : null;
  if (!scriptPath)
    return;
  const child = spawn(process.execPath, [scriptPath], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL,
      USAGE_TRACKER_DAYS: "90"
    }
  });
  child.unref();
  console.log("\uD83D\uDCE6 과거 데이터 백그라운드 수집 시작 (최대 90일)");
}
function runImmediateSync(apiKey) {
  if (!fs.existsSync(STABLE_SUBMIT))
    return;
  const child = spawn(process.execPath, [STABLE_SUBMIT], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL,
      _USAGE_TRACKER_DETACHED: "1"
    }
  });
  child.unref();
  console.log("\uD83D\uDCE4 현재 데이터 즉시 수집 시작 (백그라운드)");
}
function checkCodeburn() {
  try {
    const cmd = process.platform === "win32" ? "where codeburn" : "which codeburn";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
async function installCodeburn() {
  console.log("\uD83D\uDCE6 codeburn 설치 중...");
  try {
    execSync("npm install -g codeburn", { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}
function checkCcusage() {
  try {
    const cmd = process.platform === "win32" ? "where ccusage" : "which ccusage";
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
async function installCcusage() {
  console.log("\uD83D\uDCE6 ccusage 설치 중...");
  try {
    execSync("npm install -g ccusage", { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}
async function ensureCcusage() {
  if (checkCcusage()) {
    console.log(`✅ ccusage 확인됨
`);
    return;
  }
  console.log("⚠️  ccusage가 설치되어 있지 않습니다. 설치 시도 중...");
  const ok = await installCcusage();
  if (ok) {
    console.log(`✅ ccusage 설치 완료
`);
  } else {
    console.log("⚠️  ccusage 설치 실패. 토큰 그래프는 비어 있을 수 있습니다.");
    console.log(`   수동 설치: npm install -g ccusage
`);
  }
}
async function runRepair() {
  console.log(`\uD83D\uDD27 Usage Tracker 복구 시작
`);
  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error("❌ 설치된 API 키가 없습니다. 먼저 init을 실행하세요:");
    console.error("   npx --yes github:eugene-eee-hongkyu/ai-usage-tracker init");
    process.exit(1);
  }
  console.log(`✅ API 키 확인됨
`);
  await ensureCcusage();
  const fallbackPath = path.join(os.homedir(), ".primus-usage-key");
  fs.writeFileSync(fallbackPath, apiKey, { mode: 384 });
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname2, "submit.mjs"), STABLE_SUBMIT);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);
  runImmediateSync(apiKey);
  console.log(`
✨ 복구 완료!`);
  console.log("   0/6/12/18시마다 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard
`);
  process.exit(0);
}
async function runInit() {
  console.log(`\uD83D\uDE80 Usage Tracker 설치 시작
`);
  if (!checkCodeburn()) {
    console.log("⚠️  codeburn이 설치되어 있지 않습니다.");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((res) => rl.question("지금 설치할까요? (Y/n) ", res));
    rl.close();
    if (answer.toLowerCase() !== "n") {
      const ok = await installCodeburn();
      if (!ok) {
        console.error("❌ codeburn 설치 실패. 수동으로 설치하세요: npm install -g codeburn");
        process.exit(1);
      }
      console.log(`✅ codeburn 설치 완료
`);
    } else {
      console.log("⚠️  codeburn 없이는 사용량을 수집할 수 없습니다.");
      console.log("   나중에: npm install -g codeburn");
    }
  } else {
    console.log(`✅ codeburn 확인됨
`);
  }
  await ensureCcusage();
  const existingKey = await loadApiKey();
  if (existingKey) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((res) => rl.question("이미 설치되어 있습니다. 재설치할까요? (y/N) ", res));
    rl.close();
    if (answer.toLowerCase() !== "y") {
      console.log("설치 취소됨.");
      return;
    }
    await deleteApiKey();
  }
  let apiKey;
  try {
    apiKey = await getApiKeyViaLocalServer();
  } catch (err) {
    console.error("❌ 인증 실패:", err.message);
    process.exit(1);
  }
  await saveApiKey(apiKey);
  console.log("\uD83D\uDD11 API 키 저장 완료");
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname2, "submit.mjs"), STABLE_SUBMIT);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);
  runBackfill(apiKey);
  console.log(`
✨ 설치 완료!`);
  console.log("   0/6/12/18시마다 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard
`);
  process.exit(0);
}

// src/reset.ts
async function runReset() {
  const existing = await loadApiKey();
  if (!existing) {
    console.log(`설치된 API 키가 없습니다. 새로 설치합니다.
`);
  } else {
    console.log(`기존 API 키를 삭제하고 재인증합니다.
`);
  }
  await runInit();
}

// src/sync.ts
import { spawn as spawn2 } from "child_process";
var SERVER_URL2 = process.env.USAGE_TRACKER_URL ?? "https://ai-usage-tracker-web-psi.vercel.app";
var PERIODS = ["today", "week", "month", "all"];
var SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
var childEnv = { ...process.env, TZ: SYSTEM_TZ, CODEBURN_TZ: SYSTEM_TZ };
function spawnCodeburn(period) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const proc = spawn2("codeburn", ["report", "--format", "json", "--provider", "claude", "--period", period], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(`codeburn exited ${code} (period=${period})`));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch (e) {
        reject(e);
      }
    });
    proc.on("error", reject);
    setTimeout(() => {
      proc.kill();
      reject(new Error(`codeburn timeout (period=${period})`));
    }, 120000);
  });
}
function spawnCcusageDaily() {
  return new Promise((resolve) => {
    const chunks = [];
    const proc = spawn2("ccusage", ["daily", "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0)
        return resolve(null);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch {
        resolve(null);
      }
    });
    proc.on("error", () => resolve(null));
    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 120000);
  });
}
async function runSync(_days) {
  const apiKey = process.env.USAGE_TRACKER_API_KEY ?? await loadApiKey();
  if (!apiKey) {
    console.error("API 키가 없습니다. 먼저 init을 실행하세요.");
    process.exit(1);
  }
  console.log("codeburn + ccusage 데이터 수집 중...");
  try {
    const [results, ccusageDaily] = await Promise.all([
      Promise.all(PERIODS.map((p) => spawnCodeburn(p))),
      spawnCcusageDaily()
    ]);
    const report = Object.fromEntries(PERIODS.map((p, i) => [p, results[i]]));
    if (ccusageDaily)
      report.ccusageDaily = ccusageDaily;
    const resp = await fetch(`${SERVER_URL2}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(report)
    });
    if (resp.ok) {
      console.log("✅ 데이터 전송 완료");
    } else {
      console.error(`❌ 전송 실패: ${resp.status}`);
      process.exit(1);
    }
  } catch (err) {
    console.error("codeburn 실행 실패:", err.message);
    process.exit(1);
  }
}
var isMain = typeof process !== "undefined" && process.argv[1] && (process.argv[1].endsWith("sync.mjs") || process.argv[1].endsWith("sync.js"));
if (isMain) {
  runSync().catch((err) => {
    process.stderr.write(`[sync] error: ${err.message}
`);
    process.exit(1);
  });
}

// src/index.ts
var program = new import_commander.Command;
program.name("usage-tracker").description("Primus Labs Claude Code usage tracker").version("0.1.0");
program.command("init").description("인증 및 SessionEnd hook 등록").action(runInit);
program.command("repair").description("API 키 유지하고 hook·스케줄만 재등록").action(runRepair);
program.command("reset").description("API 키 재발급 및 재설정").action(runReset);
program.command("sync").description("과거 데이터 수동 동기화").option("-d, --days <number>", "동기화할 일수", "90").action((opts) => runSync(parseInt(opts.days)));
if (process.argv[2] === "init" || process.argv.length <= 2) {
  program.parse(["node", "usage-tracker", "init", ...process.argv.slice(3)]);
} else {
  program.parse(process.argv);
}
