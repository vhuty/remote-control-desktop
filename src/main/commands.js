const { shell, app } = require('electron');
const robot = require('robotjs');
const { exec } = require('child_process');
const { promisify } = require('util');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

const device = require('./device');

const execPromise = promisify(exec);

const PLATFORMS = {
  LINUX: 'Linux',
  WINDOWS: 'Windows_NT',
  DARWIN: 'Darwin',
};

const SYSTEM_CALLS = {
  TURN_OFF: {
    [PLATFORMS.LINUX]: (timeout = 0) => `shutdown -h ${timeout}`,
    [PLATFORMS.WINDOWS]: (timeout = 0) => `shutdown /s /t ${timeout}`,
  },
  REBOOT: {
    [PLATFORMS.LINUX]: (timeout = 0) => `shutdown -r ${timeout}`,
    [PLATFORMS.WINDOWS]: (timeout = 0) => `shutdown /r ${timeout}`,
  },
  CANCEL: {
    [PLATFORMS.LINUX]: (_) => `shutdown -c`,
    [PLATFORMS.WINDOWS]: (_) => `shutdown /a`,
  },
};

class Executor {
  commands = [
    {
      /* Save note as text file */
      pattern: /(?<content>.+) save note(?<alias> as (?<name>.+))?$/i,
      action: async ({ matcher }) => {
        const {
          groups: { content, alias, name },
        } = matcher;

        const filename = alias
          ? `${name}.txt`
          : `Note for ${new Date().toDateString()}.txt`;

        /* Default path to storing notes - Desktop directory */
        const filepath = path.join(os.homedir(), 'Desktop', filename);

        await fsp.writeFile(filepath, content);

        return {
          payload: `"${filename}" has been saved`,
        };
      },
    },
    {
      pattern: /^browse (.+)$/i,
      action: async ({ matcher }) => {
        const [, resource] = matcher;
        await shell.openExternal(`https://${resource}`);

        return {
          payload: 'Browsing resource...',
        };
      },
    },
    {
      /* Make google search request */
      pattern: /^google (?<request>.+)$/i,
      action: async ({ matcher }) => {
        const { request } = matcher.groups;
        
        await shell.openExternal(`https://www.google.com/search?q=${request}`);

        return {
          payload: `"Googling": ${request}...`,
        };
      }
    },
    {
      /* Type string on the keyboard */
      pattern: /^type (.+)$/i,
      action: async ({ matcher }) => {
        const [, text] = matcher;
        robot.typeString(text);

        return { payload: `Typing: ${text}...` };
      },
    },
    {
      /* Search in system */
      pattern: /^search (.+)$/i,
      action: async ({ matcher }) => {
        const [, query] = matcher;

        robot.keyTap('command');
        robot.typeString(query);

        return { payload: `Searching: ${query}...` };
      },
    },
    {
      /* Close current window */
      pattern: /^close$/i,
      action: () => {
        robot.keyTap('f4', 'alt');

        return { payload: 'Closing...' };
      },
    },
    {
      pattern: /^toggle$/i,
      action: () => {
        robot.keyTap('d', 'command');

        return {
          payload: 'Hiding...'
        };
      }
    },
    {
      /* Switch between opened windows */
      pattern: /^switch$/i,
      action: () => {
        robot.keyTap('tab', 'command');

        return {
          payload: 'Switching...'
        };
      }
    },
    {
      pattern: /^mute$/i,
      action: async ({ platform }) => {
        const result = { payload: 'Muting...' };

        switch (platform) {
          case PLATFORMS.LINUX: {
            try {
              await execPromise('amixer -q -D pulse sset Master toggle');
            } catch (err) {
              console.error(err);
            }

            return result;
          }
          case PLATFORMS.WINDOWS: {
            const appRoot = app.getAppPath();
            const nircmdPath = process.mainModule.filename.includes('app.asar') 
             ? path.join(appRoot, '..', 'util', 'nircmdc.exe')
             : path.join(appRoot, 'util', 'nircmdc.exe');

            try {
              await execPromise(`${nircmdPath} mutesysvolume 2`);
            } catch (err) {
              console.error(err);
            }

            return result;
          }
          case PLATFORMS.DARWIN: {
            //TODO: implement on Darwin

            return {};
          }
        }
      },
    },
    {
      /* Log out */
      pattern: /^log ?out$/i,
      action: () => {
        robot.keyTap('l', 'command');

        return { payload: 'Logging out...' };
      },
    },
    {
      pattern: /^(?<action>turn off|reboot|cancel)(\s+in\s+(?<timeout>\d+)\s+minutes)?$/,
      action: async ({ matcher, platform }) => {
        const {
          groups: {
            action,
            timeout = 0, //In minutes
          },
        } = matcher;

        switch (true) {
          case /turn off/i.test(action): {
            const call = SYSTEM_CALLS.TURN_OFF[platform](timeout);
            await execPromise(call);

            return { payload: 'Turning off...' };
          }
          case /reboot/i.test(action): {
            const call = SYSTEM_CALLS.REBOOT[platform](timeout);
            await execPromise(call);

            return { payload: 'Rebooting...' };
          }
          case /cancel/i.test(action): {
            const call = SYSTEM_CALLS.CANCEL[platform]();
            await execPromise(call);

            return { payload: 'Aborting...' };
          }
        }
      },
    },
  ];

  async validate(body) {
    const command = this.commands.find((cmd) => {
      return cmd.pattern.test(body);
    });

    if (!command) {
      return { error: 'Command not recognized' };
    }

    const platform = await device.getType();

    const { pattern, action } = command;
    const matcher = body.match(pattern);

    return action({ matcher, platform });
  }
}

module.exports = new Executor();
