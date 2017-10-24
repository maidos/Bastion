/**
 * @file commandHandler
 * @author Sankarsan Kampa (a.k.a k3rn31p4nic)
 * @license MIT
 */

const parseArgs = require('command-line-args');
const COLOR = require('chalk');
const activeUsers = {};

/**
 * Handles Bastion's commands
 * @param {Message} message Discord.js message object
 * @returns {void}
 */
module.exports = async message => {
  try {
    let guild = await message.client.db.get(`SELECT prefix, language, ignoredChannels, ignoredRoles FROM guildSettings WHERE guildID=${message.guild.id}`);

    if (!message.guild.prefix || message.guild.prefix.join(' ') !== guild.prefix) {
      message.guild.prefix = guild.prefix.trim().split(' ');
    }
    if (!message.guild.language || message.guild.language !== guild.language) {
      message.guild.language = guild.language;
    }

    let usedPrefix;
    if (!message.guild.prefix.some(prefix => message.content.startsWith(usedPrefix = prefix))) return;

    if (!message.member.hasPermission('ADMINISTRATOR')) {
      if (guild.ignoredChannels) {
        if (guild.ignoredChannels.split(' ').includes(message.channel.id)) return;
      }

      if (guild.ignoredRoles) {
        let ignoredRoles = guild.ignoredRoles.split(' ');
        for (let roleID of ignoredRoles) {
          if (message.member.roles.has(roleID)) return;
        }
      }
    }

    let args = message.content.split(' ');
    let command = args.shift().slice(usedPrefix.length).toLowerCase();

    let cmd;
    if (message.client.commands.has(command)) {
      cmd = message.client.commands.get(command);
    }
    else if (message.client.aliases.has(command)) {
      cmd = message.client.commands.get(message.client.aliases.get(command).toLowerCase());
    }
    else return;
    let mdl = cmd.config.module;

    message.client.log.console(`\n[${new Date()}]`);
    message.client.log.console(COLOR.green('[COMMAND]: ') + usedPrefix + command);
    message.client.log.console(COLOR.green('[ARGUMENTs]: ') + (args.join(' ') || COLOR.yellow('No arguments to execute')));
    message.client.log.console(COLOR.green('[MODULE]: ') + mdl);
    message.client.log.console(`${COLOR.green('[SERVER]:')} ${message.guild} ${COLOR.cyan(`<#${message.guild.id}>`)}`);
    message.client.log.console(`${COLOR.green('[CHANNEL]:')} #${message.channel.name} ${COLOR.cyan(message.channel)}`);
    message.client.log.console(`${COLOR.green('[USER]:')} ${message.author.tag} ${COLOR.cyan(`${message.author}`)}`);

    if (!cmd.config.enabled) {
      return message.client.log.info('This command is disabled.');
    }

    if (message.channel.topic) {
      let parsedTopic = message.channel.topic.split('\n').filter(str => str.length);
      parsedTopic = parsedTopic[parsedTopic.length - 1];

      let topicSyntax = new RegExp(`${message.client.user.id}:(?:(?:enableCommands|disableCommands):[a-z ]+|(?:enableModules|disableModules):[a-z ]+)`, 'i');

      if (topicSyntax.test(parsedTopic)) {
        parsedTopic = parsedTopic.toLowerCase().split(':');
        if (parsedTopic.length >= 3) {
          let filteredCommands = parsedTopic[2].split(' ');

          switch (parsedTopic[1]) {
            case 'enablecommands':
              if (!filteredCommands.includes(command)) {
                return message.client.log.info('This command is disabled via channel topic.');
              }
              break;
            case 'disablecommands':
              if (filteredCommands.includes(command) || filteredCommands.includes('all')) {
                return message.client.log.info('This command is disabled via channel topic.');
              }
              break;
            case 'enablemodules':
              if (!filteredCommands.includes(mdl.toLowerCase())) {
                return message.client.log.info('This module is disabled via channel topic.');
              }
              break;
            case 'disablemodules':
              if (filteredCommands.includes(mdl.toLowerCase()) || filteredCommands.includes('all')) {
                return message.client.log.info('This module is disabled via channel topic.');
              }
              break;
            default:
              break;
          }
        }
      }
    }

    if (cmd.config.userCooldown && typeof cmd.config.userCooldown === 'number' && cmd.config.userCooldown >= 1 && cmd.config.userCooldown <= 1440) {
      if (!activeUsers.hasOwnProperty(cmd.help.name)) {
        activeUsers[cmd.help.name] = [];
      }
      if (activeUsers[cmd.help.name].includes(message.author.id)) {
        /**
         * Error condition is encountered.
         * @fires error
         */
        return message.client.emit('error', message.client.strings.error(message.guild.language, 'cooldown'), message.client.strings.error(message.guild.language, 'cooldown', true, `<@${message.author.id}>`, cmd.help.name, cmd.config.userCooldown), message.channel);
      }
    }

    let isSuccessRun = await cmd.run(message.client, message, parseArgs(cmd.config.argsDefinitions, { argv: args, partial: true }));

    if (isSuccessRun === true) {
      activeUsers[cmd.help.name].push(message.author.id);
    }
  }
  catch (e) {
    message.client.log.error(e);
  }
};
