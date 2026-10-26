// The camera page that runs inside a WebView on phones (Expo Go has react-native-webview, but no API
// that hands raw camera frames to JavaScript). It opens the back camera, turns on the flash where the
// phone allows it, and posts the average colour of each frame to the app, in small batches:
//   {type:'started', torch}  {type:'samples', s:[[t,r,g,b],...]}  {type:'error', name, message}
// The app runs the heart rate maths (services/heartRate.ts). The page also shows the camera as a small preview.

export const FINGERTIP_CAPTURE_HTML = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#13242F;overflow:hidden}
video{width:100%;height:100%;object-fit:cover}</style></head>
<body><video id="v" playsinline muted autoplay></video>
<script>
(function () {
  var post = function (m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var video = document.getElementById('v');
  var canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 24;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var batch = [];
  function grab() {
    if (video.readyState >= 2) {
      var w = video.videoWidth || 320, h = video.videoHeight || 240;
      ctx.drawImage(video, w * 0.2, h * 0.2, w * 0.6, h * 0.6, 0, 0, 32, 24);
      var px = ctx.getImageData(0, 0, 32, 24).data, r = 0, g = 0, b = 0;
      for (var i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
      var n = px.length / 4;
      batch.push([performance.now(), r / n, g / n, b / n]);
      if (batch.length >= 5) { post({ type: 'samples', s: batch }); batch = []; }
    }
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(grab); else requestAnimationFrame(grab);
  }
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } }
  }).then(function (stream) {
    video.srcObject = stream;
    var track = stream.getVideoTracks()[0];
    var caps = (track.getCapabilities && track.getCapabilities()) || {};
    var torchOn = caps.torch
      ? track.applyConstraints({ advanced: [{ torch: true }] }).then(function () { return true; }, function () { return false; })
      : Promise.resolve(false);
    return Promise.all([video.play(), torchOn]).then(function (res) {
      post({ type: 'started', torch: res[1] });
      grab();
    });
  }).catch(function (e) { post({ type: 'error', name: (e && e.name) || 'Error', message: String((e && e.message) || e) }); });
})();
</script></body></html>`;
