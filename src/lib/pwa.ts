/**
 * تسجيل Service Worker بشكل محمي.
 * لا يُسجَّل أبداً في وضع التطوير أو داخل معاينة Lovable (iframe / نطاقات المعاينة)،
 * ويدعم مفتاح إيقاف عبر ?sw=off لإلغاء التسجيل وتنظيف الذاكرة المؤقتة.
 */

const SW_URL = "/sw.js";

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;

  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;

  return false;
}

async function unregisterAppServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => {
        const scriptURL =
          registration.active?.scriptURL ||
          registration.waiting?.scriptURL ||
          registration.installing?.scriptURL ||
          "";
        return scriptURL.endsWith(SW_URL);
      })
      .map((registration) => registration.unregister()),
  );
}

export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  if (isBlockedContext()) {
    await unregisterAppServiceWorkers();
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch (error) {
    console.warn("[PWA] تعذر تسجيل Service Worker:", error);
  }
}

/**
 * تحميل بيانات فضاء الجزائر (المسح العقاري) مسبقاً إلى الذاكرة المؤقتة
 * حتى تعمل الخريطة دون إنترنت بعد إعادة تحميل الصفحة.
 */
export async function warmFadaaOfflineCache(
  urls: string[] = ["/mzab_cadastre_map.json"],
): Promise<{ cached: string[]; failed: string[] }> {
  const cached: string[] = [];
  const failed: string[] = [];

  if (!("caches" in window)) return { cached, failed: urls };

  const cache = await caches.open("opvm-fadaa-data");
  for (const url of urls) {
    try {
      const existing = await cache.match(url);
      if (existing) {
        cached.push(url);
        continue;
      }
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await cache.put(url, response.clone());
      cached.push(url);
    } catch {
      failed.push(url);
    }
  }

  return { cached, failed };
}

export async function isFadaaCachedOffline(url = "/mzab_cadastre_map.json"): Promise<boolean> {
  if (!("caches" in window)) return false;
  try {
    const cache = await caches.open("opvm-fadaa-data");
    return Boolean(await cache.match(url));
  } catch {
    return false;
  }
}
