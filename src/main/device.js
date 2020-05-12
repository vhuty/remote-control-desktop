const os = require('os');
const { machineId } = require('node-machine-id');

const device = {
  async getID() {
    return machineId(true);
  },

  async getName() {
    return os.hostname();
  },

  async getType() {
    return os.type();
  },
};

module.exports = device;
