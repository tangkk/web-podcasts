(() => {
  const API = 'https://sync.tangkk-x2o.com/v1/podcasts/state';
  const SYNC_KEY = 'web-podcasts:sync-key';
  const PLAYLIST_KEY = 'web-podcasts:stream:v1';
  const FILTER_KEY = 'web-podcasts:stream-filter:v1';
  const PLAYHEAD_KEY = 'web-podcasts:stream-playhead:v1';
  const UPDATED_KEY = 'web-podcasts:stream:updated-at';
  const REMOTE_KEY = 'stream';

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
  const readPlayhead = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYHEAD_KEY) || 'null');
      if (!value || typeof value.key !== 'string' || !Number.isFinite(value.offsetSeconds)) return null;
      return {key:value.key, offsetSeconds:Math.max(0, value.offsetSeconds)};
    } catch { return null; }
  };
  const readState = () => ({items:readPlaylist(), filter:readFilter(), playhead:readPlayhead()});

  const readUpdatedAt = () => {
    const value = Number(localStorage.getItem(UPDATED_KEY));
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

  const decodeRemoteValue = raw => {
    if (Array.isArray(raw)) return {items:raw, filter:'', playhead:null};
    if (raw && typeof raw === 'object') {
      const playhead = raw.playhead && typeof raw.playhead.key === 'string' && Number.isFinite(raw.playhead.offsetSeconds)
        ? {key:raw.playhead.key, offsetSeconds:Math.max(0, raw.playhead.offsetSeconds)}
        : null;
      return {
        items:Array.isArray(raw.items) ? raw.items : [],
        filter:typeof raw.filter === 'string' ? raw.filter : '',
        playhead
      };
    }
    return {items:[], filter:'', playhead:null};
  };

  const applyRemote = item => {
    const value = decodeRemoteValue(item?.value);
    suppressLocalDirty = true;
    try {
      localStorage.setItem(PLAYLIST_KEY, JSON.stringify(value.items));
      localStorage.setItem(FILTER_KEY, value.filter);
      if (value.playhead) localStorage.setItem(PLAYHEAD_KEY, JSON.stringify(value.playhead));
      else localStorage.removeItem(PLAYHEAD_KEY);
      localStorage.setItem(UPDATED_KEY, String(Number(item?.updatedAt) || Date.now()));
      window.dispatchEvent(new CustomEvent('stream-change'));
      window.dispatchEvent(new CustomEvent('stream-filter-change', {detail:{value:value.filter}}));
      window.dispatchEvent(new CustomEvent('stream-playhead-change', {detail:{remote:true}}));
    } finally {
      setTimeout(() => { suppressLocalDirty = false; }, 0);
    }
  };

  async function syncPlaylistNow() {
    const key = localStorage.getItem(SYNC_KEY)?.trim();
    if (!key || syncing) return;
    syncing = true;
    try {
      const remote = await request('GET', key);
      const remoteItem = (Array.isArray(remote.items) ? remote.items : []).find(item => item.key === REMOTE_KEY);
      const localValue = readState();
      let localUpdatedAt = readUpdatedAt();
      const remoteUpdatedAt = Number(remoteItem?.updatedAt) || 0;

      if (!localUpdatedAt && remoteItem) { applyRemote(remoteItem); return; }
      if (!localUpdatedAt && !remoteItem) {
        localUpdatedAt = Date.now();
        localStorage.setItem(UPDATED_KEY, String(localUpdatedAt));
      }
      if (remoteItem && remoteUpdatedAt > localUpdatedAt) { applyRemote(remoteItem); return; }

      const saved = await request('POST', key, {
        items:[{key:REMOTE_KEY, value:localValue, updatedAt:localUpdatedAt}]
      });
      const savedItem = (Array.isArray(saved.items) ? saved.items : []).find(item => item.key === REMOTE_KEY);
      if (savedItem && (Number(savedItem.updatedAt) || 0) > localUpdatedAt) applyRemote(savedItem);
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

  const markDirtyAndSync = () => {
    if (suppressLocalDirty) return;
    localStorage.setItem(UPDATED_KEY, String(Date.now()));
    scheduleSync();
  };

  window.addEventListener('stream-change', markDirtyAndSync);
  window.addEventListener('stream-filter-change', markDirtyAndSync);
  window.addEventListener('stream-playhead-change', event => {
    if (event.detail?.remote) return;
    markDirtyAndSync();
  });

  window.addEventListener('storage', event => {
    if ((event.key === PLAYLIST_KEY || event.key === FILTER_KEY || event.key === PLAYHEAD_KEY) && !suppressLocalDirty) {
      localStorage.setItem(UPDATED_KEY, String(Date.now()));
      scheduleSync();
    }
    if (event.key === SYNC_KEY) scheduleSync();
  });

  document.addEventListener('click', event => {
    if (event.target.closest('#syncSave') || event.target.closest('#syncNow')) setTimeout(syncPlaylistNow, 350);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncPlaylistNow();
  });

  window.setInterval(syncPlaylistNow, 30000);
  if (localStorage.getItem(SYNC_KEY)) setTimeout(syncPlaylistNow, 1200);
})();