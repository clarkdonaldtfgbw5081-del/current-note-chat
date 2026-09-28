function downscaleScreenshot(dataUrl, maxEdge) {
  const edge = Number(maxEdge);
  if (!edge || edge < 400 || typeof Image === "undefined") return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const longest = Math.max(image.width, image.height);
        if (longest <= edge) return resolve(dataUrl);
        const scale = edge / longest;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) return resolve(dataUrl);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function selectScreenSource(sources, displayId) {
  const source = sources.find(item => item.display_id === String(displayId));
  if (!source) throw new Error('The selected display could not be identified. No screenshot was sent. Check screen permissions and reconnect the display.');
  if (source.thumbnail.isEmpty()) throw new Error('Could not capture the display. Check screen recording permissions.');
  return source;
}
async function captureScreen(remote, settings) {
  if (!remote?.desktopCapturer || !remote?.screen) throw new Error('Screen capture is not available in this Obsidian environment.');
  const display = settings.screenFollowCursor && typeof remote.screen.getCursorScreenPoint === 'function'
    ? remote.screen.getDisplayNearestPoint(remote.screen.getCursorScreenPoint())
    : remote.screen.getDisplayMatching(remote.getCurrentWindow().getBounds());
  const sources = await remote.desktopCapturer.getSources({ types: ['screen'], thumbnailSize: {
    width: Math.round(display.size.width * display.scaleFactor), height: Math.round(display.size.height * display.scaleFactor)
  } });
  const source = selectScreenSource(sources, display.id);
  return downscaleScreenshot(source.thumbnail.toDataURL(), settings.screenshotMaxEdge);
}
module.exports = { downscaleScreenshot, selectScreenSource, captureScreen };
