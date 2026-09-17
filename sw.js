// 卓さがしボードのサービスワーカー
// 一度開いたことのある端末なら、電波がないときも保存しておいたページで開けるようにする。
// ・ページ本体（HTML・画像）：まずネットに取りに行き（4秒で見切る）、だめなら保存してある分を出す
// ・フォント：一度取れたら保存したものを使う
// ・スプレッドシートやGoogleフォームは触らない（データの保存はページ側の端末キャッシュが担当）
const CACHE = 'takusagashi-v2';
const SHELL = ['./', './index.html', './touroku.html', './favicon.png', './apple-touch-icon.png', './board-qr.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('takusagashi-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timeout = ms => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req), timeout(4000)]);
        // ?id=... の違いは同じページとして保存する
        if (res && res.ok) cache.put(url.origin + url.pathname, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
        return Response.error();
      }
    })());
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })());
  }
});
