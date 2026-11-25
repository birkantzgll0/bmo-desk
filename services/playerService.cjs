class PlayerService {
  constructor(api) { this.api = api; }
  currentTrack() { return this.api.request('/me/player/currently-playing'); }

  async command(name) {
    const routes = {next:['/me/player/next','POST'], previous:['/me/player/previous','POST'], play:['/me/player/play','PUT'], pause:['/me/player/pause','PUT']};
    if (!routes[name]) throw Error('Invalid command');
    const player = await this.api.request('/me/player');
    if (!player?.device?.id) throw Error('NO_ACTIVE_DEVICE');
    if (name !== 'play' && !player.item) throw Error('NO_ACTIVE_DEVICE');
    return this.api.request(...routes[name]);
  }

  async changeVolume(delta) {
    if (delta !== 5 && delta !== -5) throw Error('Invalid volume step');
    const player = await this.api.request('/me/player');
    if (!player?.device?.id) throw Error('NO_ACTIVE_DEVICE');
    const level = Math.max(0, Math.min(100, (player.device.volume_percent ?? 50) + delta));
    await this.api.request('/me/player/volume?volume_percent='+level, 'PUT');
    return level;
  }

  async playTrack(trackId, positionMs = 0) {
    if (!/^[a-zA-Z0-9]{22}$/.test(trackId)) throw Error('Invalid track ID');
    if (!Number.isInteger(positionMs) || positionMs < 0 || positionMs > 86_400_000) throw Error('Invalid position');
    const player = await this.api.request('/me/player');
    if (!player?.device?.id) throw Error('NO_ACTIVE_DEVICE');
    return this.api.request('/me/player/play', 'PUT', {uris:['spotify:track:'+trackId],position_ms:positionMs});
  }
}

module.exports = {PlayerService};
