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
var SERVER_URL = process.env.USAGE_TRACKER_URL ?? "https://aiusage.z21labs.world";
var CLI_VERSION = "0.2.0";
var KEYTAR_SERVICE = "z21labs-usage-tracker";
var KEYTAR_ACCOUNT = "api-key";
var CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
var STABLE_DIR = path.join(os.homedir(), ".z21labs", "usage-tracker");
var STABLE_SUBMIT = path.join(STABLE_DIR, "submit.mjs");
var STABLE_HISTORICAL = path.join(STABLE_DIR, "historical.mjs");
var API_KEY_FALLBACK = path.join(os.homedir(), ".z21labs", "usage-key");
var CLI_PORT = 9988;
var LAUNCHD_LABEL = "world.z21labs.ai-usage-tracker.sync";
var LAUNCHD_PLIST = process.platform === "darwin" ? path.join(os.homedir(), "Library", "LaunchAgents", `${LAUNCHD_LABEL}.plist`) : null;
var LEGACY_KEYTAR_SERVICE = "primus-usage-tracker";
var LEGACY_STABLE_DIR = path.join(os.homedir(), ".primus-usage-tracker");
var LEGACY_API_KEY_FALLBACK = path.join(os.homedir(), ".primus-usage-key");
var LEGACY_LAUNCHD_LABEL = "com.primus.usage-tracker.daily";
var LEGACY_LAUNCHD_PLIST = process.platform === "darwin" ? path.join(os.homedir(), "Library", "LaunchAgents", `${LEGACY_LAUNCHD_LABEL}.plist`) : null;
function preflightOwnership() {
  if (process.platform === "win32" || !process.getuid)
    return;
  const myUid = process.getuid();
  const bar = "═".repeat(60);
  if (myUid === 0) {
    console.error(`
` + bar);
    console.error("❌ root 권한으로 실행되었습니다");
    console.error("   설치/수리는 일반 사용자 권한으로만 실행하세요.");
    console.error("   sudo 없이 다시 시도하세요.");
    console.error(bar + `
`);
    process.exit(1);
  }
  const targets = [
    { path: STABLE_DIR, label: STABLE_DIR },
    { path: API_KEY_FALLBACK, label: API_KEY_FALLBACK },
    { path: LEGACY_STABLE_DIR, label: LEGACY_STABLE_DIR },
    { path: LEGACY_API_KEY_FALLBACK, label: LEGACY_API_KEY_FALLBACK }
  ];
  if (LAUNCHD_PLIST)
    targets.push({ path: LAUNCHD_PLIST, label: LAUNCHD_PLIST });
  if (LEGACY_LAUNCHD_PLIST)
    targets.push({ path: LEGACY_LAUNCHD_PLIST, label: LEGACY_LAUNCHD_PLIST });
  const wrong = [];
  for (const t of targets) {
    if (!fs.existsSync(t.path))
      continue;
    const stat = fs.statSync(t.path);
    if (stat.uid !== myUid)
      wrong.push({ ...t, uid: stat.uid, isDir: stat.isDirectory() });
  }
  if (wrong.length === 0)
    return;
  console.error(`
` + bar);
  console.error("❌ 다른 사용자 소유의 파일이 있습니다 (보통 root)");
  console.error("   원인: 과거 설치가 elevated 권한으로 실행됨.");
  console.error("   현 상태에선 launchd 가 daily.log / submit.lock 을 못 만들어");
  console.error("   매 실행이 EX_CONFIG (78) 으로 떨어집니다.");
  console.error("");
  for (const w of wrong)
    console.error(`   uid=${w.uid}  ${w.label}`);
  console.error("");
  console.error("   다음 명령으로 소유권 복구 후 다시 실행하세요:");
  for (const w of wrong) {
    const flag = w.isDir ? "-R " : "";
    console.error(`     sudo chown ${flag}"$(whoami):staff" "${w.path}"`);
  }
  console.error(bar + `
`);
  process.exit(1);
}
function promptYn(question, defaultYes = true) {
  let ttyFd;
  try {
    ttyFd = fs.openSync("/dev/tty", "r");
  } catch {
    return false;
  }
  process.stdout.write(question);
  const chunks = [];
  const single = Buffer.alloc(1);
  try {
    while (true) {
      const n = fs.readSync(ttyFd, single, 0, 1, null);
      if (n === 0)
        break;
      const c = single[0];
      if (c === 10)
        break;
      if (c === 13)
        continue;
      chunks.push(c);
    }
  } finally {
    fs.closeSync(ttyFd);
  }
  const ans = Buffer.from(chunks).toString("utf8").trim();
  if (!ans)
    return defaultYes;
  const lower = ans.toLowerCase();
  return lower === "y" || lower === "yes";
}
function runInstallShAndExit() {
  const bar = "═".repeat(60);
  console.log("");
  console.log("\uD83D\uDCE6 install.sh 자동 실행 중 (nvm + Node 22 + 자동 init)...");
  console.log("");
  try {
    execSync(`curl -fsSL ${SERVER_URL}/install.sh | bash`, { stdio: "inherit" });
  } catch {
    console.error("");
    console.error("❌ 자동 복구 실패. 수동 절차:");
    console.error(`   curl -fsSL ${SERVER_URL}/install.sh | bash`);
    console.error(`   npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair`);
    process.exit(1);
  }
  console.log("");
  console.log(bar);
  console.log("✅ 환경 설정 완료");
  console.log("");
  console.log("   현재 셸은 아직 옛 PATH 를 보고 있습니다. 새 Node 적용:");
  console.log("     1. 터미널 새 창 (⌘N) 열고 repair 재실행 — 권장");
  console.log("     2. 또는 현재 셸에서: exec $SHELL -l");
  console.log("        그 다음: npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  console.log(bar);
  console.log("");
  process.exit(0);
}
function preflightNodeVersion() {
  const major = parseInt((process.versions.node ?? "0").split(".")[0], 10);
  if (!Number.isFinite(major) || major >= 22)
    return;
  const bar = "═".repeat(60);
  console.error(`
` + bar);
  console.error(`⚠️  Node ${process.versions.node} 감지 — codeburn / ccusage 는 Node 22 이상 필요`);
  console.error("");
  console.error("   이대로 install 하면:");
  console.error("     - npm EBADENGINE 경고 (install 자체는 됨)");
  console.error("     - codeburn / ccusage 런타임 오작동 위험");
  console.error("     - launchd 가 매 2시간마다 silent 실패 가능");
  console.error("");
  console.error("   자동 복구 가능:");
  console.error("     - nvm 설치 (~/.nvm/ 안에만, 시스템 Node 그대로 보존)");
  console.error("     - Node 22 설치 + 기본값으로 설정");
  console.error("     - ~/.zshrc 자동 백업 후 nvm 라인 추가");
  console.error("");
  console.error("   롤백 방법:");
  console.error("     nvm use system          # 셸 1개만 옛 Node 로");
  console.error(`     nvm alias default ${major}    # 기본을 다시 옛 버전으로`);
  console.error(bar);
  const autoFix = promptYn(`
   지금 자동 복구할까요? [Y/n]: `, true);
  if (autoFix) {
    runInstallShAndExit();
  }
  const forceProceed = promptYn(`
   자동 복구 건너뜀. 그래도 Node ${major} 로 강행할까요? [y/N]: `, false);
  if (!forceProceed) {
    console.error(`
   중단됨. 수동 복구:`);
    console.error("     nvm install 22 && nvm use 22 && nvm alias default 22");
    console.error("     npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
    process.exit(1);
  }
  console.warn(`
   ⚠️  Node ${major} 로 강행. 깨질 위험 인지함.
`);
}
function preflightGlobalPackages() {
  if (process.platform === "win32" || !process.getuid)
    return;
  let npmRoot;
  try {
    npmRoot = execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return;
  }
  if (!npmRoot || !fs.existsSync(npmRoot))
    return;
  try {
    fs.accessSync(npmRoot, fs.constants.W_OK);
    return;
  } catch {}
  const myUid = process.getuid();
  const parentStat = fs.statSync(npmRoot);
  const installed = [];
  for (const p of ["codeburn", "ccusage"]) {
    if (fs.existsSync(path.join(npmRoot, p)))
      installed.push(p);
  }
  const bar = "═".repeat(60);
  console.error(`
` + bar);
  console.error("❌ npm 전역 디렉토리에 쓰기 권한이 없습니다");
  console.error(`   ${npmRoot}`);
  console.error(`   소유자 uid=${parentStat.uid}, 현재 uid=${myUid}`);
  console.error("");
  console.error("   원인: 시스템 Node 사용 중이거나 과거 sudo 로 설치됨.");
  console.error("   이 상태에선 codeburn/ccusage @latest 업그레이드가 EACCES");
  console.error("   (npm rename 단계) 로 실패합니다.");
  if (installed.length > 0) {
    console.error("");
    console.error(`   현재 막혀있는 패키지: ${installed.join(", ")}`);
  }
  console.error("");
  console.error("   자동 복구 가능:");
  console.error("     1. nvm 설치 (~/.nvm/ 안에만, 시스템 Node 그대로 보존)");
  console.error("     2. Node 22 설치 + 기본값으로 설정");
  console.error("     3. ~/.zshrc 자동 백업 후 nvm 라인 추가");
  console.error("");
  console.error("   변경되는 것:");
  console.error("     - ~/.zshrc 끝에 nvm 활성화 라인 추가 (백업본 자동 생성)");
  console.error("     - 기본 Node 가 ~/.nvm/.../v22.x.x 로 변경");
  console.error("     - 글로벌 CLI 들이 새 Node 환경에서 안 보일 수 있음 (목록 자동 백업)");
  console.error("");
  console.error("   롤백 방법:");
  console.error("     nvm use system            # 셸 1개만 옛 Node 로");
  console.error("     nvm alias default 20      # 기본을 다시 옛 버전으로");
  console.error("     백업: ~/.z21labs/usage-tracker/zshrc.bak-{timestamp}");
  console.error(bar);
  const accept = promptYn(`
   지금 자동 복구를 진행할까요? [Y/n]: `);
  if (accept) {
    runInstallShAndExit();
  }
  console.error("");
  console.error("   자동 복구를 건너뜁니다. 수동 절차:");
  console.error("");
  console.error("     # 1. root 소유로 박혀있는 옛 글로벌 패키지 제거");
  console.error("     sudo npm uninstall -g codeburn ccusage");
  console.error("");
  console.error("     # 2. nvm + Node 22 로 재설치");
  console.error(`     curl -fsSL ${SERVER_URL}/install.sh | bash`);
  console.error("");
  console.error("     # 3. repair 재실행");
  console.error("     npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  console.error(bar + `
`);
  process.exit(1);
}
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
  fs.mkdirSync(path.dirname(API_KEY_FALLBACK), { recursive: true });
  fs.writeFileSync(API_KEY_FALLBACK, apiKey, { mode: 384 });
}
async function loadApiKey() {
  const keytar = await getKeytar();
  if (keytar) {
    const key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (key)
      return key;
    const legacyKey = await keytar.getPassword(LEGACY_KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (legacyKey)
      return legacyKey;
  }
  if (fs.existsSync(API_KEY_FALLBACK)) {
    return fs.readFileSync(API_KEY_FALLBACK, "utf8").trim();
  }
  if (fs.existsSync(LEGACY_API_KEY_FALLBACK)) {
    return fs.readFileSync(LEGACY_API_KEY_FALLBACK, "utf8").trim();
  }
  return null;
}
async function deleteApiKey() {
  const keytar = await getKeytar();
  if (keytar) {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    try {
      await keytar.deletePassword(LEGACY_KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    } catch {}
  }
  if (fs.existsSync(API_KEY_FALLBACK))
    fs.unlinkSync(API_KEY_FALLBACK);
  if (fs.existsSync(LEGACY_API_KEY_FALLBACK))
    fs.unlinkSync(LEGACY_API_KEY_FALLBACK);
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
function findStableNodePath() {
  const candidates = [
    "/opt/homebrew/bin/node",
    "/usr/local/bin/node"
  ];
  for (const c of candidates) {
    if (fs.existsSync(c))
      return c;
  }
  try {
    const npmPrefix = execSync("npm config get prefix", { encoding: "utf8" }).trim();
    const npmNode = path.join(npmPrefix, "bin", "node");
    if (fs.existsSync(npmNode))
      return npmNode;
  } catch {}
  return process.execPath;
}
function registerLaunchd(submitPath) {
  const label = LAUNCHD_LABEL;
  const plistDir = path.join(os.homedir(), "Library", "LaunchAgents");
  const plistPath = path.join(plistDir, `${label}.plist`);
  if (LEGACY_LAUNCHD_PLIST && fs.existsSync(LEGACY_LAUNCHD_PLIST)) {
    try {
      execSync(`launchctl unload "${LEGACY_LAUNCHD_PLIST}"`, { stdio: "ignore" });
    } catch {}
    try {
      fs.unlinkSync(LEGACY_LAUNCHD_PLIST);
    } catch {}
  }
  const nodePath = findStableNodePath();
  if (nodePath !== process.execPath) {
    console.log("\uD83D\uDCCD plist node 경로: " + nodePath + " (nvm 의존성 회피)");
  }
  const envPath = process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin";
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${submitPath}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${envPath}</string>
  </dict>
  <key>StartInterval</key>
  <integer>7200</integer>
  <key>StandardOutPath</key>
  <string>${path.join(STABLE_DIR, "daily.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(STABLE_DIR, "daily-error.log")}</string>
</dict>
</plist>`;
  const uid = (() => {
    try {
      return execSync("id -u", { encoding: "utf8" }).trim();
    } catch (e) {
      console.log("⚠️  uid 조회 실패 — launchd 등록 건너뜀:", e.message);
      return null;
    }
  })();
  if (!uid)
    return;
  const gui = `gui/${uid}`;
  try {
    fs.mkdirSync(plistDir, { recursive: true });
  } catch (e) {
    console.log("⚠️  LaunchAgents 디렉토리 생성 실패:", e.message);
    return;
  }
  const alreadyLoaded = spawnSync("launchctl", ["print", `${gui}/${label}`], { stdio: "ignore" }).status === 0;
  if (alreadyLoaded) {
    const out = spawnSync("launchctl", ["bootout", `${gui}/${label}`], { encoding: "utf8" });
    if (out.status !== 0) {
      const errMsg = ((out.stderr ?? "") + (out.stdout ?? "")).trim();
      console.log("⚠️  기존 service bootout 실패 (exit " + out.status + ")");
      if (errMsg)
        console.log("    stderr:", errMsg);
      console.log("    수동 처리: launchctl bootout " + gui + "/" + label);
      return;
    }
  }
  try {
    fs.writeFileSync(plistPath, plist);
  } catch (e) {
    console.log(`⚠️  plist 파일 작성 실패 (${plistPath}):`, e.message);
    return;
  }
  const bootstrap = spawnSync("launchctl", ["bootstrap", gui, plistPath], { encoding: "utf8" });
  const bootstrapStderr = ((bootstrap.stderr ?? "") + (bootstrap.stdout ?? "")).trim();
  if (bootstrap.status !== 0) {
    console.log("⚠️  launchctl bootstrap 실패 (exit " + bootstrap.status + ")");
    if (bootstrapStderr)
      console.log("    stderr:", bootstrapStderr);
    console.log("    plist 파일은 생성됨:", plistPath);
    console.log("    수동 시도: launchctl bootstrap " + gui + ' "' + plistPath + '"');
    return;
  }
  const verify = spawnSync("launchctl", ["print", `${gui}/${label}`], { encoding: "utf8" });
  if (verify.status !== 0) {
    console.log("⚠️  bootstrap 종료코드 0 인데 service 가 launchd 에 안 보임");
    console.log("    launchctl print stderr:", ((verify.stderr ?? "") + (verify.stdout ?? "")).trim());
    console.log("    plist 파일은 생성됨:", plistPath);
    console.log("    수동 검증: launchctl list | grep " + label);
    return;
  }
  spawnSync("launchctl", ["kickstart", "-p", `${gui}/${label}`], { stdio: "ignore" });
  console.log("✅ 자동 동기화 등록 완료 (2시간마다, launchd. sleep 시 wake 즉시 catch-up)");
}
function registerWindowsTask(submitPath) {
  const taskName = "Z21labsUsageTracker";
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
function runHistoricalBackfill(apiKey) {
  if (!fs.existsSync(STABLE_HISTORICAL))
    return;
  const child = spawn(process.execPath, [STABLE_HISTORICAL], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL
    }
  });
  child.unref();
  console.log("\uD83D\uDCDA 과거 8주 + 12개월 historical backfill 시작 (백그라운드)");
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
  console.log("\uD83D\uDCE6 codeburn 0.9.7 (핀 버전) 설치 중...");
  try {
    execSync("npm install -g codeburn@0.9.7", { stdio: "inherit" });
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
  console.log("\uD83D\uDCE6 ccusage 19.0.2 (핀 버전) 설치 중...");
  try {
    execSync("npm install -g ccusage@19.0.2", { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}
async function ensureCcusage() {
  const hadBefore = checkCcusage();
  console.log(hadBefore ? "\uD83D\uDCE6 ccusage 19.0.2 (핀 버전) 강제 설치 시도..." : "⚠️  ccusage 미설치 — 최신 설치 시도...");
  const installed = await installCcusage();
  if (installed && checkCcusage()) {
    console.log(`✅ ccusage 19.0.2 확인됨
`);
    return true;
  }
  if (hadBefore) {
    console.log(`⚠️  ccusage 업그레이드 실패 — 기존 버전으로 계속 진행
`);
    return true;
  }
  const bar = "═".repeat(60);
  console.log(`
` + bar);
  console.log("❌ ccusage 설치 실패");
  console.log("   → 토큰/비용 데이터가 수집되지 않습니다.");
  console.log("   → 수동 설치 후 repair 를 다시 실행하세요:");
  console.log("       npm install -g ccusage@19.0.2");
  console.log("       npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  console.log(bar + `
`);
  return false;
}
async function ensureCodeburn() {
  const hadBefore = checkCodeburn();
  console.log(hadBefore ? "\uD83D\uDCE6 codeburn 0.9.7 (핀 버전) 강제 설치 시도..." : "⚠️  codeburn 미설치 — 최신 설치 시도...");
  const installed = await installCodeburn();
  if (installed && checkCodeburn()) {
    console.log(`✅ codeburn 0.9.7 확인됨
`);
    return true;
  }
  if (hadBefore) {
    console.log(`⚠️  codeburn 업그레이드 실패 — 기존 버전으로 계속 진행
`);
    return true;
  }
  return false;
}
async function runRepair() {
  console.log(`\uD83D\uDD27 Usage Tracker v${CLI_VERSION} 복구 시작
`);
  preflightOwnership();
  preflightGlobalPackages();
  preflightNodeVersion();
  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error("❌ 설치된 API 키가 없습니다. 먼저 init을 실행하세요:");
    console.error("   npx --yes github:eugene-eee-hongkyu/ai-usage-tracker init");
    process.exit(1);
  }
  console.log(`✅ API 키 확인됨
`);
  const codeburnOk = await ensureCodeburn();
  if (!codeburnOk) {
    console.error("❌ codeburn 사용 불가 상태. 수동 설치 후 다시 시도하세요:");
    console.error("   npm install -g codeburn@0.9.7");
    process.exit(1);
  }
  const ccusageOk = await ensureCcusage();
  fs.mkdirSync(path.dirname(API_KEY_FALLBACK), { recursive: true });
  fs.writeFileSync(API_KEY_FALLBACK, apiKey, { mode: 384 });
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname2, "submit.mjs"), STABLE_SUBMIT);
  fs.copyFileSync(path.join(__dirname2, "historical.mjs"), STABLE_HISTORICAL);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);
  runImmediateSync(apiKey);
  runHistoricalBackfill(apiKey);
  console.log(`
✨ 복구 완료!`);
  console.log("   백그라운드에서 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard
`);
  if (!ccusageOk) {
    console.log(`⚠️  주의: ccusage 미설치 상태로 저장되어 토큰/비용은 비어 있습니다.
`);
  }
  process.exit(0);
}
async function runInit() {
  console.log(`\uD83D\uDE80 Usage Tracker v${CLI_VERSION} 설치 시작
`);
  preflightOwnership();
  preflightGlobalPackages();
  preflightNodeVersion();
  const codeburnOk = await ensureCodeburn();
  if (!codeburnOk) {
    console.error("❌ codeburn 설치 실패. 수동으로 설치 후 다시 시도하세요:");
    console.error("   npm install -g codeburn@0.9.7");
    process.exit(1);
  }
  const ccusageOk = await ensureCcusage();
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
  fs.copyFileSync(path.join(__dirname2, "historical.mjs"), STABLE_HISTORICAL);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);
  runBackfill(apiKey);
  runHistoricalBackfill(apiKey);
  console.log(`
✨ 설치 완료!`);
  console.log("   백그라운드에서 자동으로 사용량이 수집됩니다.");
  console.log(`   대시보드: ${SERVER_URL}/dashboard
`);
  if (!ccusageOk) {
    console.log(`⚠️  주의: ccusage 미설치 상태로 저장되어 토큰/비용은 비어 있습니다.
`);
  }
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

// src/destinations.ts
import { readFileSync as readFileSync2 } from "fs";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";
function readConfigFile() {
  const path2 = process.env.USAGE_TRACKER_CONFIG ?? join2(homedir2(), ".usage-tracker", "config.json");
  try {
    const raw = readFileSync2(path2, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed.destinations && Array.isArray(parsed.destinations) && parsed.destinations.length > 0) {
      return parsed;
    }
  } catch {}
  return null;
}
async function loadDestinations() {
  const cfg = readConfigFile();
  if (cfg?.destinations?.length) {
    return cfg.destinations.map((d) => ({
      name: d.name,
      url: d.url.replace(/\/$/, ""),
      apiKey: d.apiKey ?? null
    }));
  }
  const localMode = process.env.USAGE_TRACKER_MODE === "local";
  const localPort = process.env.LOCAL_PORT ?? "3000";
  const url = process.env.USAGE_TRACKER_URL ?? (localMode ? `http://localhost:${localPort}` : "https://aiusage.z21labs.world");
  const apiKey = localMode ? null : process.env.USAGE_TRACKER_API_KEY ?? await loadApiKey();
  return [
    {
      name: localMode ? "local" : "default",
      url: url.replace(/\/$/, ""),
      apiKey
    }
  ];
}

// src/sync.ts
var PERIODS = ["today", "week", "month", "30days", "all"];
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
    }, 600000);
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
    }, 600000);
  });
}
function spawnCcusageBlocks() {
  return new Promise((resolve) => {
    const chunks = [];
    const proc = spawn2("ccusage", ["blocks", "--json"], {
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
    }, 600000);
  });
}
async function postTo(dest, payload) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (dest.apiKey)
      headers["x-api-key"] = dest.apiKey;
    const resp = await fetch(`${dest.url}/api/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    return { ok: resp.ok, status: resp.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
async function runSync(_days) {
  const destinations = await loadDestinations();
  const orphan = destinations.find((d) => !d.apiKey && !d.url.includes("localhost") && !d.url.includes("127.0.0.1"));
  if (orphan) {
    console.error(`API 키가 없습니다 (destination=${orphan.name}). config.json 의 apiKey 또는 init 실행.`);
    process.exit(1);
  }
  const summary = destinations.map((d) => d.name).join(", ");
  console.log(`codeburn + ccusage 데이터 수집 중... (destinations: ${summary})`);
  let report;
  try {
    const [results, ccusageDaily, ccusageBlocks] = await Promise.all([
      Promise.all(PERIODS.map((p) => spawnCodeburn(p))),
      spawnCcusageDaily(),
      spawnCcusageBlocks()
    ]);
    report = Object.fromEntries(PERIODS.map((p, i) => [p, results[i]]));
    if (ccusageDaily)
      report.ccusageDaily = ccusageDaily;
    if (ccusageBlocks)
      report.ccusageBlocks = ccusageBlocks;
  } catch (err) {
    console.error("codeburn 실행 실패:", err.message);
    process.exit(1);
  }
  const outcomes = await Promise.allSettled(destinations.map((d) => postTo(d, report)));
  let successCount = 0;
  outcomes.forEach((r, i) => {
    const d = destinations[i];
    if (r.status === "fulfilled" && r.value.ok) {
      console.log(`  ✅ ${d.name} (${d.url})`);
      successCount++;
    } else {
      const msg = r.status === "fulfilled" ? `HTTP ${r.value.status ?? "?"}${r.value.error ? " — " + r.value.error : ""}` : r.reason?.message ?? "unknown";
      console.error(`  ❌ ${d.name} (${d.url}) — ${msg}`);
    }
  });
  if (successCount === 0) {
    console.error("❌ 모든 destination 실패");
    process.exit(1);
  }
  console.log(`✅ ${successCount}/${destinations.length} destination 전송 완료`);
}
var isMain = typeof process !== "undefined" && process.argv[1] && (process.argv[1].endsWith("sync.mjs") || process.argv[1].endsWith("sync.js"));
if (isMain) {
  runSync().catch((err) => {
    process.stderr.write(`[sync] error: ${err.message}
`);
    process.exit(1);
  });
}

// src/doctor.ts
import { execSync as execSync2 } from "child_process";
import * as fs2 from "fs";
import * as os2 from "os";
import * as path2 from "path";
var STABLE_DIR2 = path2.join(os2.homedir(), ".z21labs", "usage-tracker");
var API_KEY_FALLBACK2 = path2.join(os2.homedir(), ".z21labs", "usage-key");
var LAUNCHD_PLIST2 = process.platform === "darwin" ? path2.join(os2.homedir(), "Library", "LaunchAgents", "world.z21labs.ai-usage-tracker.sync.plist") : null;
var LEGACY_STABLE_DIR2 = path2.join(os2.homedir(), ".primus-usage-tracker");
var LEGACY_API_KEY_FALLBACK2 = path2.join(os2.homedir(), ".primus-usage-key");
var LEGACY_LAUNCHD_PLIST2 = process.platform === "darwin" ? path2.join(os2.homedir(), "Library", "LaunchAgents", "com.primus.usage-tracker.daily.plist") : null;
function safeExec(cmd) {
  try {
    return execSync2(cmd, { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
function detectNodeManager(nodePath) {
  if (!nodePath)
    return null;
  if (nodePath.includes("/.nvm/"))
    return "nvm";
  if (nodePath.includes("/.asdf/"))
    return "asdf";
  if (nodePath.includes("/.volta/"))
    return "volta";
  if (nodePath.includes("/.fnm/") || process.env.FNM_DIR)
    return "fnm";
  if (nodePath === "/usr/local/bin/node")
    return "pkg_installer";
  if (nodePath.startsWith("/opt/homebrew/") || nodePath.includes("/Cellar/node/"))
    return "homebrew";
  return "unknown";
}
function readLastSync() {
  const candidates = [
    path2.join(STABLE_DIR2, "submit.lock"),
    path2.join(LEGACY_STABLE_DIR2, "submit.lock")
  ];
  for (const candidate of candidates) {
    if (fs2.existsSync(candidate)) {
      try {
        return fs2.statSync(candidate).mtime.toISOString();
      } catch {}
    }
  }
  return null;
}
function buildReport(cliVersion) {
  const nodePath = safeExec(process.platform === "win32" ? "where node" : "which node");
  const nodeVersion = safeExec("node --version");
  const nodeMajor = nodeVersion ? parseInt(nodeVersion.replace(/^v/, "").split(".")[0], 10) || null : null;
  const manager = detectNodeManager(nodePath);
  const npmRoot = safeExec("npm root -g");
  let npmRootOwner = null;
  let npmRootWritable = null;
  if (npmRoot && fs2.existsSync(npmRoot)) {
    try {
      npmRootOwner = fs2.statSync(npmRoot).uid;
    } catch {}
    try {
      fs2.accessSync(npmRoot, fs2.constants.W_OK);
      npmRootWritable = true;
    } catch {
      npmRootWritable = false;
    }
  }
  const codeburnVer = safeExec("codeburn --version");
  const ccusageVer = safeExec("ccusage --version");
  let launchdStatus = "n/a";
  if (LAUNCHD_PLIST2) {
    const newPresent = fs2.existsSync(LAUNCHD_PLIST2);
    const legacyPresent = LEGACY_LAUNCHD_PLIST2 ? fs2.existsSync(LEGACY_LAUNCHD_PLIST2) : false;
    launchdStatus = newPresent || legacyPresent ? "registered" : "not_registered";
  }
  const apiKeyStatus = fs2.existsSync(API_KEY_FALLBACK2) || fs2.existsSync(LEGACY_API_KEY_FALLBACK2) ? "registered" : "not_registered";
  const lastSyncIso = readLastSync();
  const issues = [];
  if (npmRootWritable === false) {
    issues.push("npm 전역 디렉토리 쓰기 불가 — codeburn/ccusage 업데이트가 EACCES 로 실패합니다");
  }
  if (!codeburnVer) {
    issues.push("codeburn 미설치 — one-shot rate / cost 데이터 수집 안 됨");
  }
  if (!ccusageVer) {
    issues.push("ccusage 미설치 — 토큰/비용 데이터 수집 안 됨");
  }
  if (nodeMajor !== null && nodeMajor < 22) {
    issues.push(`Node ${nodeMajor} 감지 — codeburn 0.9.8+ 는 Node 22 이상 권장`);
  }
  if (manager === "pkg_installer") {
    issues.push("시스템 .pkg Node 사용 중 — nvm 전환 권장 (반복적 sudo 사고 위험)");
  }
  if (apiKeyStatus === "not_registered") {
    issues.push("API 키 미등록 — init 실행 필요");
  }
  return {
    cli_version: cliVersion,
    platform: process.platform,
    node_path: nodePath,
    node_version: nodeVersion,
    node_major: nodeMajor,
    node_manager: manager,
    npm_root: npmRoot,
    npm_root_owner_uid: npmRootOwner,
    npm_root_writable: npmRootWritable,
    codeburn_version: codeburnVer,
    ccusage_version: ccusageVer,
    launchd_status: launchdStatus,
    api_key_status: apiKeyStatus,
    last_sync_iso: lastSyncIso,
    issues
  };
}
function maskHome(s) {
  if (!s)
    return "—";
  const home = os2.homedir();
  return s.startsWith(home) ? s.replace(home, "~") : s;
}
function printHumanReport(r) {
  const bar = "━".repeat(60);
  console.log("\uD83D\uDD0D Usage Tracker 환경 진단");
  console.log("");
  console.log(bar);
  console.log("Node:");
  console.log(`  ${maskHome(r.node_path)} (${r.node_version ?? "—"})`);
  const managerWarn = r.node_manager === "pkg_installer" ? " ⚠️" : "";
  console.log(`  매니저: ${r.node_manager ?? "—"}${managerWarn}`);
  console.log("");
  console.log("npm 전역:");
  console.log(`  ${maskHome(r.npm_root)}`);
  if (r.npm_root_writable !== null) {
    const writeMark = r.npm_root_writable ? "✓" : "❌";
    const ownerStr = r.npm_root_owner_uid !== null ? `uid=${r.npm_root_owner_uid}` : "—";
    console.log(`  소유자: ${ownerStr}  쓰기: ${writeMark}`);
  }
  console.log("");
  console.log("설치된 패키지:");
  console.log(`  codeburn: ${r.codeburn_version ?? "미설치 ❌"}`);
  console.log(`  ccusage:  ${r.ccusage_version ?? "미설치 ❌"}`);
  console.log("");
  console.log("자동화:");
  console.log(`  launchd: ${r.launchd_status}`);
  console.log(`  API 키:  ${r.api_key_status}`);
  if (r.last_sync_iso)
    console.log(`  마지막 sync: ${r.last_sync_iso}`);
  console.log(bar);
  if (r.issues.length > 0) {
    console.log("");
    console.log(`발견된 문제 (${r.issues.length}):`);
    r.issues.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    console.log("");
    console.log("복구하려면:");
    console.log("  npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
    console.log("");
    console.log("  → repair 가 권한 문제를 감지하면 자동 복구 prompt 를 띄웁니다.");
  } else {
    console.log("");
    console.log("✅ 발견된 문제 없음 — 환경 정상");
  }
  console.log("");
  console.log("진단 데이터:");
  for (const [k, v] of Object.entries(r)) {
    if (k === "issues")
      continue;
    console.log(`  ${k}=${v === null ? "null" : v}`);
  }
}
function runDoctor(opts) {
  const r = buildReport(opts.cliVersion);
  if (opts.json) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  printHumanReport(r);
}

// src/migrate.ts
import * as fs3 from "fs";
import * as os3 from "os";
import * as path3 from "path";
import { execSync as execSync3 } from "child_process";
var NEW_DATA_ROOT = path3.join(os3.homedir(), ".z21labs");
var NEW_STABLE_DIR = path3.join(NEW_DATA_ROOT, "usage-tracker");
var NEW_API_KEY_FILE = path3.join(NEW_DATA_ROOT, "usage-key");
var NEW_KEYTAR_SERVICE = "z21labs-usage-tracker";
var NEW_LAUNCHD_LABEL = "world.z21labs.ai-usage-tracker.sync";
var NEW_LAUNCHD_PLIST = process.platform === "darwin" ? path3.join(os3.homedir(), "Library", "LaunchAgents", `${NEW_LAUNCHD_LABEL}.plist`) : null;
var LEGACY_STABLE_DIR3 = path3.join(os3.homedir(), ".primus-usage-tracker");
var LEGACY_API_KEY_FILE = path3.join(os3.homedir(), ".primus-usage-key");
var LEGACY_KEYTAR_SERVICE2 = "primus-usage-tracker";
var LEGACY_KEYTAR_ACCOUNT = "api-key";
var LEGACY_LAUNCHD_LABEL2 = "com.primus.usage-tracker.daily";
var LEGACY_LAUNCHD_PLIST3 = process.platform === "darwin" ? path3.join(os3.homedir(), "Library", "LaunchAgents", `${LEGACY_LAUNCHD_LABEL2}.plist`) : null;
function safeMv(src, dst) {
  if (!fs3.existsSync(src))
    return "no-src";
  if (fs3.existsSync(dst))
    return "both-exist";
  fs3.mkdirSync(path3.dirname(dst), { recursive: true });
  fs3.renameSync(src, dst);
  return "moved";
}
function migrateDataDir(report, dryRun) {
  if (!fs3.existsSync(LEGACY_STABLE_DIR3)) {
    report.dataDir = fs3.existsSync(NEW_STABLE_DIR) ? "already-new" : "no-legacy";
    return;
  }
  if (fs3.existsSync(NEW_STABLE_DIR)) {
    report.dataDir = "skipped-both-exist";
    report.notes.push(`옛 ${LEGACY_STABLE_DIR3} 와 새 ${NEW_STABLE_DIR} 모두 존재. 데이터 손실 우려로 자동 mv 건너뜀. 수동 정리 필요.`);
    return;
  }
  if (dryRun) {
    report.dataDir = "migrated";
    report.notes.push(`[dry-run] mv ${LEGACY_STABLE_DIR3} → ${NEW_STABLE_DIR}`);
    return;
  }
  try {
    fs3.mkdirSync(NEW_DATA_ROOT, { recursive: true });
    fs3.renameSync(LEGACY_STABLE_DIR3, NEW_STABLE_DIR);
    report.dataDir = "migrated";
  } catch (e) {
    report.dataDir = "skipped-both-exist";
    report.errors.push(`데이터 디렉토리 mv 실패: ${e.message}`);
  }
}
function migrateApiKeyFile(report, dryRun) {
  if (!fs3.existsSync(LEGACY_API_KEY_FILE)) {
    report.apiKeyFile = fs3.existsSync(NEW_API_KEY_FILE) ? "already-new" : "no-legacy";
    return;
  }
  if (fs3.existsSync(NEW_API_KEY_FILE)) {
    report.apiKeyFile = "skipped-both-exist";
    report.notes.push(`옛 ${LEGACY_API_KEY_FILE} 와 새 ${NEW_API_KEY_FILE} 모두 존재. 수동 정리 필요.`);
    return;
  }
  if (dryRun) {
    report.apiKeyFile = "migrated";
    report.notes.push(`[dry-run] mv ${LEGACY_API_KEY_FILE} → ${NEW_API_KEY_FILE}`);
    return;
  }
  try {
    const result = safeMv(LEGACY_API_KEY_FILE, NEW_API_KEY_FILE);
    if (result === "moved") {
      report.apiKeyFile = "migrated";
      fs3.chmodSync(NEW_API_KEY_FILE, 384);
    }
  } catch (e) {
    report.errors.push(`API key 파일 mv 실패: ${e.message}`);
  }
}
async function migrateKeytar(report, dryRun) {
  let keytar = null;
  try {
    const kt = await import("keytar");
    const resolved = kt.default ?? kt;
    keytar = resolved;
    if (typeof keytar?.setPassword !== "function") {
      report.keytar = "unavailable";
      report.notes.push("keytar import 했지만 setPassword 없음 — native module 호환 이슈로 keytar 단계 skip.");
      return;
    }
  } catch {
    report.keytar = "unavailable";
    return;
  }
  try {
    const legacyKey = await keytar.getPassword(LEGACY_KEYTAR_SERVICE2, LEGACY_KEYTAR_ACCOUNT);
    if (!legacyKey) {
      const newKey = await keytar.getPassword(NEW_KEYTAR_SERVICE, LEGACY_KEYTAR_ACCOUNT);
      report.keytar = newKey ? "already-new" : "no-legacy";
      return;
    }
    const existingNew = await keytar.getPassword(NEW_KEYTAR_SERVICE, LEGACY_KEYTAR_ACCOUNT);
    if (existingNew && existingNew !== legacyKey) {
      report.notes.push(`keytar 옛 서비스(${LEGACY_KEYTAR_SERVICE2})와 새 서비스(${NEW_KEYTAR_SERVICE}) 키 값이 다름. 수동 검토 필요.`);
      report.keytar = "error";
      return;
    }
    if (dryRun) {
      report.keytar = "migrated";
      report.notes.push(`[dry-run] keytar ${LEGACY_KEYTAR_SERVICE2} → ${NEW_KEYTAR_SERVICE} transfer`);
      return;
    }
    await keytar.setPassword(NEW_KEYTAR_SERVICE, LEGACY_KEYTAR_ACCOUNT, legacyKey);
    await keytar.deletePassword(LEGACY_KEYTAR_SERVICE2, LEGACY_KEYTAR_ACCOUNT);
    report.keytar = "migrated";
  } catch (e) {
    report.keytar = "error";
    report.errors.push(`keytar transfer 실패: ${e.message}`);
  }
}
function migrateLaunchd(report, dryRun) {
  if (process.platform !== "darwin" || !LEGACY_LAUNCHD_PLIST3 || !NEW_LAUNCHD_PLIST) {
    report.launchd = "n/a";
    return;
  }
  const legacyExists = fs3.existsSync(LEGACY_LAUNCHD_PLIST3);
  const newExists = fs3.existsSync(NEW_LAUNCHD_PLIST);
  if (!legacyExists) {
    report.launchd = newExists ? "already-new" : "no-legacy";
    return;
  }
  if (dryRun) {
    report.launchd = "migrated";
    report.notes.push(`[dry-run] launchctl unload ${LEGACY_LAUNCHD_LABEL2} + rm ${LEGACY_LAUNCHD_PLIST3}` + (newExists ? "" : ` (새 plist 는 init/launcher 가 다음 실행 시 생성)`));
    return;
  }
  try {
    try {
      execSync3(`launchctl unload "${LEGACY_LAUNCHD_PLIST3}"`, {
        stdio: ["ignore", "ignore", "ignore"]
      });
    } catch {}
    fs3.unlinkSync(LEGACY_LAUNCHD_PLIST3);
    report.launchd = "migrated";
    if (!newExists) {
      report.notes.push(`옛 plist 제거. 새 plist (${NEW_LAUNCHD_LABEL}) 는 다음 init/launcher 실행 시 자동 생성.`);
    }
  } catch (e) {
    report.errors.push(`launchd 마이그레이션 실패: ${e.message}`);
  }
}
async function runMigrate(opts = {}) {
  const dryRun = !!opts.dryRun;
  const report = {
    dataDir: "no-legacy",
    apiKeyFile: "no-legacy",
    keytar: "no-legacy",
    launchd: "no-legacy",
    errors: [],
    notes: []
  };
  migrateDataDir(report, dryRun);
  migrateApiKeyFile(report, dryRun);
  await migrateKeytar(report, dryRun);
  migrateLaunchd(report, dryRun);
  return report;
}
function printMigrateReport(r, dryRun) {
  const bar = "━".repeat(60);
  console.log(`\uD83D\uDD04 primus → z21labs 마이그레이션${dryRun ? " (dry-run)" : ""}`);
  console.log(bar);
  console.log(`  데이터 디렉토리: ${r.dataDir}`);
  console.log(`  API 키 파일:    ${r.apiKeyFile}`);
  console.log(`  keytar 서비스:  ${r.keytar}`);
  console.log(`  launchd plist:  ${r.launchd}`);
  console.log(bar);
  if (r.notes.length > 0) {
    console.log("");
    console.log("메모:");
    r.notes.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
  }
  if (r.errors.length > 0) {
    console.log("");
    console.log(`⚠️  에러 ${r.errors.length}건:`);
    r.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }
  if (dryRun) {
    console.log("");
    console.log("실행하려면 --dry-run 빼고 다시 실행하세요.");
  }
}

// src/index.ts
var program = new import_commander.Command;
program.name("usage-tracker").description("z21labs Claude Code usage tracker").version(CLI_VERSION);
program.command("init").description("인증 및 SessionEnd hook 등록").action(runInit);
program.command("repair").description("API 키 유지하고 hook·스케줄만 재등록").action(runRepair);
program.command("reset").description("API 키 재발급 및 재설정").action(runReset);
program.command("sync").description("과거 데이터 수동 동기화").option("-d, --days <number>", "동기화할 일수", "90").action((opts) => runSync(parseInt(opts.days)));
program.command("doctor").description("환경 진단 — Node·npm·codeburn·ccusage·자동화 상태").option("--json", "JSON 으로 출력 (머신 파싱용)").action((opts) => runDoctor({ json: !!opts.json, cliVersion: CLI_VERSION }));
program.command("migrate").description("primus → z21labs 마이그레이션 (옛 ~/.primus-usage-* → 새 ~/.z21labs/usage-*)").option("--dry-run", "실제로 변경하지 않고 계획만 출력").action(async (opts) => {
  const r = await runMigrate({ dryRun: !!opts.dryRun });
  printMigrateReport(r, !!opts.dryRun);
  if (r.errors.length > 0)
    process.exit(1);
});
if (process.argv[2] === "init" || process.argv.length <= 2) {
  program.parse(["node", "usage-tracker", "init", ...process.argv.slice(3)]);
} else {
  program.parse(process.argv);
}
