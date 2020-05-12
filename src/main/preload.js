const device = require('./device');

Promise.all([device.getID(), device.getName(), device.getType()]).then(
  ([id, name, type]) => {
    window.$device = {
      id,
      name,
      type,
    };
  }
);
