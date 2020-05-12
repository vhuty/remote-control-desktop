const { shell } = require('electron');
const robot = require('robotjs');
// import screenshot from 'screenshot-desktop';
// import Tesseract from 'tesseract.js';
const { exec } = require('child_process');
const { promisify } = require('util');
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
    // {
    //   pattern: /^screen (?<target>.+)$/i,
    //   action: async ({ matcher }) => {
    //     // const midx = 653 - 565 / 2;
    //     // const midy = 61 - 31 / 2;
    //     // robot.moveMouse(565, 31);
    //     const {
    //       groups: { target },
    //     } = matcher;
    //     const buffer = await screenshot({ filename: 'shot.jpg' });
    //     // const buffer = await screenshot();
    //     console.time('tes');
    //     const {
    //       data: { words },
    //     } = await Tesseract.recognize(buffer, 'eng');
    //     console.timeEnd('tes');
    //     const word = words.find(({ text }) => text === target);
    //     if (word) {
    //       const { bbox } = word;
    //       const axisXMiddle = ~~((bbox.x1 - bbox.x0) / 2);
    //       const axisX = bbox.x0 + axisXMiddle;
    //       const axisYMiddle = ~~((bbox.y1 - bbox.y0) / 2);
    //       const axisY = bbox.y0 + axisYMiddle;
    //       robot.moveMouse(axisX, axisY);
    //     }
    //   },
    // },
    {
      pattern: /^browse (.+)$/i,
      action: async ({ matcher }) => {
        const [, resource] = matcher;
        await shell.openExternal(`https://${resource}/`);

        return {
          payload: 'Browsing resource...',
        };
      },
    },
    {
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
      /* Log out */
      pattern: /^log ?out$/i,
      action: () => {
        robot.keyTap('l', 'command');

        return { payload: 'Logging out...' };
      },
    },
    {
      pattern: /^mute$/i,
      action: async ({ platform }) => {
        const result = { payload: 'Muting' };

        switch (platform) {
          case PLATFORMS.LINUX: {
            await execPromise('amixer -q -D pulse sset Master toggle');

            return result;
          }
          case PLATFORMS.WINDOWS: {
            //TODO: test on Windows
            const winShell = new ActiveXObject('WScript.Shell');
            winShell.SendKeys(String.fromCharCode(0xad));
            /* OR: oShell.SendKeys(Chr(&HAD)); */
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
      pattern: /^(?<action>(turn off|reboot|cancel))(\s*in\s+(?<timeout>\d)\s+minutes)?$/,
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

  constructor() {}

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
