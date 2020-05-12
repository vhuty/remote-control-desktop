const SimplePeer = require('simple-peer');

const constraints = {
  audio: false,
  video: {
    mandatory: {
      chromeMediaSource: 'desktop',
      maxWidth: screen.availWidth,
      maxHeight: screen.availHeight,
    },
    optional: [],
  },
};

module.exports.getPeer = async () => {
  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  const peer = new SimplePeer({
    initiator: false,
    trickle: false,
    stream,
  });

  return peer;
}
