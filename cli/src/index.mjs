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

// ../node_modules/commander/lib/error.js
var require_error = __commonJS((exports) => {
  class CommanderError extends Error {
    constructor(exitCode, code, message) {
      super(message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.code = code;
      this.exitCode = exitCode;
      this.nestedError = undefined;
    }
  }

  class InvalidArgumentError extends CommanderError {
    constructor(message) {
      super(1, "commander.invalidArgument", message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
    }
  }
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
});

// ../node_modules/commander/lib/argument.js
var require_argument = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Argument {
    constructor(name, description) {
      this.description = description || "";
      this.variadic = false;
      this.parseArg = undefined;
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.argChoices = undefined;
      switch (name[0]) {
        case "<":
          this.required = true;
          this._name = name.slice(1, -1);
          break;
        case "[":
          this.required = false;
          this._name = name.slice(1, -1);
          break;
        default:
          this.required = true;
          this._name = name;
          break;
      }
      if (this._name.length > 3 && this._name.slice(-3) === "...") {
        this.variadic = true;
        this._name = this._name.slice(0, -3);
      }
    }
    name() {
      return this._name;
    }
    _concatValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      return previous.concat(value);
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._concatValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    argRequired() {
      this.required = true;
      return this;
    }
    argOptional() {
      this.required = false;
      return this;
    }
  }
  function humanReadableArgName(arg) {
    const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
    return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
  }
  exports.Argument = Argument;
  exports.humanReadableArgName = humanReadableArgName;
});

// ../node_modules/commander/lib/help.js
var require_help = __commonJS((exports) => {
  var { humanReadableArgName } = require_argument();

  class Help {
    constructor() {
      this.helpWidth = undefined;
      this.sortSubcommands = false;
      this.sortOptions = false;
      this.showGlobalOptions = false;
    }
    visibleCommands(cmd) {
      const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
      const helpCommand = cmd._getHelpCommand();
      if (helpCommand && !helpCommand._hidden) {
        visibleCommands.push(helpCommand);
      }
      if (this.sortSubcommands) {
        visibleCommands.sort((a, b) => {
          return a.name().localeCompare(b.name());
        });
      }
      return visibleCommands;
    }
    compareOptions(a, b) {
      const getSortKey = (option) => {
        return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
      };
      return getSortKey(a).localeCompare(getSortKey(b));
    }
    visibleOptions(cmd) {
      const visibleOptions = cmd.options.filter((option) => !option.hidden);
      const helpOption = cmd._getHelpOption();
      if (helpOption && !helpOption.hidden) {
        const removeShort = helpOption.short && cmd._findOption(helpOption.short);
        const removeLong = helpOption.long && cmd._findOption(helpOption.long);
        if (!removeShort && !removeLong) {
          visibleOptions.push(helpOption);
        } else if (helpOption.long && !removeLong) {
          visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
        } else if (helpOption.short && !removeShort) {
          visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
        }
      }
      if (this.sortOptions) {
        visibleOptions.sort(this.compareOptions);
      }
      return visibleOptions;
    }
    visibleGlobalOptions(cmd) {
      if (!this.showGlobalOptions)
        return [];
      const globalOptions = [];
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
        globalOptions.push(...visibleOptions);
      }
      if (this.sortOptions) {
        globalOptions.sort(this.compareOptions);
      }
      return globalOptions;
    }
    visibleArguments(cmd) {
      if (cmd._argsDescription) {
        cmd.registeredArguments.forEach((argument) => {
          argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
        });
      }
      if (cmd.registeredArguments.find((argument) => argument.description)) {
        return cmd.registeredArguments;
      }
      return [];
    }
    subcommandTerm(cmd) {
      const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
      return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : "");
    }
    optionTerm(option) {
      return option.flags;
    }
    argumentTerm(argument) {
      return argument.name();
    }
    longestSubcommandTermLength(cmd, helper) {
      return helper.visibleCommands(cmd).reduce((max, command) => {
        return Math.max(max, helper.subcommandTerm(command).length);
      }, 0);
    }
    longestOptionTermLength(cmd, helper) {
      return helper.visibleOptions(cmd).reduce((max, option) => {
        return Math.max(max, helper.optionTerm(option).length);
      }, 0);
    }
    longestGlobalOptionTermLength(cmd, helper) {
      return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
        return Math.max(max, helper.optionTerm(option).length);
      }, 0);
    }
    longestArgumentTermLength(cmd, helper) {
      return helper.visibleArguments(cmd).reduce((max, argument) => {
        return Math.max(max, helper.argumentTerm(argument).length);
      }, 0);
    }
    commandUsage(cmd) {
      let cmdName = cmd._name;
      if (cmd._aliases[0]) {
        cmdName = cmdName + "|" + cmd._aliases[0];
      }
      let ancestorCmdNames = "";
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
      }
      return ancestorCmdNames + cmdName + " " + cmd.usage();
    }
    commandDescription(cmd) {
      return cmd.description();
    }
    subcommandDescription(cmd) {
      return cmd.summary() || cmd.description();
    }
    optionDescription(option) {
      const extraInfo = [];
      if (option.argChoices) {
        extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (option.defaultValue !== undefined) {
        const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
        if (showDefault) {
          extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
        }
      }
      if (option.presetArg !== undefined && option.optional) {
        extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
      }
      if (option.envVar !== undefined) {
        extraInfo.push(`env: ${option.envVar}`);
      }
      if (extraInfo.length > 0) {
        return `${option.description} (${extraInfo.join(", ")})`;
      }
      return option.description;
    }
    argumentDescription(argument) {
      const extraInfo = [];
      if (argument.argChoices) {
        extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (argument.defaultValue !== undefined) {
        extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
      }
      if (extraInfo.length > 0) {
        const extraDescripton = `(${extraInfo.join(", ")})`;
        if (argument.description) {
          return `${argument.description} ${extraDescripton}`;
        }
        return extraDescripton;
      }
      return argument.description;
    }
    formatHelp(cmd, helper) {
      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth = helper.helpWidth || 80;
      const itemIndentWidth = 2;
      const itemSeparatorWidth = 2;
      function formatItem(term, description) {
        if (description) {
          const fullText = `${term.padEnd(termWidth + itemSeparatorWidth)}${description}`;
          return helper.wrap(fullText, helpWidth - itemIndentWidth, termWidth + itemSeparatorWidth);
        }
        return term;
      }
      function formatList(textArray) {
        return textArray.join(`
`).replace(/^/gm, " ".repeat(itemIndentWidth));
      }
      let output = [`Usage: ${helper.commandUsage(cmd)}`, ""];
      const commandDescription = helper.commandDescription(cmd);
      if (commandDescription.length > 0) {
        output = output.concat([
          helper.wrap(commandDescription, helpWidth, 0),
          ""
        ]);
      }
      const argumentList = helper.visibleArguments(cmd).map((argument) => {
        return formatItem(helper.argumentTerm(argument), helper.argumentDescription(argument));
      });
      if (argumentList.length > 0) {
        output = output.concat(["Arguments:", formatList(argumentList), ""]);
      }
      const optionList = helper.visibleOptions(cmd).map((option) => {
        return formatItem(helper.optionTerm(option), helper.optionDescription(option));
      });
      if (optionList.length > 0) {
        output = output.concat(["Options:", formatList(optionList), ""]);
      }
      if (this.showGlobalOptions) {
        const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
          return formatItem(helper.optionTerm(option), helper.optionDescription(option));
        });
        if (globalOptionList.length > 0) {
          output = output.concat([
            "Global Options:",
            formatList(globalOptionList),
            ""
          ]);
        }
      }
      const commandList = helper.visibleCommands(cmd).map((cmd2) => {
        return formatItem(helper.subcommandTerm(cmd2), helper.subcommandDescription(cmd2));
      });
      if (commandList.length > 0) {
        output = output.concat(["Commands:", formatList(commandList), ""]);
      }
      return output.join(`
`);
    }
    padWidth(cmd, helper) {
      return Math.max(helper.longestOptionTermLength(cmd, helper), helper.longestGlobalOptionTermLength(cmd, helper), helper.longestSubcommandTermLength(cmd, helper), helper.longestArgumentTermLength(cmd, helper));
    }
    wrap(str, width, indent, minColumnWidth = 40) {
      const indents = " \\f\\t\\v   -   　\uFEFF";
      const manualIndent = new RegExp(`[\\n][${indents}]+`);
      if (str.match(manualIndent))
        return str;
      const columnWidth = width - indent;
      if (columnWidth < minColumnWidth)
        return str;
      const leadingStr = str.slice(0, indent);
      const columnText = str.slice(indent).replace(`\r
`, `
`);
      const indentString = " ".repeat(indent);
      const zeroWidthSpace = "​";
      const breaks = `\\s${zeroWidthSpace}`;
      const regex = new RegExp(`
|.{1,${columnWidth - 1}}([${breaks}]|$)|[^${breaks}]+?([${breaks}]|$)`, "g");
      const lines = columnText.match(regex) || [];
      return leadingStr + lines.map((line, i) => {
        if (line === `
`)
          return "";
        return (i > 0 ? indentString : "") + line.trimEnd();
      }).join(`
`);
    }
  }
  exports.Help = Help;
});

// ../node_modules/commander/lib/option.js
var require_option = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Option {
    constructor(flags, description) {
      this.flags = flags;
      this.description = description || "";
      this.required = flags.includes("<");
      this.optional = flags.includes("[");
      this.variadic = /\w\.\.\.[>\]]$/.test(flags);
      this.mandatory = false;
      const optionFlags = splitOptionFlags(flags);
      this.short = optionFlags.shortFlag;
      this.long = optionFlags.longFlag;
      this.negate = false;
      if (this.long) {
        this.negate = this.long.startsWith("--no-");
      }
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.presetArg = undefined;
      this.envVar = undefined;
      this.parseArg = undefined;
      this.hidden = false;
      this.argChoices = undefined;
      this.conflictsWith = [];
      this.implied = undefined;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    preset(arg) {
      this.presetArg = arg;
      return this;
    }
    conflicts(names) {
      this.conflictsWith = this.conflictsWith.concat(names);
      return this;
    }
    implies(impliedOptionValues) {
      let newImplied = impliedOptionValues;
      if (typeof impliedOptionValues === "string") {
        newImplied = { [impliedOptionValues]: true };
      }
      this.implied = Object.assign(this.implied || {}, newImplied);
      return this;
    }
    env(name) {
      this.envVar = name;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    makeOptionMandatory(mandatory = true) {
      this.mandatory = !!mandatory;
      return this;
    }
    hideHelp(hide = true) {
      this.hidden = !!hide;
      return this;
    }
    _concatValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      return previous.concat(value);
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._concatValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    name() {
      if (this.long) {
        return this.long.replace(/^--/, "");
      }
      return this.short.replace(/^-/, "");
    }
    attributeName() {
      return camelcase(this.name().replace(/^no-/, ""));
    }
    is(arg) {
      return this.short === arg || this.long === arg;
    }
    isBoolean() {
      return !this.required && !this.optional && !this.negate;
    }
  }

  class DualOptions {
    constructor(options) {
      this.positiveOptions = new Map;
      this.negativeOptions = new Map;
      this.dualOptions = new Set;
      options.forEach((option) => {
        if (option.negate) {
          this.negativeOptions.set(option.attributeName(), option);
        } else {
          this.positiveOptions.set(option.attributeName(), option);
        }
      });
      this.negativeOptions.forEach((value, key) => {
        if (this.positiveOptions.has(key)) {
          this.dualOptions.add(key);
        }
      });
    }
    valueFromOption(value, option) {
      const optionKey = option.attributeName();
      if (!this.dualOptions.has(optionKey))
        return true;
      const preset = this.negativeOptions.get(optionKey).presetArg;
      const negativeValue = preset !== undefined ? preset : false;
      return option.negate === (negativeValue === value);
    }
  }
  function camelcase(str) {
    return str.split("-").reduce((str2, word) => {
      return str2 + word[0].toUpperCase() + word.slice(1);
    });
  }
  function splitOptionFlags(flags) {
    let shortFlag;
    let longFlag;
    const flagParts = flags.split(/[ |,]+/);
    if (flagParts.length > 1 && !/^[[<]/.test(flagParts[1]))
      shortFlag = flagParts.shift();
    longFlag = flagParts.shift();
    if (!shortFlag && /^-[^-]$/.test(longFlag)) {
      shortFlag = longFlag;
      longFlag = undefined;
    }
    return { shortFlag, longFlag };
  }
  exports.Option = Option;
  exports.DualOptions = DualOptions;
});

// ../node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS((exports) => {
  var maxDistance = 3;
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > maxDistance)
      return Math.max(a.length, b.length);
    const d = [];
    for (let i = 0;i <= a.length; i++) {
      d[i] = [i];
    }
    for (let j = 0;j <= b.length; j++) {
      d[0][j] = j;
    }
    for (let j = 1;j <= b.length; j++) {
      for (let i = 1;i <= a.length; i++) {
        let cost = 1;
        if (a[i - 1] === b[j - 1]) {
          cost = 0;
        } else {
          cost = 1;
        }
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }
  function suggestSimilar(word, candidates) {
    if (!candidates || candidates.length === 0)
      return "";
    candidates = Array.from(new Set(candidates));
    const searchingOptions = word.startsWith("--");
    if (searchingOptions) {
      word = word.slice(2);
      candidates = candidates.map((candidate) => candidate.slice(2));
    }
    let similar = [];
    let bestDistance = maxDistance;
    const minSimilarity = 0.4;
    candidates.forEach((candidate) => {
      if (candidate.length <= 1)
        return;
      const distance = editDistance(word, candidate);
      const length = Math.max(word.length, candidate.length);
      const similarity = (length - distance) / length;
      if (similarity > minSimilarity) {
        if (distance < bestDistance) {
          bestDistance = distance;
          similar = [candidate];
        } else if (distance === bestDistance) {
          similar.push(candidate);
        }
      }
    });
    similar.sort((a, b) => a.localeCompare(b));
    if (searchingOptions) {
      similar = similar.map((candidate) => `--${candidate}`);
    }
    if (similar.length > 1) {
      return `
(Did you mean one of ${similar.join(", ")}?)`;
    }
    if (similar.length === 1) {
      return `
(Did you mean ${similar[0]}?)`;
    }
    return "";
  }
  exports.suggestSimilar = suggestSimilar;
});

// ../node_modules/commander/lib/command.js
var require_command = __commonJS((exports) => {
  var EventEmitter = __require("node:events").EventEmitter;
  var childProcess = __require("node:child_process");
  var path = __require("node:path");
  var fs = __require("node:fs");
  var process2 = __require("node:process");
  var { Argument, humanReadableArgName } = require_argument();
  var { CommanderError } = require_error();
  var { Help } = require_help();
  var { Option, DualOptions } = require_option();
  var { suggestSimilar } = require_suggestSimilar();

  class Command extends EventEmitter {
    constructor(name) {
      super();
      this.commands = [];
      this.options = [];
      this.parent = null;
      this._allowUnknownOption = false;
      this._allowExcessArguments = true;
      this.registeredArguments = [];
      this._args = this.registeredArguments;
      this.args = [];
      this.rawArgs = [];
      this.processedArgs = [];
      this._scriptPath = null;
      this._name = name || "";
      this._optionValues = {};
      this._optionValueSources = {};
      this._storeOptionsAsProperties = false;
      this._actionHandler = null;
      this._executableHandler = false;
      this._executableFile = null;
      this._executableDir = null;
      this._defaultCommandName = null;
      this._exitCallback = null;
      this._aliases = [];
      this._combineFlagAndOptionalValue = true;
      this._description = "";
      this._summary = "";
      this._argsDescription = undefined;
      this._enablePositionalOptions = false;
      this._passThroughOptions = false;
      this._lifeCycleHooks = {};
      this._showHelpAfterError = false;
      this._showSuggestionAfterError = true;
      this._outputConfiguration = {
        writeOut: (str) => process2.stdout.write(str),
        writeErr: (str) => process2.stderr.write(str),
        getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : undefined,
        getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : undefined,
        outputError: (str, write) => write(str)
      };
      this._hidden = false;
      this._helpOption = undefined;
      this._addImplicitHelpCommand = undefined;
      this._helpCommand = undefined;
      this._helpConfiguration = {};
    }
    copyInheritedSettings(sourceCommand) {
      this._outputConfiguration = sourceCommand._outputConfiguration;
      this._helpOption = sourceCommand._helpOption;
      this._helpCommand = sourceCommand._helpCommand;
      this._helpConfiguration = sourceCommand._helpConfiguration;
      this._exitCallback = sourceCommand._exitCallback;
      this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
      this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
      this._allowExcessArguments = sourceCommand._allowExcessArguments;
      this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
      this._showHelpAfterError = sourceCommand._showHelpAfterError;
      this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
      return this;
    }
    _getCommandAndAncestors() {
      const result = [];
      for (let command = this;command; command = command.parent) {
        result.push(command);
      }
      return result;
    }
    command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
      let desc = actionOptsOrExecDesc;
      let opts = execOpts;
      if (typeof desc === "object" && desc !== null) {
        opts = desc;
        desc = null;
      }
      opts = opts || {};
      const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const cmd = this.createCommand(name);
      if (desc) {
        cmd.description(desc);
        cmd._executableHandler = true;
      }
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      cmd._hidden = !!(opts.noHelp || opts.hidden);
      cmd._executableFile = opts.executableFile || null;
      if (args)
        cmd.arguments(args);
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd.copyInheritedSettings(this);
      if (desc)
        return this;
      return cmd;
    }
    createCommand(name) {
      return new Command(name);
    }
    createHelp() {
      return Object.assign(new Help, this.configureHelp());
    }
    configureHelp(configuration) {
      if (configuration === undefined)
        return this._helpConfiguration;
      this._helpConfiguration = configuration;
      return this;
    }
    configureOutput(configuration) {
      if (configuration === undefined)
        return this._outputConfiguration;
      Object.assign(this._outputConfiguration, configuration);
      return this;
    }
    showHelpAfterError(displayHelp = true) {
      if (typeof displayHelp !== "string")
        displayHelp = !!displayHelp;
      this._showHelpAfterError = displayHelp;
      return this;
    }
    showSuggestionAfterError(displaySuggestion = true) {
      this._showSuggestionAfterError = !!displaySuggestion;
      return this;
    }
    addCommand(cmd, opts) {
      if (!cmd._name) {
        throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
      }
      opts = opts || {};
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      if (opts.noHelp || opts.hidden)
        cmd._hidden = true;
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd._checkForBrokenPassThrough();
      return this;
    }
    createArgument(name, description) {
      return new Argument(name, description);
    }
    argument(name, description, fn, defaultValue) {
      const argument = this.createArgument(name, description);
      if (typeof fn === "function") {
        argument.default(defaultValue).argParser(fn);
      } else {
        argument.default(fn);
      }
      this.addArgument(argument);
      return this;
    }
    arguments(names) {
      names.trim().split(/ +/).forEach((detail) => {
        this.argument(detail);
      });
      return this;
    }
    addArgument(argument) {
      const previousArgument = this.registeredArguments.slice(-1)[0];
      if (previousArgument && previousArgument.variadic) {
        throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
      }
      if (argument.required && argument.defaultValue !== undefined && argument.parseArg === undefined) {
        throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
      }
      this.registeredArguments.push(argument);
      return this;
    }
    helpCommand(enableOrNameAndArgs, description) {
      if (typeof enableOrNameAndArgs === "boolean") {
        this._addImplicitHelpCommand = enableOrNameAndArgs;
        return this;
      }
      enableOrNameAndArgs = enableOrNameAndArgs ?? "help [command]";
      const [, helpName, helpArgs] = enableOrNameAndArgs.match(/([^ ]+) *(.*)/);
      const helpDescription = description ?? "display help for command";
      const helpCommand = this.createCommand(helpName);
      helpCommand.helpOption(false);
      if (helpArgs)
        helpCommand.arguments(helpArgs);
      if (helpDescription)
        helpCommand.description(helpDescription);
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      return this;
    }
    addHelpCommand(helpCommand, deprecatedDescription) {
      if (typeof helpCommand !== "object") {
        this.helpCommand(helpCommand, deprecatedDescription);
        return this;
      }
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      return this;
    }
    _getHelpCommand() {
      const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
      if (hasImplicitHelpCommand) {
        if (this._helpCommand === undefined) {
          this.helpCommand(undefined, undefined);
        }
        return this._helpCommand;
      }
      return null;
    }
    hook(event, listener) {
      const allowedValues = ["preSubcommand", "preAction", "postAction"];
      if (!allowedValues.includes(event)) {
        throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      if (this._lifeCycleHooks[event]) {
        this._lifeCycleHooks[event].push(listener);
      } else {
        this._lifeCycleHooks[event] = [listener];
      }
      return this;
    }
    exitOverride(fn) {
      if (fn) {
        this._exitCallback = fn;
      } else {
        this._exitCallback = (err) => {
          if (err.code !== "commander.executeSubCommandAsync") {
            throw err;
          } else {}
        };
      }
      return this;
    }
    _exit(exitCode, code, message) {
      if (this._exitCallback) {
        this._exitCallback(new CommanderError(exitCode, code, message));
      }
      process2.exit(exitCode);
    }
    action(fn) {
      const listener = (args) => {
        const expectedArgsCount = this.registeredArguments.length;
        const actionArgs = args.slice(0, expectedArgsCount);
        if (this._storeOptionsAsProperties) {
          actionArgs[expectedArgsCount] = this;
        } else {
          actionArgs[expectedArgsCount] = this.opts();
        }
        actionArgs.push(this);
        return fn.apply(this, actionArgs);
      };
      this._actionHandler = listener;
      return this;
    }
    createOption(flags, description) {
      return new Option(flags, description);
    }
    _callParseArg(target, value, previous, invalidArgumentMessage) {
      try {
        return target.parseArg(value, previous);
      } catch (err) {
        if (err.code === "commander.invalidArgument") {
          const message = `${invalidArgumentMessage} ${err.message}`;
          this.error(message, { exitCode: err.exitCode, code: err.code });
        }
        throw err;
      }
    }
    _registerOption(option) {
      const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
      if (matchingOption) {
        const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
        throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
      }
      this.options.push(option);
    }
    _registerCommand(command) {
      const knownBy = (cmd) => {
        return [cmd.name()].concat(cmd.aliases());
      };
      const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
      if (alreadyUsed) {
        const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
        const newCmd = knownBy(command).join("|");
        throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
      }
      this.commands.push(command);
    }
    addOption(option) {
      this._registerOption(option);
      const oname = option.name();
      const name = option.attributeName();
      if (option.negate) {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(name, option.defaultValue === undefined ? true : option.defaultValue, "default");
        }
      } else if (option.defaultValue !== undefined) {
        this.setOptionValueWithSource(name, option.defaultValue, "default");
      }
      const handleOptionValue = (val, invalidValueMessage, valueSource) => {
        if (val == null && option.presetArg !== undefined) {
          val = option.presetArg;
        }
        const oldValue = this.getOptionValue(name);
        if (val !== null && option.parseArg) {
          val = this._callParseArg(option, val, oldValue, invalidValueMessage);
        } else if (val !== null && option.variadic) {
          val = option._concatValue(val, oldValue);
        }
        if (val == null) {
          if (option.negate) {
            val = false;
          } else if (option.isBoolean() || option.optional) {
            val = true;
          } else {
            val = "";
          }
        }
        this.setOptionValueWithSource(name, val, valueSource);
      };
      this.on("option:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "cli");
      });
      if (option.envVar) {
        this.on("optionEnv:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "env");
        });
      }
      return this;
    }
    _optionEx(config, flags, description, fn, defaultValue) {
      if (typeof flags === "object" && flags instanceof Option) {
        throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
      }
      const option = this.createOption(flags, description);
      option.makeOptionMandatory(!!config.mandatory);
      if (typeof fn === "function") {
        option.default(defaultValue).argParser(fn);
      } else if (fn instanceof RegExp) {
        const regex = fn;
        fn = (val, def) => {
          const m = regex.exec(val);
          return m ? m[0] : def;
        };
        option.default(defaultValue).argParser(fn);
      } else {
        option.default(fn);
      }
      return this.addOption(option);
    }
    option(flags, description, parseArg, defaultValue) {
      return this._optionEx({}, flags, description, parseArg, defaultValue);
    }
    requiredOption(flags, description, parseArg, defaultValue) {
      return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
    }
    combineFlagAndOptionalValue(combine = true) {
      this._combineFlagAndOptionalValue = !!combine;
      return this;
    }
    allowUnknownOption(allowUnknown = true) {
      this._allowUnknownOption = !!allowUnknown;
      return this;
    }
    allowExcessArguments(allowExcess = true) {
      this._allowExcessArguments = !!allowExcess;
      return this;
    }
    enablePositionalOptions(positional = true) {
      this._enablePositionalOptions = !!positional;
      return this;
    }
    passThroughOptions(passThrough = true) {
      this._passThroughOptions = !!passThrough;
      this._checkForBrokenPassThrough();
      return this;
    }
    _checkForBrokenPassThrough() {
      if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
        throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
      }
    }
    storeOptionsAsProperties(storeAsProperties = true) {
      if (this.options.length) {
        throw new Error("call .storeOptionsAsProperties() before adding options");
      }
      if (Object.keys(this._optionValues).length) {
        throw new Error("call .storeOptionsAsProperties() before setting option values");
      }
      this._storeOptionsAsProperties = !!storeAsProperties;
      return this;
    }
    getOptionValue(key) {
      if (this._storeOptionsAsProperties) {
        return this[key];
      }
      return this._optionValues[key];
    }
    setOptionValue(key, value) {
      return this.setOptionValueWithSource(key, value, undefined);
    }
    setOptionValueWithSource(key, value, source) {
      if (this._storeOptionsAsProperties) {
        this[key] = value;
      } else {
        this._optionValues[key] = value;
      }
      this._optionValueSources[key] = source;
      return this;
    }
    getOptionValueSource(key) {
      return this._optionValueSources[key];
    }
    getOptionValueSourceWithGlobals(key) {
      let source;
      this._getCommandAndAncestors().forEach((cmd) => {
        if (cmd.getOptionValueSource(key) !== undefined) {
          source = cmd.getOptionValueSource(key);
        }
      });
      return source;
    }
    _prepareUserArgs(argv, parseOptions) {
      if (argv !== undefined && !Array.isArray(argv)) {
        throw new Error("first parameter to parse must be array or undefined");
      }
      parseOptions = parseOptions || {};
      if (argv === undefined && parseOptions.from === undefined) {
        if (process2.versions?.electron) {
          parseOptions.from = "electron";
        }
        const execArgv = process2.execArgv ?? [];
        if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
          parseOptions.from = "eval";
        }
      }
      if (argv === undefined) {
        argv = process2.argv;
      }
      this.rawArgs = argv.slice();
      let userArgs;
      switch (parseOptions.from) {
        case undefined:
        case "node":
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
          break;
        case "electron":
          if (process2.defaultApp) {
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
          } else {
            userArgs = argv.slice(1);
          }
          break;
        case "user":
          userArgs = argv.slice(0);
          break;
        case "eval":
          userArgs = argv.slice(1);
          break;
        default:
          throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
      }
      if (!this._name && this._scriptPath)
        this.nameFromFilename(this._scriptPath);
      this._name = this._name || "program";
      return userArgs;
    }
    parse(argv, parseOptions) {
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      this._parseCommand([], userArgs);
      return this;
    }
    async parseAsync(argv, parseOptions) {
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      await this._parseCommand([], userArgs);
      return this;
    }
    _executeSubCommand(subcommand, args) {
      args = args.slice();
      let launchWithNode = false;
      const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
      function findFile(baseDir, baseName) {
        const localBin = path.resolve(baseDir, baseName);
        if (fs.existsSync(localBin))
          return localBin;
        if (sourceExt.includes(path.extname(baseName)))
          return;
        const foundExt = sourceExt.find((ext) => fs.existsSync(`${localBin}${ext}`));
        if (foundExt)
          return `${localBin}${foundExt}`;
        return;
      }
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
      let executableDir = this._executableDir || "";
      if (this._scriptPath) {
        let resolvedScriptPath;
        try {
          resolvedScriptPath = fs.realpathSync(this._scriptPath);
        } catch (err) {
          resolvedScriptPath = this._scriptPath;
        }
        executableDir = path.resolve(path.dirname(resolvedScriptPath), executableDir);
      }
      if (executableDir) {
        let localFile = findFile(executableDir, executableFile);
        if (!localFile && !subcommand._executableFile && this._scriptPath) {
          const legacyName = path.basename(this._scriptPath, path.extname(this._scriptPath));
          if (legacyName !== this._name) {
            localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
          }
        }
        executableFile = localFile || executableFile;
      }
      launchWithNode = sourceExt.includes(path.extname(executableFile));
      let proc;
      if (process2.platform !== "win32") {
        if (launchWithNode) {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
        } else {
          proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
        }
      } else {
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process2.execArgv).concat(args);
        proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
      }
      if (!proc.killed) {
        const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
        signals.forEach((signal) => {
          process2.on(signal, () => {
            if (proc.killed === false && proc.exitCode === null) {
              proc.kill(signal);
            }
          });
        });
      }
      const exitCallback = this._exitCallback;
      proc.on("close", (code) => {
        code = code ?? 1;
        if (!exitCallback) {
          process2.exit(code);
        } else {
          exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
        }
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
          const executableMissing = `'${executableFile}' does not exist
 - if '${subcommand._name}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
          throw new Error(executableMissing);
        } else if (err.code === "EACCES") {
          throw new Error(`'${executableFile}' not executable`);
        }
        if (!exitCallback) {
          process2.exit(1);
        } else {
          const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
          wrappedError.nestedError = err;
          exitCallback(wrappedError);
        }
      });
      this.runningCommand = proc;
    }
    _dispatchSubcommand(commandName, operands, unknown) {
      const subCommand = this._findCommand(commandName);
      if (!subCommand)
        this.help({ error: true });
      let promiseChain;
      promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
      promiseChain = this._chainOrCall(promiseChain, () => {
        if (subCommand._executableHandler) {
          this._executeSubCommand(subCommand, operands.concat(unknown));
        } else {
          return subCommand._parseCommand(operands, unknown);
        }
      });
      return promiseChain;
    }
    _dispatchHelpCommand(subcommandName) {
      if (!subcommandName) {
        this.help();
      }
      const subCommand = this._findCommand(subcommandName);
      if (subCommand && !subCommand._executableHandler) {
        subCommand.help();
      }
      return this._dispatchSubcommand(subcommandName, [], [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]);
    }
    _checkNumberOfArguments() {
      this.registeredArguments.forEach((arg, i) => {
        if (arg.required && this.args[i] == null) {
          this.missingArgument(arg.name());
        }
      });
      if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
        return;
      }
      if (this.args.length > this.registeredArguments.length) {
        this._excessArguments(this.args);
      }
    }
    _processArguments() {
      const myParseArg = (argument, value, previous) => {
        let parsedValue = value;
        if (value !== null && argument.parseArg) {
          const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
          parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
        }
        return parsedValue;
      };
      this._checkNumberOfArguments();
      const processedArgs = [];
      this.registeredArguments.forEach((declaredArg, index) => {
        let value = declaredArg.defaultValue;
        if (declaredArg.variadic) {
          if (index < this.args.length) {
            value = this.args.slice(index);
            if (declaredArg.parseArg) {
              value = value.reduce((processed, v) => {
                return myParseArg(declaredArg, v, processed);
              }, declaredArg.defaultValue);
            }
          } else if (value === undefined) {
            value = [];
          }
        } else if (index < this.args.length) {
          value = this.args[index];
          if (declaredArg.parseArg) {
            value = myParseArg(declaredArg, value, declaredArg.defaultValue);
          }
        }
        processedArgs[index] = value;
      });
      this.processedArgs = processedArgs;
    }
    _chainOrCall(promise, fn) {
      if (promise && promise.then && typeof promise.then === "function") {
        return promise.then(() => fn());
      }
      return fn();
    }
    _chainOrCallHooks(promise, event) {
      let result = promise;
      const hooks = [];
      this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== undefined).forEach((hookedCommand) => {
        hookedCommand._lifeCycleHooks[event].forEach((callback) => {
          hooks.push({ hookedCommand, callback });
        });
      });
      if (event === "postAction") {
        hooks.reverse();
      }
      hooks.forEach((hookDetail) => {
        result = this._chainOrCall(result, () => {
          return hookDetail.callback(hookDetail.hookedCommand, this);
        });
      });
      return result;
    }
    _chainOrCallSubCommandHook(promise, subCommand, event) {
      let result = promise;
      if (this._lifeCycleHooks[event] !== undefined) {
        this._lifeCycleHooks[event].forEach((hook) => {
          result = this._chainOrCall(result, () => {
            return hook(this, subCommand);
          });
        });
      }
      return result;
    }
    _parseCommand(operands, unknown) {
      const parsed = this.parseOptions(unknown);
      this._parseOptionsEnv();
      this._parseOptionsImplied();
      operands = operands.concat(parsed.operands);
      unknown = parsed.unknown;
      this.args = operands.concat(unknown);
      if (operands && this._findCommand(operands[0])) {
        return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
      }
      if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
        return this._dispatchHelpCommand(operands[1]);
      }
      if (this._defaultCommandName) {
        this._outputHelpIfRequested(unknown);
        return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
      }
      if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
        this.help({ error: true });
      }
      this._outputHelpIfRequested(parsed.unknown);
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      const checkForUnknownOptions = () => {
        if (parsed.unknown.length > 0) {
          this.unknownOption(parsed.unknown[0]);
        }
      };
      const commandEvent = `command:${this.name()}`;
      if (this._actionHandler) {
        checkForUnknownOptions();
        this._processArguments();
        let promiseChain;
        promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
        promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
        if (this.parent) {
          promiseChain = this._chainOrCall(promiseChain, () => {
            this.parent.emit(commandEvent, operands, unknown);
          });
        }
        promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
        return promiseChain;
      }
      if (this.parent && this.parent.listenerCount(commandEvent)) {
        checkForUnknownOptions();
        this._processArguments();
        this.parent.emit(commandEvent, operands, unknown);
      } else if (operands.length) {
        if (this._findCommand("*")) {
          return this._dispatchSubcommand("*", operands, unknown);
        }
        if (this.listenerCount("command:*")) {
          this.emit("command:*", operands, unknown);
        } else if (this.commands.length) {
          this.unknownCommand();
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      } else if (this.commands.length) {
        checkForUnknownOptions();
        this.help({ error: true });
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    }
    _findCommand(name) {
      if (!name)
        return;
      return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
    }
    _findOption(arg) {
      return this.options.find((option) => option.is(arg));
    }
    _checkForMissingMandatoryOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd.options.forEach((anOption) => {
          if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === undefined) {
            cmd.missingMandatoryOptionValue(anOption);
          }
        });
      });
    }
    _checkForConflictingLocalOptions() {
      const definedNonDefaultOptions = this.options.filter((option) => {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === undefined) {
          return false;
        }
        return this.getOptionValueSource(optionKey) !== "default";
      });
      const optionsWithConflicting = definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0);
      optionsWithConflicting.forEach((option) => {
        const conflictingAndDefined = definedNonDefaultOptions.find((defined) => option.conflictsWith.includes(defined.attributeName()));
        if (conflictingAndDefined) {
          this._conflictingOption(option, conflictingAndDefined);
        }
      });
    }
    _checkForConflictingOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd._checkForConflictingLocalOptions();
      });
    }
    parseOptions(argv) {
      const operands = [];
      const unknown = [];
      let dest = operands;
      const args = argv.slice();
      function maybeOption(arg) {
        return arg.length > 1 && arg[0] === "-";
      }
      let activeVariadicOption = null;
      while (args.length) {
        const arg = args.shift();
        if (arg === "--") {
          if (dest === unknown)
            dest.push(arg);
          dest.push(...args);
          break;
        }
        if (activeVariadicOption && !maybeOption(arg)) {
          this.emit(`option:${activeVariadicOption.name()}`, arg);
          continue;
        }
        activeVariadicOption = null;
        if (maybeOption(arg)) {
          const option = this._findOption(arg);
          if (option) {
            if (option.required) {
              const value = args.shift();
              if (value === undefined)
                this.optionMissingArgument(option);
              this.emit(`option:${option.name()}`, value);
            } else if (option.optional) {
              let value = null;
              if (args.length > 0 && !maybeOption(args[0])) {
                value = args.shift();
              }
              this.emit(`option:${option.name()}`, value);
            } else {
              this.emit(`option:${option.name()}`);
            }
            activeVariadicOption = option.variadic ? option : null;
            continue;
          }
        }
        if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
          const option = this._findOption(`-${arg[1]}`);
          if (option) {
            if (option.required || option.optional && this._combineFlagAndOptionalValue) {
              this.emit(`option:${option.name()}`, arg.slice(2));
            } else {
              this.emit(`option:${option.name()}`);
              args.unshift(`-${arg.slice(2)}`);
            }
            continue;
          }
        }
        if (/^--[^=]+=/.test(arg)) {
          const index = arg.indexOf("=");
          const option = this._findOption(arg.slice(0, index));
          if (option && (option.required || option.optional)) {
            this.emit(`option:${option.name()}`, arg.slice(index + 1));
            continue;
          }
        }
        if (maybeOption(arg)) {
          dest = unknown;
        }
        if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
          if (this._findCommand(arg)) {
            operands.push(arg);
            if (args.length > 0)
              unknown.push(...args);
            break;
          } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
            operands.push(arg);
            if (args.length > 0)
              operands.push(...args);
            break;
          } else if (this._defaultCommandName) {
            unknown.push(arg);
            if (args.length > 0)
              unknown.push(...args);
            break;
          }
        }
        if (this._passThroughOptions) {
          dest.push(arg);
          if (args.length > 0)
            dest.push(...args);
          break;
        }
        dest.push(arg);
      }
      return { operands, unknown };
    }
    opts() {
      if (this._storeOptionsAsProperties) {
        const result = {};
        const len = this.options.length;
        for (let i = 0;i < len; i++) {
          const key = this.options[i].attributeName();
          result[key] = key === this._versionOptionName ? this._version : this[key];
        }
        return result;
      }
      return this._optionValues;
    }
    optsWithGlobals() {
      return this._getCommandAndAncestors().reduce((combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()), {});
    }
    error(message, errorOptions) {
      this._outputConfiguration.outputError(`${message}
`, this._outputConfiguration.writeErr);
      if (typeof this._showHelpAfterError === "string") {
        this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
      } else if (this._showHelpAfterError) {
        this._outputConfiguration.writeErr(`
`);
        this.outputHelp({ error: true });
      }
      const config = errorOptions || {};
      const exitCode = config.exitCode || 1;
      const code = config.code || "commander.error";
      this._exit(exitCode, code, message);
    }
    _parseOptionsEnv() {
      this.options.forEach((option) => {
        if (option.envVar && option.envVar in process2.env) {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === undefined || ["default", "config", "env"].includes(this.getOptionValueSource(optionKey))) {
            if (option.required || option.optional) {
              this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
            } else {
              this.emit(`optionEnv:${option.name()}`);
            }
          }
        }
      });
    }
    _parseOptionsImplied() {
      const dualHelper = new DualOptions(this.options);
      const hasCustomOptionValue = (optionKey) => {
        return this.getOptionValue(optionKey) !== undefined && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
      };
      this.options.filter((option) => option.implied !== undefined && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option)).forEach((option) => {
        Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
          this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
        });
      });
    }
    missingArgument(name) {
      const message = `error: missing required argument '${name}'`;
      this.error(message, { code: "commander.missingArgument" });
    }
    optionMissingArgument(option) {
      const message = `error: option '${option.flags}' argument missing`;
      this.error(message, { code: "commander.optionMissingArgument" });
    }
    missingMandatoryOptionValue(option) {
      const message = `error: required option '${option.flags}' not specified`;
      this.error(message, { code: "commander.missingMandatoryOptionValue" });
    }
    _conflictingOption(option, conflictingOption) {
      const findBestOptionFromValue = (option2) => {
        const optionKey = option2.attributeName();
        const optionValue = this.getOptionValue(optionKey);
        const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
        const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
        if (negativeOption && (negativeOption.presetArg === undefined && optionValue === false || negativeOption.presetArg !== undefined && optionValue === negativeOption.presetArg)) {
          return negativeOption;
        }
        return positiveOption || option2;
      };
      const getErrorMessage = (option2) => {
        const bestOption = findBestOptionFromValue(option2);
        const optionKey = bestOption.attributeName();
        const source = this.getOptionValueSource(optionKey);
        if (source === "env") {
          return `environment variable '${bestOption.envVar}'`;
        }
        return `option '${bestOption.flags}'`;
      };
      const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
      this.error(message, { code: "commander.conflictingOption" });
    }
    unknownOption(flag) {
      if (this._allowUnknownOption)
        return;
      let suggestion = "";
      if (flag.startsWith("--") && this._showSuggestionAfterError) {
        let candidateFlags = [];
        let command = this;
        do {
          const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
          candidateFlags = candidateFlags.concat(moreFlags);
          command = command.parent;
        } while (command && !command._enablePositionalOptions);
        suggestion = suggestSimilar(flag, candidateFlags);
      }
      const message = `error: unknown option '${flag}'${suggestion}`;
      this.error(message, { code: "commander.unknownOption" });
    }
    _excessArguments(receivedArgs) {
      if (this._allowExcessArguments)
        return;
      const expected = this.registeredArguments.length;
      const s = expected === 1 ? "" : "s";
      const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
      const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
      this.error(message, { code: "commander.excessArguments" });
    }
    unknownCommand() {
      const unknownName = this.args[0];
      let suggestion = "";
      if (this._showSuggestionAfterError) {
        const candidateNames = [];
        this.createHelp().visibleCommands(this).forEach((command) => {
          candidateNames.push(command.name());
          if (command.alias())
            candidateNames.push(command.alias());
        });
        suggestion = suggestSimilar(unknownName, candidateNames);
      }
      const message = `error: unknown command '${unknownName}'${suggestion}`;
      this.error(message, { code: "commander.unknownCommand" });
    }
    version(str, flags, description) {
      if (str === undefined)
        return this._version;
      this._version = str;
      flags = flags || "-V, --version";
      description = description || "output the version number";
      const versionOption = this.createOption(flags, description);
      this._versionOptionName = versionOption.attributeName();
      this._registerOption(versionOption);
      this.on("option:" + versionOption.name(), () => {
        this._outputConfiguration.writeOut(`${str}
`);
        this._exit(0, "commander.version", str);
      });
      return this;
    }
    description(str, argsDescription) {
      if (str === undefined && argsDescription === undefined)
        return this._description;
      this._description = str;
      if (argsDescription) {
        this._argsDescription = argsDescription;
      }
      return this;
    }
    summary(str) {
      if (str === undefined)
        return this._summary;
      this._summary = str;
      return this;
    }
    alias(alias) {
      if (alias === undefined)
        return this._aliases[0];
      let command = this;
      if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
        command = this.commands[this.commands.length - 1];
      }
      if (alias === command._name)
        throw new Error("Command alias can't be the same as its name");
      const matchingCommand = this.parent?._findCommand(alias);
      if (matchingCommand) {
        const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
        throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`);
      }
      command._aliases.push(alias);
      return this;
    }
    aliases(aliases) {
      if (aliases === undefined)
        return this._aliases;
      aliases.forEach((alias) => this.alias(alias));
      return this;
    }
    usage(str) {
      if (str === undefined) {
        if (this._usage)
          return this._usage;
        const args = this.registeredArguments.map((arg) => {
          return humanReadableArgName(arg);
        });
        return [].concat(this.options.length || this._helpOption !== null ? "[options]" : [], this.commands.length ? "[command]" : [], this.registeredArguments.length ? args : []).join(" ");
      }
      this._usage = str;
      return this;
    }
    name(str) {
      if (str === undefined)
        return this._name;
      this._name = str;
      return this;
    }
    nameFromFilename(filename) {
      this._name = path.basename(filename, path.extname(filename));
      return this;
    }
    executableDir(path2) {
      if (path2 === undefined)
        return this._executableDir;
      this._executableDir = path2;
      return this;
    }
    helpInformation(contextOptions) {
      const helper = this.createHelp();
      if (helper.helpWidth === undefined) {
        helper.helpWidth = contextOptions && contextOptions.error ? this._outputConfiguration.getErrHelpWidth() : this._outputConfiguration.getOutHelpWidth();
      }
      return helper.formatHelp(this, helper);
    }
    _getHelpContext(contextOptions) {
      contextOptions = contextOptions || {};
      const context = { error: !!contextOptions.error };
      let write;
      if (context.error) {
        write = (arg) => this._outputConfiguration.writeErr(arg);
      } else {
        write = (arg) => this._outputConfiguration.writeOut(arg);
      }
      context.write = contextOptions.write || write;
      context.command = this;
      return context;
    }
    outputHelp(contextOptions) {
      let deprecatedCallback;
      if (typeof contextOptions === "function") {
        deprecatedCallback = contextOptions;
        contextOptions = undefined;
      }
      const context = this._getHelpContext(contextOptions);
      this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", context));
      this.emit("beforeHelp", context);
      let helpInformation = this.helpInformation(context);
      if (deprecatedCallback) {
        helpInformation = deprecatedCallback(helpInformation);
        if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
          throw new Error("outputHelp callback must return a string or a Buffer");
        }
      }
      context.write(helpInformation);
      if (this._getHelpOption()?.long) {
        this.emit(this._getHelpOption().long);
      }
      this.emit("afterHelp", context);
      this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", context));
    }
    helpOption(flags, description) {
      if (typeof flags === "boolean") {
        if (flags) {
          this._helpOption = this._helpOption ?? undefined;
        } else {
          this._helpOption = null;
        }
        return this;
      }
      flags = flags ?? "-h, --help";
      description = description ?? "display help for command";
      this._helpOption = this.createOption(flags, description);
      return this;
    }
    _getHelpOption() {
      if (this._helpOption === undefined) {
        this.helpOption(undefined, undefined);
      }
      return this._helpOption;
    }
    addHelpOption(option) {
      this._helpOption = option;
      return this;
    }
    help(contextOptions) {
      this.outputHelp(contextOptions);
      let exitCode = process2.exitCode || 0;
      if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
        exitCode = 1;
      }
      this._exit(exitCode, "commander.help", "(outputHelp)");
    }
    addHelpText(position, text) {
      const allowedValues = ["beforeAll", "before", "after", "afterAll"];
      if (!allowedValues.includes(position)) {
        throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      const helpEvent = `${position}Help`;
      this.on(helpEvent, (context) => {
        let helpStr;
        if (typeof text === "function") {
          helpStr = text({ error: context.error, command: context.command });
        } else {
          helpStr = text;
        }
        if (helpStr) {
          context.write(`${helpStr}
`);
        }
      });
      return this;
    }
    _outputHelpIfRequested(args) {
      const helpOption = this._getHelpOption();
      const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
      if (helpRequested) {
        this.outputHelp();
        this._exit(0, "commander.helpDisplayed", "(outputHelp)");
      }
    }
  }
  function incrementNodeInspectorPort(args) {
    return args.map((arg) => {
      if (!arg.startsWith("--inspect")) {
        return arg;
      }
      let debugOption;
      let debugHost = "127.0.0.1";
      let debugPort = "9229";
      let match;
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
        return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
      }
      return arg;
    });
  }
  exports.Command = Command;
});

// ../node_modules/commander/index.js
var require_commander = __commonJS((exports) => {
  var { Argument } = require_argument();
  var { Command } = require_command();
  var { CommanderError, InvalidArgumentError } = require_error();
  var { Help } = require_help();
  var { Option } = require_option();
  exports.program = new Command;
  exports.createCommand = (name) => new Command(name);
  exports.createOption = (flags, description) => new Option(flags, description);
  exports.createArgument = (name, description) => new Argument(name, description);
  exports.Command = Command;
  exports.Option = Option;
  exports.Argument = Argument;
  exports.Help = Help;
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
  exports.InvalidOptionArgumentError = InvalidArgumentError;
});

// ../node_modules/commander/esm.mjs
var import__ = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  Command,
  Argument,
  Option,
  Help
} = import__.default;

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
var CLI_VERSION = "0.3.4";
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
  const isWindows = process.platform === "win32";
  const cmd = isWindows ? `powershell -NoProfile -Command "irm ${SERVER_URL}/install.ps1 | iex"` : `curl -fsSL ${SERVER_URL}/install.sh | bash`;
  const installer = isWindows ? "install.ps1 (PowerShell)" : "install.sh";
  console.log("");
  console.log(`\uD83D\uDCE6 ${installer} 자동 실행 중 (Node 22 + 자동 init)...`);
  console.log("");
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch {
    console.error("");
    console.error("❌ 자동 복구 실패. 수동 절차:");
    console.error(`   ${cmd}`);
    console.error(`   npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair`);
    process.exit(1);
  }
  console.log("");
  console.log(bar);
  console.log("✅ 환경 설정 완료");
  console.log("");
  if (isWindows) {
    console.log("   현재 셸은 옛 PATH 를 볼 수 있습니다. 새 Node 적용:");
    console.log("     1. PowerShell 새 창 열고 repair 재실행 — 권장");
    console.log("        npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  } else {
    console.log("   현재 셸은 아직 옛 PATH 를 보고 있습니다. 새 Node 적용:");
    console.log("     1. 터미널 새 창 (⌘N) 열고 repair 재실행 — 권장");
    console.log("     2. 또는 현재 셸에서: exec $SHELL -l");
    console.log("        그 다음: npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
  }
  console.log(bar);
  console.log("");
  process.exit(0);
}
function preflightNodeVersion() {
  const major = parseInt((process.versions.node ?? "0").split(".")[0], 10);
  if (!Number.isFinite(major) || major >= 22)
    return;
  const bar = "═".repeat(60);
  const isWindows = process.platform === "win32";
  if (process.env.AIUSAGE_FROM_INSTALL_SH === "1") {
    console.error(`
` + bar);
    console.error(`❌ Node 22 자동 설치 후에도 Node ${process.versions.node} 로 실행됨`);
    console.error("");
    console.error("   원인: 새 Node binary 가 npx 의 PATH 에 적용되지 않았음.");
    console.error("   수동 복구:");
    if (isWindows) {
      console.error("     1. PowerShell 새 창 열기");
      console.error("     2. node -v  ← v22.x.x 확인");
      console.error("     3. npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
    } else {
      console.error("     1. 터미널 새 창 (⌘N) 열기");
      console.error("     2. node -v  ← v22.x.x 확인");
      console.error("     3. npx --yes github:eugene-eee-hongkyu/ai-usage-tracker repair");
    }
    console.error(bar + `
`);
    process.exit(1);
  }
  console.error(`
` + bar);
  console.error(`⚠️  Node ${process.versions.node} 감지 — codeburn / ccusage 는 Node 22 이상 필요`);
  console.error("");
  console.error("   이대로 install 하면:");
  console.error("     - npm EBADENGINE 경고 (install 자체는 됨)");
  console.error("     - codeburn / ccusage 런타임 오작동 위험");
  console.error("     - 자동 동기화 (launchd / Task Scheduler) 가 silent 실패 가능");
  console.error("");
  console.error("   자동 복구 가능:");
  if (isWindows) {
    console.error("     - winget 으로 Node.js LTS (v22) 설치/업그레이드");
    console.error("     - 기존 Node 그대로 보존 (LTS 만 추가/갱신)");
  } else {
    console.error("     - nvm 설치 (~/.nvm/ 안에만, 시스템 Node 그대로 보존)");
    console.error("     - Node 22 설치 + 기본값으로 설정");
    console.error("     - ~/.zshrc 자동 백업 후 nvm 라인 추가");
  }
  console.error("");
  console.error("   롤백 방법:");
  if (isWindows) {
    console.error("     winget 으로 옛 Node LTS 재설치 또는 제어판 → 프로그램 제거");
  } else {
    console.error("     nvm use system          # 셸 1개만 옛 Node 로");
    console.error(`     nvm alias default ${major}    # 기본을 다시 옛 버전으로`);
  }
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
    if (isWindows) {
      console.error("     winget upgrade OpenJS.NodeJS.LTS");
      console.error("     # 또는 https://nodejs.org/ko/download 에서 LTS 직접 설치");
    } else {
      console.error("     nvm install 22 && nvm use 22 && nvm alias default 22");
    }
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
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function getApiKeyViaLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${CLI_PORT}`);
      const apiKey = url.searchParams.get("apiKey");
      const email = url.searchParams.get("email") ?? "";
      const device = url.searchParams.get("device") ?? "";
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (apiKey) {
        const emailLine = email ? `<p style='font-size:0.9em;color:#555'>계정: <b>${escapeHtml(email)}</b></p>` : "";
        const deviceLine = device ? `<p style='font-size:0.9em;color:#555'>디바이스: <b>${escapeHtml(device)}</b></p>` : "";
        res.end("<html><body style='font-family:sans-serif;padding:2em'><h2>&#x2705; Authentication Complete</h2>" + emailLine + deviceLine + "<p>이 창을 닫고 터미널로 돌아가세요. 터미널에 <code>✨ 설치 완료</code> 메시지가 떠야 정상입니다.</p>" + "</body></html>");
        if (email)
          console.log(`
✓ OAuth 로그인 완료 — 계정: ${email}${device ? ` · 디바이스: ${device}` : ""}`);
        server.close();
        resolve(apiKey);
      } else {
        res.end("<html><body><h2>Waiting...</h2></body></html>");
      }
    });
    server.listen(CLI_PORT, "127.0.0.1", () => {
      const hostname2 = (() => {
        try {
          return os.hostname().slice(0, 64);
        } catch {
          return "";
        }
      })();
      const params = new URLSearchParams({ port: String(CLI_PORT) });
      if (hostname2)
        params.set("device", hostname2);
      const authUrl = `${SERVER_URL}/api/cli-auth?${params.toString()}`;
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
  <integer>3600</integer>
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
  console.log("✓ 자동 수집 등록 — 1시간마다 사용량을 보냅니다 (sleep 후 깨어나도 즉시 보충)");
}
function registerWindowsTask(submitPath) {
  const taskName = "Z21labsUsageTracker";
  const vbsPath = path.join(STABLE_DIR, "daily-sync.vbs");
  const xmlPath = path.join(STABLE_DIR, "task.xml");
  const legacyCmd = path.join(STABLE_DIR, "daily-sync.cmd");
  const vbs = `CreateObject("WScript.Shell").Run """${process.execPath}"" ""${submitPath}""", 0, False\r
`;
  fs.writeFileSync(vbsPath, Buffer.from("\uFEFF" + vbs, "utf16le"));
  try {
    fs.unlinkSync(legacyCmd);
  } catch {}
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2000-01-01T00:00:00</StartBoundary>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
      <Repetition>
        <Interval>PT1H</Interval>
        <Duration>P1D</Duration>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </CalendarTrigger>
  </Triggers>
  <Settings>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
  </Settings>
  <Actions>
    <Exec>
      <Command>wscript.exe</Command>
      <Arguments>"${vbsPath}"</Arguments>
    </Exec>
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
    console.log("✓ 자동 수집 등록 — 1시간마다 사용량을 보냅니다");
  } else {
    console.log("⚠ 자동 수집 등록에 실패했어요 (수동으로도 가능합니다)");
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
  const isWin = process.platform === "win32";
  const child = spawn(process.execPath, [scriptPath], {
    detached: !isWin,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL
    }
  });
  child.unref();
  console.log("\uD83D\uDCE6 과거 데이터 백그라운드 수집 시작");
}
function runImmediateSync(apiKey) {
  if (!fs.existsSync(STABLE_SUBMIT))
    return;
  const isWin = process.platform === "win32";
  const child = spawn(process.execPath, [STABLE_SUBMIT], {
    detached: !isWin,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      USAGE_TRACKER_API_KEY: apiKey,
      USAGE_TRACKER_URL: SERVER_URL,
      _USAGE_TRACKER_DETACHED: "1"
    }
  });
  child.unref();
  console.log("\uD83D\uDCE4 지금 데이터 수집 중... (백그라운드)");
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
  console.log("\uD83D\uDCDA 지난 8주 / 12개월 기록도 함께 가져오고 있어요 (백그라운드, 약 5~10분)");
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
  try {
    execSync("npm install -g codeburn@0.9.11", { stdio: ["ignore", "ignore", "pipe"] });
    return true;
  } catch (e) {
    process.stderr.write(`   (codeburn 설치 실패: ${e.message?.slice(0, 80) ?? ""})
`);
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
  try {
    execSync("npm install -g ccusage@20.0.6", { stdio: ["ignore", "ignore", "pipe"] });
    return true;
  } catch (e) {
    process.stderr.write(`   (ccusage 설치 실패: ${e.message?.slice(0, 80) ?? ""})
`);
    return false;
  }
}
async function ensureCcusage() {
  const hadBefore = checkCcusage();
  const installed = await installCcusage();
  if (installed && checkCcusage())
    return true;
  if (hadBefore) {
    console.log("   ⚠ ccusage 업데이트 실패 — 기존 버전으로 계속합니다");
    return true;
  }
  const bar = "═".repeat(60);
  console.log(`
` + bar);
  console.log("❌ ccusage 설치 실패 — 토큰/비용 데이터가 수집되지 않습니다.");
  console.log("   수동 설치 후 다시 실행:");
  console.log("       npm install -g ccusage@19.0.2");
  console.log("       curl -fsSL https://aiusage.z21labs.world/install.sh | bash");
  console.log(bar + `
`);
  return false;
}
async function ensureCodeburn() {
  const hadBefore = checkCodeburn();
  const installed = await installCodeburn();
  if (installed && checkCodeburn())
    return true;
  if (hadBefore) {
    console.log("   ⚠ codeburn 업데이트 실패 — 기존 버전으로 계속합니다");
    return true;
  }
  return false;
}
async function runRepair() {
  preflightOwnership();
  preflightGlobalPackages();
  preflightNodeVersion();
  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error("❌ 인증 정보가 없습니다. 처음 설치하시려면 다음 명령으로 실행해주세요:");
    console.error("   curl -fsSL https://aiusage.z21labs.world/install.sh | bash");
    process.exit(1);
  }
  try {
    const verifyResp = await fetch(`${SERVER_URL}/api/auth/verify`, {
      method: "GET",
      headers: { "x-api-key": apiKey }
    });
    if (verifyResp.status === 401) {
      console.log("⚠ 저장된 인증 정보가 만료됐거나 폐기됐어요. 다시 로그인합니다...");
      await deleteApiKey();
      return runInit();
    }
    if (!verifyResp.ok) {
      console.log(`⚠ 인증 확인 일시 실패 (${verifyResp.status}). 그대로 진행합니다.`);
    } else {
      console.log("✓ 인증 확인");
    }
  } catch (e) {
    console.log(`⚠ 인증 확인 네트워크 오류 (${e.message ?? "unknown"}). 그대로 진행합니다.`);
  }
  console.log("\uD83D\uDCE6 의존성 설치 중...");
  const codeburnOk = await ensureCodeburn();
  if (!codeburnOk) {
    console.error("❌ codeburn 사용 불가 상태. 수동 설치 후 다시 시도하세요:");
    console.error("   npm install -g codeburn@0.9.7");
    process.exit(1);
  }
  const ccusageOk = await ensureCcusage();
  if (codeburnOk && ccusageOk)
    console.log(`   ✓ 완료
`);
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
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✨ AI Usage Tracker v${CLI_VERSION} 업데이트 완료`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   이제 자동으로 사용량이 수집됩니다.");
  console.log(`   \uD83D\uDCCA 대시보드:  ${SERVER_URL}/dashboard`);
  console.log(`   \uD83D\uDD0D 진단:      ${SERVER_URL}/setup-status
`);
  if (!ccusageOk) {
    console.log(`⚠ 주의: ccusage 가 없어 토큰/비용 데이터는 비어 있어요.
`);
  }
  process.exit(0);
}
async function runInit() {
  preflightOwnership();
  preflightGlobalPackages();
  preflightNodeVersion();
  console.log("\uD83D\uDCE6 의존성 설치 중...");
  const codeburnOk = await ensureCodeburn();
  if (!codeburnOk) {
    console.error("❌ codeburn 설치 실패. 수동으로 설치 후 다시 시도하세요:");
    console.error("   npm install -g codeburn@0.9.7");
    process.exit(1);
  }
  const ccusageOk = await ensureCcusage();
  if (codeburnOk && ccusageOk)
    console.log(`   ✓ 완료
`);
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
  console.log("✓ 인증 키 저장");
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  fs.copyFileSync(path.join(__dirname2, "submit.mjs"), STABLE_SUBMIT);
  fs.copyFileSync(path.join(__dirname2, "historical.mjs"), STABLE_HISTORICAL);
  removeHook();
  registerDailySchedule(STABLE_SUBMIT);
  runBackfill(apiKey);
  runHistoricalBackfill(apiKey);
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✨ AI Usage Tracker v${CLI_VERSION} 설치 완료`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   이제 자동으로 사용량이 수집됩니다.");
  console.log(`   \uD83D\uDCCA 대시보드:  ${SERVER_URL}/dashboard`);
  console.log(`   \uD83D\uDD0D 진단:      ${SERVER_URL}/setup-status
`);
  if (!ccusageOk) {
    console.log(`⚠ 주의: ccusage 가 없어 토큰/비용 데이터는 비어 있어요.
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
var PROVIDERS = ["claude", "codex"];
var SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
var childEnv = { ...process.env, TZ: SYSTEM_TZ, CODEBURN_TZ: SYSTEM_TZ };
function spawnCodeburn(provider, period) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const proc = spawn2("codeburn", ["report", "--format", "json", "--provider", provider, "--period", period], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: childEnv
    });
    proc.stdout.on("data", (d) => chunks.push(d));
    proc.on("close", (code) => {
      if (code !== 0)
        return reject(new Error(`codeburn exited ${code} (${provider}/${period})`));
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8").trim()));
      } catch (e) {
        reject(e);
      }
    });
    proc.on("error", reject);
    setTimeout(() => {
      proc.kill();
      reject(new Error(`codeburn timeout (${provider}/${period})`));
    }, 600000);
  });
}
function spawnCcusageDaily(provider) {
  return new Promise((resolve) => {
    const chunks = [];
    const proc = spawn2("ccusage", [provider, "daily", "--json"], {
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
async function collectForProvider(provider) {
  const [results, ccusageDaily] = await Promise.all([
    Promise.all(PERIODS.map((p) => spawnCodeburn(provider, p))),
    spawnCcusageDaily(provider)
  ]);
  const providerReport = Object.fromEntries(PERIODS.map((p, i) => [p, results[i]]));
  if (ccusageDaily)
    providerReport.ccusageDaily = ccusageDaily;
  return providerReport;
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
  console.log(`codeburn + ccusage 데이터 수집 중 (claude + codex)... (destinations: ${summary})`);
  let report;
  try {
    const [claudeReport, codexReport] = await Promise.all(PROVIDERS.map((p) => collectForProvider(p)));
    report = { claude: claudeReport, codex: codexReport };
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
  const lower = nodePath.toLowerCase();
  if (lower.includes("\\nvm\\") || lower.includes("\\.nvm\\"))
    return "nvm";
  if (lower.includes("\\.volta\\"))
    return "volta";
  if (lower.includes("\\fnm\\") || lower.includes("\\.fnm\\"))
    return "fnm";
  if (lower.includes("\\program files\\nodejs\\") || lower.includes("\\program files (x86)\\nodejs\\"))
    return "pkg_installer";
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
  const interestingValues = new Set(["migrated", "error"]);
  const hasInteresting = interestingValues.has(r.dataDir) || interestingValues.has(r.apiKeyFile) || interestingValues.has(r.keytar) || interestingValues.has(r.launchd) || r.errors.length > 0 || dryRun;
  if (!hasInteresting) {
    return;
  }
  const bar = "━".repeat(60);
  console.log(`\uD83D\uDD04 옛 데이터 마이그레이션${dryRun ? " (dry-run)" : ""}`);
  console.log(bar);
  if (interestingValues.has(r.dataDir))
    console.log(`  데이터 디렉토리: ${r.dataDir}`);
  if (interestingValues.has(r.apiKeyFile))
    console.log(`  API 키 파일:    ${r.apiKeyFile}`);
  if (interestingValues.has(r.keytar))
    console.log(`  keytar:        ${r.keytar}`);
  if (interestingValues.has(r.launchd))
    console.log(`  launchd plist:  ${r.launchd}`);
  console.log(bar);
  if (r.notes.length > 0) {
    console.log("");
    console.log("메모:");
    r.notes.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
  }
  if (r.errors.length > 0) {
    console.log("");
    console.log(`⚠ 에러 ${r.errors.length}건:`);
    r.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }
  if (dryRun) {
    console.log("");
    console.log("실행하려면 --dry-run 빼고 다시 실행하세요.");
  }
}

// src/compat-check.ts
import { spawn as spawn3 } from "child_process";
import * as os4 from "os";
var TIMEOUT_MS = 600000;
var PERIODS2 = ["today", "week", "month", "30days", "all"];
function run(cmd, args) {
  return new Promise((resolve) => {
    const useShell = process.platform === "win32";
    const proc = spawn3(cmd, args, { shell: useShell, env: { ...process.env, TZ: Intl.DateTimeFormat().resolvedOptions().timeZone } });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => {
      stdout += b.toString();
    });
    proc.stderr.on("data", (b) => {
      stderr += b.toString();
    });
    const t = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ stdout, stderr: stderr + `
[timeout]`, code: null });
    }, TIMEOUT_MS);
    proc.on("close", (code) => {
      clearTimeout(t);
      resolve({ stdout, stderr, code });
    });
    proc.on("error", (e) => {
      clearTimeout(t);
      resolve({ stdout, stderr: stderr + `
` + e.message, code: null });
    });
  });
}
function parseJson(stdout, label) {
  try {
    return { ok: true, raw: JSON.parse(stdout) };
  } catch (e) {
    return { ok: false, raw: null, error: `JSON parse (${label}): ${e.message}. head: ${stdout.slice(0, 200)}` };
  }
}
async function captureCcusage(binary, provider) {
  const r = await run(binary[0], [...binary.slice(1), provider, "daily", "--json"]);
  if (r.code !== 0)
    return { ok: false, raw: null, error: `exit ${r.code}: ${r.stderr.trim().slice(0, 500)}` };
  return parseJson(r.stdout, `ccusage ${provider}`);
}
async function captureCodeburn(binary, provider, period) {
  const r = await run(binary[0], [...binary.slice(1), "report", "--format", "json", "--provider", provider, "--period", period]);
  if (r.code !== 0)
    return { ok: false, raw: null, error: `exit ${r.code}: ${r.stderr.trim().slice(0, 500)}` };
  return parseJson(r.stdout, `codeburn ${provider}/${period}`);
}
function ccusageRowCount(raw) {
  const r = raw;
  return Array.isArray(r?.daily) ? r.daily.length : 0;
}
function codeburnSummary(raw) {
  const r = raw;
  const daily = Array.isArray(r?.daily) ? r.daily.length : 0;
  const cost = r?.overview?.totalCost ?? 0;
  const calls = r?.overview?.totalCalls ?? 0;
  return `daily=${daily} cost=$${Number(cost).toFixed(2)} calls=${calls}`;
}
async function captureAllCcusage(binary, label) {
  console.log(`    ccusage (${label}) — claude/codex daily...`);
  const claude = await captureCcusage(binary, "claude");
  const codex = await captureCcusage(binary, "codex");
  console.log(`      claude: ${claude.ok ? `${ccusageRowCount(claude.raw)} rows` : `❌ ${claude.error}`}`);
  console.log(`      codex:  ${codex.ok ? `${ccusageRowCount(codex.raw)} rows` : `❌ ${codex.error}`}`);
  return { claude, codex };
}
async function captureAllCodeburn(binary, label) {
  console.log(`    codeburn (${label}) — claude/codex × ${PERIODS2.length} period...`);
  const out = {
    claude: {},
    codex: {}
  };
  for (const provider of ["claude", "codex"]) {
    for (const period of PERIODS2) {
      out[provider][period] = await captureCodeburn(binary, provider, period);
    }
    const ok = PERIODS2.filter((p) => out[provider][p].ok);
    const fail = PERIODS2.filter((p) => !out[provider][p].ok);
    const sampleOk = ok[0] ? `${ok[0]}: ${codeburnSummary(out[provider][ok[0]].raw)}` : "all failed";
    console.log(`      ${provider}: ${ok.length}/${PERIODS2.length} ok — ${sampleOk}${fail.length ? ` (fail: ${fail.join(",")})` : ""}`);
  }
  return out;
}
function semverOk(v) {
  return typeof v === "string" && /^\d+\.\d+\.\d+/.test(v);
}
async function runCompatCheck(opts = {}) {
  const ccusageTarget = opts.ccusageTarget;
  const codeburnTarget = opts.codeburnTarget;
  if (!semverOk(ccusageTarget) || !semverOk(codeburnTarget)) {
    console.error("❌ 비교할 ccusage / codeburn 버전 둘 다 명시해야 합니다.");
    console.error("");
    console.error("  예:");
    console.error("    npx -y github:eugene-eee-hongkyu/ai-usage-tracker compat-check \\");
    console.error("      --ccusage-target 20.0.6 --codeburn-target 0.9.11");
    console.error("");
    console.error("  버전 목록:");
    console.error("    ccusage  https://github.com/ryoppippi/ccusage/releases");
    console.error("    codeburn https://github.com/getagentseal/codeburn/releases");
    process.exit(2);
  }
  console.log("");
  console.log(`ccusage + codeburn compat-check`);
  console.log(`  ccusage  prod vs @${ccusageTarget}`);
  console.log(`  codeburn prod vs @${codeburnTarget}`);
  console.log("");
  const dests = await loadDestinations();
  const dest = dests.find((d) => d.apiKey) ?? dests[0];
  if (!dest?.apiKey) {
    console.error("❌ API key 없음. 먼저 `npx github:eugene-eee-hongkyu/ai-usage-tracker init` 후 다시 실행.");
    process.exit(3);
  }
  console.log(`송신지: ${dest.url}`);
  console.log("");
  console.log("[1/6] 옛 ccusage 버전 확인...");
  const oldCcusageVer = await run("ccusage", ["--version"]);
  if (oldCcusageVer.code !== 0) {
    console.error(`❌ ccusage 미설치 또는 실행 실패: ${oldCcusageVer.stderr.trim()}`);
    console.error("   먼저 'npm i -g ccusage' 로 설치하고 다시 시도.");
    process.exit(4);
  }
  const oldCcusageVersion = oldCcusageVer.stdout.trim();
  console.log(`    prod ccusage: ${oldCcusageVersion}`);
  console.log("[2/6] 옛 codeburn 버전 확인...");
  const oldCodeburnVer = await run("codeburn", ["--version"]);
  if (oldCodeburnVer.code !== 0) {
    console.error(`❌ codeburn 미설치 또는 실행 실패: ${oldCodeburnVer.stderr.trim()}`);
    console.error("   먼저 'npm i -g codeburn' 로 설치하고 다시 시도.");
    process.exit(5);
  }
  const oldCodeburnVersion = oldCodeburnVer.stdout.trim().split(`
`)[0];
  console.log(`    prod codeburn: ${oldCodeburnVersion}`);
  console.log("[3/6] 옛 ccusage 캡처...");
  const ccusageOld = await captureAllCcusage(["ccusage"], "prod");
  console.log("[4/6] 옛 codeburn 캡처 — 5 period × 2 provider...");
  const codeburnOld = await captureAllCodeburn(["codeburn"], "prod");
  console.log(`[5/6] 새 버전 캡처 — npx 첫 호출 시 다운로드 (각 도구 10-30초)...`);
  const ccusageNew = await captureAllCcusage(["npx", "-y", `ccusage@${ccusageTarget}`], `@${ccusageTarget}`);
  const codeburnNew = await captureAllCodeburn(["npx", "-y", `codeburn@${codeburnTarget}`], `@${codeburnTarget}`);
  console.log("[6/6] 서버 전송...");
  const body = {
    cliVersion: CLI_VERSION,
    runAt: new Date().toISOString(),
    os: `${os4.platform()}-${os4.arch()}-${os4.release()}`,
    ccusage: {
      oldVersion: oldCcusageVersion,
      newVersion: ccusageTarget,
      claude: { old: ccusageOld.claude.raw, new: ccusageNew.claude.raw, oldError: ccusageOld.claude.error, newError: ccusageNew.claude.error },
      codex: { old: ccusageOld.codex.raw, new: ccusageNew.codex.raw, oldError: ccusageOld.codex.error, newError: ccusageNew.codex.error }
    },
    codeburn: {
      oldVersion: oldCodeburnVersion,
      newVersion: codeburnTarget,
      claude: Object.fromEntries(PERIODS2.map((p) => [p, {
        old: codeburnOld.claude[p].raw,
        new: codeburnNew.claude[p].raw,
        oldError: codeburnOld.claude[p].error,
        newError: codeburnNew.claude[p].error
      }])),
      codex: Object.fromEntries(PERIODS2.map((p) => [p, {
        old: codeburnOld.codex[p].raw,
        new: codeburnNew.codex[p].raw,
        oldError: codeburnOld.codex[p].error,
        newError: codeburnNew.codex[p].error
      }]))
    }
  };
  const url = `${dest.url}/api/ccusage-compat`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": dest.apiKey },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error(`❌ 서버 응답 ${resp.status}: ${text.slice(0, 500)}`);
    process.exit(6);
  }
  console.log(`✓ 전송 완료 — 서버 응답: ${text.slice(0, 200)}`);
  console.log("");
  console.log("끝. 사용자 prod ccusage / codeburn 환경은 그대로입니다 (글로벌 설치 미변경).");
}

// src/index.ts
var program2 = new Command;
program2.name("usage-tracker").description("z21labs Claude Code usage tracker").version(CLI_VERSION);
program2.command("init").description("인증 및 SessionEnd hook 등록").action(runInit);
program2.command("repair").description("API 키 유지하고 hook·스케줄만 재등록").action(runRepair);
program2.command("reset").description("API 키 재발급 및 재설정").action(runReset);
program2.command("sync").description("과거 데이터 수동 동기화").option("-d, --days <number>", "동기화할 일수", "90").action((opts) => runSync(parseInt(opts.days)));
program2.command("doctor").description("환경 진단 — Node·npm·codeburn·ccusage·자동화 상태").option("--json", "JSON 으로 출력 (머신 파싱용)").action((opts) => runDoctor({ json: !!opts.json, cliVersion: CLI_VERSION }));
program2.command("migrate").description("primus → z21labs 마이그레이션 (옛 ~/.primus-usage-* → 새 ~/.z21labs/usage-*)").option("--dry-run", "실제로 변경하지 않고 계획만 출력").action(async (opts) => {
  const r = await runMigrate({ dryRun: !!opts.dryRun });
  printMigrateReport(r, !!opts.dryRun);
  if (r.errors.length > 0)
    process.exit(1);
});
program2.command("compat-check").description("ccusage + codeburn 현재 vs 비교 대상 버전 raw 출력 업로드 (글로벌 미변경)").requiredOption("--ccusage-target <version>", "비교할 ccusage 버전 (예: 20.0.6) — 명시 버전만").requiredOption("--codeburn-target <version>", "비교할 codeburn 버전 (예: 0.9.11) — 명시 버전만").action((opts) => runCompatCheck({ ccusageTarget: opts.ccusageTarget, codeburnTarget: opts.codeburnTarget }));
if (process.argv[2] === "init" || process.argv.length <= 2) {
  program2.parse(["node", "usage-tracker", "init", ...process.argv.slice(3)]);
} else {
  program2.parse(process.argv);
}
