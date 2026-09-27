export type CatalogClassificationInput = {
  platform?: string | null;
  category?: string | null;
  name?: string | null;
  description?: string | null;
};

const platformRules: Array<[string, RegExp]> = [
  ["Instagram", /\b(?:instagram|insta|ig|instgram)\b/i],
  ["TikTok", /\btik\s*-?\s*tok\b/i],
  ["YouTube", /\b(?:youtube|you\s*tube|yt)\b/i],
  ["Facebook", /\b(?:facebook|meta|fb)\b/i],
  ["WhatsApp", /\bwhats\s*app\b/i],
  ["Telegram", /\b(?:telegram|telgram)\b/i],
  ["Threads", /\bthreads?\b/i],
  ["X", /\b(?:twitter|x\.com)\b/i],
  ["Snapchat", /\bsnapchat\b/i],
  ["Pinterest", /\bpinterest\b/i],
  ["LinkedIn", /\blinked\s*in\b/i],
  ["Reddit", /\breddit\b/i],
  ["Discord", /\bdiscord\b/i],
  ["Twitch", /\btwitch\b/i],
  ["Spotify", /\bspotify\b/i],
  ["SoundCloud", /\bsound\s*cloud\b/i],
  ["Boomplay", /\bboomplay\b/i],
  ["Clubhouse", /\bclubhouse\b/i],
  ["Lemon8", /\blemon\s*8\b/i],
  ["Likee", /\blikee\b/i],
  ["Kwai", /\bkwai\b/i],
  ["Dribbble", /\bdribb(?:le|ble)\b/i],
  ["Chzzk", /\bchzzk\b/i],
  ["Trovo", /\btrovo\b/i],
  ["Vimeo", /\bvimeo\b/i],
  ["Tumblr", /\btumblr\b/i],
  ["Quora", /\bquora\b/i],
  ["Tinder", /\btinder\b/i],
  ["Deezer", /\bdeezer\b/i],
  ["Audiomack", /\baudiomack\b/i],
];

const genericPlatforms = new Set(["", "api", "general", "social", "default", "other", "provider"]);
const customerNoisePlatforms = new Set(["9gag", "amazon", "android", "apple", "article", "binance", "coinmarketcap", "datpiff", "dolap", "ebay", "genius", "imdb", "lazada", "maroof", "medium", "odnoklassniki", "ok.ru", "pandatv", "retube", "reverbnation", "shazam", "shopee", "strawpoll", "sua", "tidal", "trading", "traffic", "trip", "truthsocial", "vk", "wattpad", "website", "yandex"]);
const kenyaCustomerPlatforms = new Set(["tiktok", "facebook", "instagram", "x", "twitter", "whatsapp", "youtube"]);
const genericCategory = /^(?:api(?:\s+rates?)?|general|social|default|other|provider)(?:\b|\s)|whats\s*app\s+us\b|contact\s+us\b/i;
const serviceTypes: Array<[string, RegExp]> = [
  ["Page likes", /\bpage\s+likes?\b/i],
  ["Watch time", /\bwatch\s*(?:time|hours?)\b/i],
  ["Subscribers", /\bsubscribers?\b/i],
  ["Followers", /\bfollowers?\b/i],
  ["Views", /\bviews?\b/i],
  ["Likes", /\blikes?\b/i],
  ["Comments", /\bcomments?\b/i],
  ["Shares", /\bshares?\b/i],
  ["Streams", /\bstreams?\b/i],
  ["Plays", /\bplays?\b/i],
  ["Members", /\bmembers?\b/i],
  ["Reactions", /\breactions?\b/i],
  ["Saves", /\bsaves?\b/i],
  ["Downloads", /\bdownloads?\b/i],
  ["Votes", /\bvotes?\b/i],
  ["Impressions", /\bimpressions?\b/i],
];

function classifyPlatform(text: string) {
  return platformRules.find(([, pattern]) => pattern.test(text))?.[0];
}

function cleanCategory(value: string, platform: string) {
  let category = value
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[|·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (platform) {
    const escaped = platform.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    category = category.replace(new RegExp(`^${escaped}\\s*(?:[-:–—]+\\s*)?`, "i"), "").trim();
  }
  const characters = Array.from(category);
  return characters.length > 36 ? `${characters.slice(0, 33).join("").trimEnd()}…` : category;
}

export function normalizeServicePresentation<T extends CatalogClassificationInput>(service: T): T & { platform: string; category: string } {
  const rawPlatform = (service.platform ?? "").trim();
  const rawCategory = (service.category ?? "").trim();
  const name = (service.name ?? "").trim();
  const generic = genericPlatforms.has(rawPlatform.toLowerCase());
  const fromName = classifyPlatform(name);
  const fromCategory = classifyPlatform(rawCategory);
  const fromDescription = classifyPlatform(service.description ?? "");
  const platform = generic
    ? fromName ?? fromCategory ?? fromDescription ?? "Other"
    : classifyPlatform(rawPlatform) ?? fromCategory ?? fromName ?? fromDescription ?? rawPlatform;

  const nameType = serviceTypes.find(([, pattern]) => pattern.test(name))?.[0];
  const categoryType = serviceTypes.find(([, pattern]) => pattern.test(rawCategory))?.[0];
  const cleanedCategory = cleanCategory(rawCategory, platform);
  const category = genericCategory.test(rawCategory)
    ? nameType ?? categoryType ?? "Other services"
    : cleanedCategory || nameType || categoryType || rawCategory || "Other services";

  return { ...service, platform, category };
}

export function normalizeServiceType(name: string, category: string) {
  return serviceTypes.find(([, pattern]) => pattern.test(name))?.[0]
    ?? serviceTypes.find(([, pattern]) => pattern.test(category))?.[0]
    ?? "Other services";
}

export function isCustomerVisiblePlatform(platform: string) {
  const normalized = platform.trim().toLowerCase();
  return kenyaCustomerPlatforms.has(normalized) && !customerNoisePlatforms.has(normalized);
}

const kenyaPlatformPriority = ["TikTok", "Facebook", "Instagram", "X", "WhatsApp", "YouTube"];

export function compareCustomerPlatforms(a: string, b: string) {
  const priority = (value: string) => {
    const index = kenyaPlatformPriority.findIndex((item) => item.toLowerCase() === value.toLowerCase());
    return index === -1 ? kenyaPlatformPriority.length : index;
  };
  return priority(a) - priority(b) || a.localeCompare(b);
}
