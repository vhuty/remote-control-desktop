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
    [PLATFORMS.LINUX]: () => `shutdown -c`,
    [PLATFORMS.WINDOWS]: () => `shutdown /a`,
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
      },
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
      action: async () => {
        robot.keyTap('f4', 'alt');

        return { payload: 'Closing...' };
      },
    },
    {
      pattern: /^toggle$/i,
      action: async () => {
        robot.keyTap('d', 'command');

        return {
          payload: 'Hiding...',
        };
      },
    },
    {
      /* Switch between opened windows */
      pattern: /^switch$/i,
      action: async () => {
        robot.keyTap('tab', 'command');

        return {
          payload: 'Switching...',
        };
      },
    },
    {
      pattern: /^louder$/i,
      action: async () => {
        robot.keyTap('audio_vol_up');

        return { payload: 'Making volume louder...' };
      },
    },
    {
      pattern: /^quieter$/i,
      action: async () => {
        robot.keyTap('audio_vol_down');

        return { payload: 'Making volume quieter...' };
      },
    },
    {
      pattern: /^play$/i,
      action: async () => {
        robot.keyTap('audio_play');

        return { payload: 'Playing...' };
      },
    },
    {
      pattern: /^pause$/i,
      action: async () => {
        robot.keyTap('audio_pause');

        return { payload: 'Paused' };
      },
    },
    {
      pattern: /^stop$/i,
      action: async () => {
        robot.keyTap('audio_stop');

        return { payload: 'Stopped' };
      },
    },
    {
      pattern: /^next$/i,
      action: async () => {
        robot.keyTap('audio_next');

        return { payload: 'Playing next...' };
      },
    },
    {
      pattern: /^previous$/i,
      action: async () => {
        robot.keyTap('audio_prev');

        return { payload: 'Playing previous...' };
      },
    },
    {
      /* Log out */
      pattern: /^log ?out$/i,
      action: async ({ platform }) => {
        let command;

        switch (platform) {
          case PLATFORMS.LINUX: {
            command = 'xdg-screensaver lock';

            break;
          }
          case PLATFORMS.WINDOWS: {
            command = 'rundll32.exe user32.dll,LockWorkStation';

            break;
          }
          case PLATFORMS.DARWIN: {
            //TODO: implement on Darwin
            break;
          }
        }

        try {
          const { stdout, stderr } = await execPromise(command);
          if (stdout || stderr) {
            return { payload: stdout + stderr };
          }
        } catch (err) {
          return { payload: err.message };
        }

        return { payload: 'Logging out...' };
      },
    },
    {
      pattern: /^(?<action>turn off|reboot|cancel)(\s+in\s+(?<timeout>\d+)\s+(?<unit>seconds?|minutes?|hours?))?$/,
      action: async ({ matcher, platform }) => {
        const {
          groups: { action, timeout = 0, unit = '' },
        } = matcher;

        const platformTimeout = _convertTime(timeout, unit, platform);

        switch (true) {
          case /turn off/i.test(action): {
            const call = SYSTEM_CALLS.TURN_OFF[platform](platformTimeout);
            await execPromise(call);

            return { payload: 'Turning off...' };
          }
          case /reboot/i.test(action): {
            const call = SYSTEM_CALLS.REBOOT[platform](platformTimeout);
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
    {
      pattern: /(?<key>.+)/,
      action: async ({ matcher }) => {
        const { key } = matcher.groups;
        const sanitized = key
          .toLowerCase()
          .replace(/\s+/, '')
          .replace('windows', 'command');

        try {
          robot.keyTap(sanitized);
        } catch (err) {
          return {
            error: err.message,
          };
        }

        return { payload: `"${key}" - pressed` };
      },
    },
  ];

  async validate(body, predefinedCommands) {
    if (predefinedCommands && predefinedCommands.length) {
      const predefined = predefinedCommands.find(
        (cmd) => cmd.phrase.toLowerCase() === body.toLowerCase()
      );

      if (predefined) {
        if (predefined.defaultManner) {
          /* Execute command body in the desktop's default manner */
          try {
            const url = new URL(predefined.body);
            await shell.openExternal(url.href);
          } catch (err) {
            if (err.code !== 'ERR_INVALID_URL') {
              /* System failure */
              return { payload: err.message };
            }
          }
          /* Command body is not URL - try to run as a file */
          const failure = await shell.openPath(predefined.body);
          if (failure) {
            return { payload: failure };
          }
        } else {
          /* Directly execute command body */
          try {
            const { stdout, stderr } = await execPromise(predefined.body);
            if (stdout || stderr) {
              return { payload: stdout + stderr };
            }
          } catch (err) {
            return { payload: err.message };
          }
        }

        return { payload: `"${body}" has been executed` };
      }
    }

    const command = this.commands.find((cmd) => {
      return cmd.pattern.test(body.toLowerCase());
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

function _convertTime(timeout, unit, platform) {
  switch (platform) {
    case PLATFORMS.LINUX: {
      switch (true) {
        case unit.startsWith('second'):
          timeout /= 60;
          break;
        case unit.startsWith('hour'):
          timeout *= 60;
          break;
      }
      break;
    }
    case PLATFORMS.WINDOWS: {
      switch (true) {
        case unit.startsWith('minute'):
          timeout *= 60;
          break;
        case unit.startsWith('hour'):
          timeout *= 3600;
          break;
      }
      break;
    }
    case PLATFORMS.DARWIN: {
      //TODO: implement on Darwin
      break;
    }
  }

  return timeout < 1 ? 1 : timeout;
}

module.exports = new Executor();
