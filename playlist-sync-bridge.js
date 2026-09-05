(() => {
  const API = 'https://sync.tangkk-x2o.com/v1/podcasts/state';
  const SYNC_KEY = 'web-podcasts:sync-key';
  const PLAYLIST_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const PLAYHEAD_KEY = 'web-podcasts:stream-playhead:v1';
  const LEGACY_UPDATED_KEY = 'web-podcasts:stream:updated-at';
  const CONFIG_UPDATED_KEY = 'web-podcasts:stream-config:updated-at';
  const PLAYHEAD_UPDATED_KEY = 'web-podcasts:stream-playhead:updated-at';
  const LEGACY_REMOTE_KEY = 'stream';
  const CONFIG_REMOTE_KEY = 'stream-config';
  const PLAYHEAD_REMOTE_KEY = 'stream-playhead';

  let syncing = false;
  let suppressLocalDirty = false;
  let timer = null;

  const readPlaylist = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  };

  const readFilter = () => localStorage.getItem(FILTER_KEY) || '';

  const versionFor = (items, filter) => {
    const source = JSON.stringify({
      items: items.map(item => [item?.key || '', item?.audio || '', Number(item?.durationSeconds) || 0, item?.title || '']),
      filter
    });
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  };

  const readConfig = () => {
    const items = readPlaylist();
    const filter = readFilter();
    return {items, filter, version:versionFor(items, filter)};
  };

  const readPlayhead = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYHEAD_KEY) || 'null');
      if (!value || typeof value.streamVersion !== 'string' || typeof value.key !== 'string' || !Number.isFinite(value.offsetSeconds)) return null;
      return {
        streamVersion:value.streamVersion,
        key:value.key,
        offsetSeconds:Math.max(0, value.offsetSeconds)
      };
    } catch { return null; }
  };

  const readTimestamp = key => {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const request = async (method, key, body) => {
    const response = await fetch(API, {
      method,
      cache:'no-store',
      headers:{'X-Sync-Key':key, ...(body ? {'Content-Type':'application/json'} : {})},
      body:body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  const decodeLegacy = raw => {
    if (Array.isArray(raw)) {
      const config = {items:raw, filter:'', version:versionFor(raw, '')};
      return {config, playhead:null};
    }
    if (raw && typeof raw === 'object') {
      const items = Array.isArray(raw.items) ? raw.items : [];
      const filter = typeof raw.filter === 'string' ? raw.filter : '';
      const config = {items, filter, version:versionFor(items, filter)};
      const old = raw.playhead && typeof raw.playhead.key === 'string' && Number.isFinite(raw.playhead.offsetSeconds)
        ? raw.playhead
        : null;
      const playhead = old ? {
        streamVersion:typeof old.streamVersion === 'string' ? old.streamVersion : config.version,
        key:old.key,
        offsetSeconds:Math.max(0, old.offsetSeconds)
      } : null;
      return {config, playhead};
    }
    const config = {items:[], filter:'', version:versionFor([], '')};
    return {config, playhead:null};
  };

  const decodeConfig = raw => {
    if (!raw || typeof raw !== 'object') return null;
    const items = Array.isArray(raw.items) ? raw.items : [];
    const filter = typeof raw.filter === 'string' ? raw.filter : '';
    return {items, filter, version:versionFor(items, filter)};
  };

  const decodePlayhead = raw => {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.streamVersion !== 'string' || typeof raw.key !== 'string' || !Number.isFinite(raw.offsetSeconds)) return null;
    return {
      streamVersion:raw.streamVersion,
      key:raw.key,
      offsetSeconds:Math.max(0, raw.offsetSeconds)
    };
  };

  const applyRemoteConfig = item => {
    const value = decodeConfig(item?.value);
    if (!value) return;
    suppressLocalDirty = true;
    try {
      localStorage.setItem(PLAYLIST_KEY, JSON.stringify(value.items));
      localStorage.setItem(FILTER_KEY, value.filter);
      localStorage.setItem(CONFIG_UPDATED_KEY, String(Number(item?.updatedAt) || Date.now()));
      window.dispatchEvent(new CustomEvent('stream-change'));
      window.dispatchEvent(new CustomEvent('stream-filter-change', {detail:{value:value.filter}}));
    } finally {
      setTimeout(() => { suppressLocalDirty = false; }, 0);
    }
  };

  const applyRemotePlayhead = item => {
    const value = decodePlayhead(item?.value);
    suppressLocalDirty = true;
    try {
      if (value) localStorage.setItem(PLAYHEAD_KEY, JSON.stringify(value));
      else localStorage.removeItem(PLAYHEAD_KEY);
      localStorage.setItem(PLAYHEAD_UPDATED_KEY, String(Number(item?.updatedAt) || Date.now()));
      window.dispatchEvent(new CustomEvent('stream-playhead-change', {detail:{remote:true}}));
    } finally {
      setTimeout(() => { suppressLocalDirty = false; }, 0);
    }
  };

  const ensureLocalMigration = () => {
    const legacyUpdated = readTimestamp(LEGACY_UPDATED_KEY);
    if (!readTimestamp(CONFIG_UPDATED_KEY) && legacyUpdated) {
      localStorage.setItem(CONFIG_UPDATED_KEY, String(legacyUpdated));
    }
    if (!readTimestamp(PLAYHEAD_UPDATED_KEY) && legacyUpdated && localStorage.getItem(PLAYHEAD_KEY)) {
      const config = readConfig();
      try {
        const old = JSON.parse(localStorage.getItem(PLAYHEAD_KEY) || 'null');
        if (old && typeof old.key === 'string' && Number.isFinite(old.offsetSeconds) && typeof old.streamVersion !== 'string') {
          localStorage.setItem(PLAYHEAD_KEY, JSON.stringify({
            streamVersion:config.version,
            key:old.key,
            offsetSeconds:Math.max(0, old.offsetSeconds)
          }));
        }
      } catch {}
      localStorage.setItem(PLAYHEAD_UPDATED_KEY, String(legacyUpdated));
    }
  };

  async function syncPlaylistNow() {
    const key = localStorage.getItem(SYNC_KEY)?.trim();
    if (!key || syncing) return;
    syncing = true;
    try {
      ensureLocalMigration();
      const remote = await request('GET', key);
      const items = Array.isArray(remote.items) ? remote.items : [];
      const byKey = new Map(items.map(item => [item.key, item]));
      let remoteConfig = byKey.get(CONFIG_REMOTE_KEY) || null;
      let remotePlayhead = byKey.get(PLAYHEAD_REMOTE_KEY) || null;

      if (!remoteConfig) {
        const legacy = byKey.get(LEGACY_REMOTE_KEY);
        if (legacy) {
          const migrated = decodeLegacy(legacy.value);
          remoteConfig = {key:CONFIG_REMOTE_KEY, value:migrated.config, updatedAt:legacy.updatedAt};
          if (!remotePlayhead && migrated.playhead) {
            remotePlayhead = {key:PLAYHEAD_REMOTE_KEY, value:migrated.playhead, updatedAt:legacy.updatedAt};
          }
        }
      }

      let configUpdated = readTimestamp(CONFIG_UPDATED_KEY);
      let playheadUpdated = readTimestamp(PLAYHEAD_UPDATED_KEY);
      const remoteConfigUpdated = Number(remoteConfig?.updatedAt) || 0;
      const remotePlayheadUpdated = Number(remotePlayhead?.updatedAt) || 0;

      if (!configUpdated && remoteConfig) {
        applyRemoteConfig(remoteConfig);
        configUpdated = readTimestamp(CONFIG_UPDATED_KEY);
      } else if (remoteConfig && remoteConfigUpdated > configUpdated) {
        applyRemoteConfig(remoteConfig);
        configUpdated = readTimestamp(CONFIG_UPDATED_KEY);
      } else if (!configUpdated) {
        configUpdated = Date.now();
        localStorage.setItem(CONFIG_UPDATED_KEY, String(configUpdated));
      }

      if (!playheadUpdated && remotePlayhead) {
        applyRemotePlayhead(remotePlayhead);
        playheadUpdated = readTimestamp(PLAYHEAD_UPDATED_KEY);
      } else if (remotePlayhead && remotePlayheadUpdated > playheadUpdated) {
        applyRemotePlayhead(remotePlayhead);
        playheadUpdated = readTimestamp(PLAYHEAD_UPDATED_KEY);
      }

      const outgoing = [{
        key:CONFIG_REMOTE_KEY,
        value:readConfig(),
        updatedAt:readTimestamp(CONFIG_UPDATED_KEY) || configUpdated || Date.now()
      }];
      const playhead = readPlayhead();
      if (playhead) {
        let updatedAt = readTimestamp(PLAYHEAD_UPDATED_KEY);
        if (!updatedAt) {
          updatedAt = Date.now();
          localStorage.setItem(PLAYHEAD_UPDATED_KEY, String(updatedAt));
        }
        outgoing.push({key:PLAYHEAD_REMOTE_KEY, value:playhead, updatedAt});
      }

      const saved = await request('POST', key, {items:outgoing});
      const savedItems = Array.isArray(saved.items) ? saved.items : [];
      const savedConfig = savedItems.find(item => item.key === CONFIG_REMOTE_KEY);
      const savedPlayhead = savedItems.find(item => item.key === PLAYHEAD_REMOTE_KEY);
      if (savedConfig && (Number(savedConfig.updatedAt) || 0) > readTimestamp(CONFIG_UPDATED_KEY)) applyRemoteConfig(savedConfig);
      if (savedPlayhead && (Number(savedPlayhead.updatedAt) || 0) > readTimestamp(PLAYHEAD_UPDATED_KEY)) applyRemotePlayhead(savedPlayhead);
    } catch (error) {
      console.warn('Playlist sync failed', error);
    } finally {
      syncing = false;
    }
  }

  const scheduleSync = () => {
    if (!localStorage.getItem(SYNC_KEY)) return;
    clearTimeout(timer);
    timer = setTimeout(syncPlaylistNow, 900);
  };

  const markConfigDirty = () => {
    if (suppressLocalDirty) return;
    localStorage.setItem(CONFIG_UPDATED_KEY, String(Date.now()));
    scheduleSync();
  };

  const markPlayheadDirty = event => {
    if (suppressLocalDirty || event?.detail?.remote) return;
    localStorage.setItem(PLAYHEAD_UPDATED_KEY, String(Date.now()));
    scheduleSync();
  };

  window.addEventListener('stream-change', markConfigDirty);
  window.addEventListener('stream-filter-change', markConfigDirty);
  window.addEventListener('stream-playhead-change', markPlayheadDirty);

  window.addEventListener('storage', event => {
    if (suppressLocalDirty) return;
    if (event.key === PLAYLIST_KEY || event.key === FILTER_KEY) markConfigDirty();
    if (event.key === PLAYHEAD_KEY) markPlayheadDirty();
    if (event.key === SYNC_KEY) scheduleSync();
  });

  document.addEventListener('click', event => {
    if (event.target.closest('#syncSave') || event.target.closest('#syncNow')) setTimeout(syncPlaylistNow, 350);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncPlaylistNow();
  });

  ensureLocalMigration();
  window.setInterval(syncPlaylistNow, 30000);
  if (localStorage.getItem(SYNC_KEY)) setTimeout(syncPlaylistNow, 1200);
})();