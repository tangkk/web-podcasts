(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const API = 'https://sync.tangkk-x2o.com/v1/podcasts/state';
  const SYNC_KEY = 'web-podcasts:sync-key';
  const PLAYLIST_KEY = 'web-podcasts:debug-playlist:v2';
  const UPDATED_KEY = 'web-podcasts:debug-playlist:updated-at';

  let syncing = false;
  let suppressLocalDirty = false;
  let timer = null;

  const readPlaylist = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const readUpdatedAt = () => {
    const value = Number(localStorage.getItem(UPDATED_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const request = async (method, key, body) => {
    const response = await fetch(API, {
      method,
      cache: 'no-store',
      headers: {
        'X-Sync-Key': key,
        ...(body ? {'Content-Type':'application/json'} : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  const applyRemote = item => {
    const value = Array.isArray(item?.value) ? item.value : [];
    suppressLocalDirty = true;
    try {
      localStorage.setItem(PLAYLIST_KEY, JSON.stringify(value));
      localStorage.setItem(UPDATED_KEY, String(Number(item?.updatedAt) || Date.now()));
      window.dispatchEvent(new CustomEvent('debug-playlist-change'));
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
      const remoteItem = (Array.isArray(remote.items) ? remote.items : []).find(item => item.key === 'playlist');
      let localValue = readPlaylist();
      let localUpdatedAt = readUpdatedAt();
      const remoteUpdatedAt = Number(remoteItem?.updatedAt) || 0;

      if (!localUpdatedAt && remoteItem) {
        applyRemote(remoteItem);
        return;
      }

      if (!localUpdatedAt && !remoteItem) {
        localUpdatedAt = Date.now();
        localStorage.setItem(UPDATED_KEY, String(localUpdatedAt));
      }

      if (remoteItem && remoteUpdatedAt > localUpdatedAt) {
        applyRemote(remoteItem);
        return;
      }

      const saved = await request('POST', key, {
        items: [{key:'playlist', value:localValue, updatedAt:localUpdatedAt}]
      });
      const savedItem = (Array.isArray(saved.items) ? saved.items : []).find(item => item.key === 'playlist');
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

  window.addEventListener('debug-playlist-change', () => {
    if (suppressLocalDirty) return;
    localStorage.setItem(UPDATED_KEY, String(Date.now()));
    scheduleSync();
  });

  window.addEventListener('storage', event => {
    if (event.key === PLAYLIST_KEY && !suppressLocalDirty) {
      localStorage.setItem(UPDATED_KEY, String(Date.now()));
      scheduleSync();
    }
    if (event.key === SYNC_KEY) scheduleSync();
  });

  document.addEventListener('click', event => {
    if (event.target.closest('#syncSave') || event.target.closest('#syncNow')) {
      setTimeout(syncPlaylistNow, 350);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncPlaylistNow();
  });

  window.setInterval(syncPlaylistNow, 30000);
  if (localStorage.getItem(SYNC_KEY)) setTimeout(syncPlaylistNow, 1200);
})();
