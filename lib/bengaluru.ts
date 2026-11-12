/**
 * Bengaluru landmark gazetteer.
 *
 * The AI normalizer is not always able to place a stop, and a stop it cannot
 * place used to be dropped (or arrive as "UNLOCATED" with no coordinates).
 * This local table turns a name into coordinates offline, so the demo works
 * with no network, no geocoding API key and no latency.
 */

export interface Landmark {
  /** Canonical display name. */
  name: string;
  /** Extra spellings that should resolve to the same point. */
  aliases: string[];
  lat: number;
  lng: number;
}

export interface DemoStop {
  name: string;
  lat: number;
  lng: number;
}

/** Shape shared with `NormalizedRouteData` in the components. */
export interface DemoRoute {
  routeName: string;
  vehicleType: string;
  estimatedFare: string;
  frequency: string;
  stops: DemoStop[];
  pathCoordinates: [number, number][];
  isFallback?: boolean;
}

export const BENGALURU_CENTER: [number, number] = [13.028, 77.545];

export const BENGALURU_LANDMARKS: Landmark[] = [
  { name: "Majestic (Kempegowda Bus Station)", aliases: ["majestic", "kempegowda bus station", "kbs", "kempegowda"], lat: 12.9767, lng: 77.5713 },
  { name: "Yelahanka", aliases: ["yelahanka", "yelahanka new town", "yelahanka town"], lat: 13.1007, lng: 77.5963 },
  { name: "Hebbal", aliases: ["hebbal", "hebbal flyover"], lat: 13.0358, lng: 77.597 },
  { name: "Koramangala", aliases: ["koramangala", "kormangala"], lat: 12.9352, lng: 77.6245 },
  { name: "Sony World Signal", aliases: ["sony world", "sony world signal", "sony signal"], lat: 12.936, lng: 77.6271 },
  { name: "Forum Mall, Koramangala", aliases: ["forum mall", "forum koramangala", "forum"], lat: 12.9345, lng: 77.6113 },
  { name: "Indiranagar", aliases: ["indiranagar", "indira nagar", "100 feet road"], lat: 12.9784, lng: 77.6408 },
  { name: "Domlur", aliases: ["domlur", "domlur flyover"], lat: 12.9609, lng: 77.6387 },
  { name: "MG Road", aliases: ["mg road", "m g road", "mahathma gandhi road"], lat: 12.9756, lng: 77.6068 },
  { name: "Electronic City", aliases: ["electronic city", "e city", "ecity", "electronics city"], lat: 12.8452, lng: 77.6602 },
  { name: "Silk Board", aliases: ["silk board", "silkboard", "central silk board"], lat: 12.9172, lng: 77.6229 },
  { name: "Marathahalli", aliases: ["marathahalli", "marathalli"], lat: 12.9591, lng: 77.6974 },
  { name: "Whitefield", aliases: ["whitefield", "white field"], lat: 12.9698, lng: 77.75 },
  { name: "HSR Layout", aliases: ["hsr", "hsr layout", "hsr sector"], lat: 12.9121, lng: 77.6446 },
  { name: "Bellandur", aliases: ["bellandur", "bellandur junction"], lat: 12.9304, lng: 77.6784 },
  { name: "Jayanagar", aliases: ["jayanagar", "jaya nagar"], lat: 12.925, lng: 77.5938 },
  { name: "Banashankari", aliases: ["banashankari", "bhanashankari"], lat: 12.9255, lng: 77.5468 },
  { name: "KR Market", aliases: ["kr market", "city market", "kr market junction"], lat: 12.9618, lng: 77.5755 },
  { name: "Lalbagh West Gate", aliases: ["lalbagh", "lal bagh", "lalbagh west gate"], lat: 12.9507, lng: 77.5848 },
  { name: "Yeshwanthpur", aliases: ["yeshwanthpur", "yeshwantpur"], lat: 13.0234, lng: 77.551 },
  { name: "Rajajinagar", aliases: ["rajajinagar", "raja ji nagar"], lat: 12.9915, lng: 77.5525 },
  { name: "Kempegowda International Airport", aliases: ["airport", "kial", "devandahalli airport"], lat: 13.1986, lng: 77.7066 },
];

/** Lowercase, strip punctuation and collapse whitespace so matching is forgiving. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Resolves a free-text stop name to a landmark. Exact canonical/alias matches
 * win; otherwise a unique substring match is accepted ("near Sony World Signal"
 * still resolves). Ambiguous substring matches are rejected rather than guessed.
 */
export function resolveLandmark(value: string): Landmark | null {
  const needle = normalize(value);
  if (!needle) return null;

  for (const landmark of BENGALURU_LANDMARKS) {
    if (normalize(landmark.name) === needle) return landmark;
    if (landmark.aliases.some((alias) => normalize(alias) === needle)) return landmark;
  }

  const partial = BENGALURU_LANDMARKS.filter((landmark) =>
    [landmark.name, ...landmark.aliases].some((candidate) => {
      const haystack = normalize(candidate);
      return needle.includes(haystack) || haystack.includes(needle);
    }),
  );

  return partial.length === 1 ? partial[0] : null;
}

/** `[lat, lng]` for a name, or `null` when the gazetteer cannot place it. */
export function landmarkPair(value: string): [number, number] | null {
  const landmark = resolveLandmark(value);
  return landmark ? [landmark.lat, landmark.lng] : null;
}

type MentionRole = "from" | "to" | "via" | null;

/** Reads the word just before a mention: "from Majestic", "to Hebbal", "via Domlur". */
function roleBefore(haystack: string, index: number): MentionRole {
  const prefix = haystack.slice(Math.max(0, index - 14), index);
  if (/\bfrom\s+$/.test(prefix)) return "from";
  if (/\b(to|till|until|towards|upto|up to)\s+$/.test(prefix)) return "to";
  if (/\bvia\s+$/.test(prefix)) return "via";
  return null;
}

/** Every landmark mention with its position and the preposition before it. */
function landmarkMentions(text: string): { landmark: Landmark; index: number; end: number; role: MentionRole }[] {
  const haystack = normalize(text);
  if (!haystack) return [];

  const hits: { landmark: Landmark; index: number; end: number; role: MentionRole }[] = [];

  for (const landmark of BENGALURU_LANDMARKS) {
    let best = -1;
    let bestLength = 0;
    for (const candidate of [landmark.name, ...landmark.aliases]) {
      const needle = normalize(candidate);
      if (!needle) continue;
      const index = haystack.indexOf(needle);
      // Earliest mention wins; a longer spelling wins at the same offset.
      if (index !== -1 && (best === -1 || index < best || (index === best && needle.length > bestLength))) {
        best = index;
        bestLength = needle.length;
      }
    }
    if (best !== -1) {
      hits.push({ landmark, index: best, end: best + bestLength, role: roleBefore(haystack, best) });
    }
  }

  // "Forum Mall, Koramangala" also contains "Koramangala"; a mention that sits
  // entirely inside a longer one is the same place, not an extra stop.
  const withoutContained = hits.filter(
    (hit) =>
      !hits.some(
        (other) =>
          other !== hit &&
          other.index <= hit.index &&
          other.end >= hit.end &&
          other.end - other.index > hit.end - hit.index,
      ),
  );

  withoutContained.sort(
    (a, b) => a.index - b.index || normalize(b.landmark.name).length - normalize(a.landmark.name).length,
  );

  const seen = new Set<string>();
  const unique: typeof hits = [];
  for (const hit of withoutContained) {
    if (seen.has(hit.landmark.name)) continue;
    seen.add(hit.landmark.name);
    unique.push(hit);
  }

  return unique;
}

/**
 * Every landmark mentioned in a block of text, in the order it appears. Used to
 * rebuild stops when the model returns fewer than two placeable stops.
 */
export function findLandmarksInText(text: string): Landmark[] {
  return landmarkMentions(text).map((hit) => hit.landmark);
}

/**
 * Orders mentions the way the sentence means them: origin first, "via" points in
 * the middle, destination last. Without this, "Yelahanka to Majestic via Hebbal"
 * would end at Hebbal simply because that word appears last.
 */
function orderStops(text: string): Landmark[] {
  const mentions = landmarkMentions(text);
  if (mentions.length === 0) return [];

  const origin = mentions.find((mention) => mention.role === "from");
  const destinations = mentions.filter((mention) => mention.role === "to");
  const destination = destinations[destinations.length - 1];
  const vias = mentions.filter((mention) => mention.role === "via" || mention.role === null);

  const ordered: Landmark[] = [];
  const push = (landmark: Landmark | undefined) => {
    if (landmark && !ordered.some((entry) => entry.name === landmark.name)) ordered.push(landmark);
  };

  push(origin?.landmark ?? mentions[0].landmark);
  vias.forEach((mention) => push(mention.landmark));
  push(destination?.landmark ?? mentions[mentions.length - 1].landmark);

  // Anything the preposition pass could not place still belongs on the line.
  mentions.forEach((mention) => push(mention.landmark));

  return ordered;
}

/**
 * Builds a drawable route from whatever landmarks the text mentions. Returns
 * `null` when fewer than two places resolve, so the caller can keep its own
 * result or fall back to a demo route.
 */
export function routeFromText(text: string): DemoRoute | null {
  const landmarks = orderStops(text);
  if (landmarks.length < 2) return null;

  const stops: DemoStop[] = landmarks.map((landmark) => ({
    name: landmark.name,
    lat: landmark.lat,
    lng: landmark.lng,
  }));

  return {
    routeName: `${landmarks[0].name} to ${landmarks[landmarks.length - 1].name}`,
    vehicleType: /mini|bus/i.test(text) ? "Minibus" : /van/i.test(text) ? "Informal Van" : "Shared Auto",
    estimatedFare: "Unknown",
    frequency: "Unknown",
    stops,
    pathCoordinates: stops.map((stop) => [stop.lat, stop.lng] as [number, number]),
  };
}

/**
 * Routes loaded on first paint, so the map is never an empty grid: the layers
 * toggle from a populated state and every demo path is offline data.
 */
export const FALLBACK_ROUTES: DemoRoute[] = [
  {
    routeName: "Yelahanka to Majestic via Hebbal",
    vehicleType: "Shared Auto",
    estimatedFare: "INR 30-35",
    frequency: "Every 10-15 mins",
    stops: [
      { name: "Yelahanka", lat: 13.1007, lng: 77.5963 },
      { name: "Hebbal", lat: 13.0358, lng: 77.597 },
      { name: "Majestic (Kempegowda Bus Station)", lat: 12.9767, lng: 77.5713 },
    ],
    pathCoordinates: [
      [13.1007, 77.5963],
      [13.0872, 77.5938],
      [13.0641, 77.5906],
      [13.0358, 77.597],
      [13.0102, 77.5913],
      [12.993, 77.5787],
      [12.9767, 77.5713],
    ],
  },
  {
    routeName: "Majestic to Forum Koramangala via Sony World Signal",
    vehicleType: "Shared Auto",
    estimatedFare: "INR 25",
    frequency: "Every 10-15 mins",
    stops: [
      { name: "Majestic (Kempegowda Bus Station)", lat: 12.9767, lng: 77.5713 },
      { name: "KR Market", lat: 12.9618, lng: 77.5755 },
      { name: "Lalbagh West Gate", lat: 12.9507, lng: 77.5848 },
      { name: "Sony World Signal", lat: 12.936, lng: 77.6271 },
      { name: "Forum Mall, Koramangala", lat: 12.9345, lng: 77.6113 },
    ],
    pathCoordinates: [
      [12.9767, 77.5713],
      [12.9722, 77.5772],
      [12.9698, 77.5878],
      [12.9651, 77.5991],
      [12.9588, 77.6105],
      [12.9517, 77.6198],
      [12.9451, 77.6245],
      [12.9402, 77.6268],
      [12.936, 77.6271],
      [12.9345, 77.6113],
    ],
  },
  {
    routeName: "Indiranagar to Electronic City via Silk Board",
    vehicleType: "Minibus",
    estimatedFare: "INR 40",
    frequency: "Every 20 mins",
    stops: [
      { name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
      { name: "Domlur", lat: 12.9609, lng: 77.6387 },
      { name: "Silk Board", lat: 12.9172, lng: 77.6229 },
      { name: "Electronic City", lat: 12.8452, lng: 77.6602 },
    ],
    pathCoordinates: [
      [12.9784, 77.6408],
      [12.9609, 77.6387],
      [12.942, 77.634],
      [12.9172, 77.6229],
      [12.8888, 77.6412],
      [12.8603, 77.6553],
      [12.8452, 77.6602],
    ],
  },
];

/**
 * Deliberately jittery GPS trace for the "RAW GPS" layer: the messy input the
 * AI is meant to clean up, drawn as an amber dashed line.
 */
export const RAW_GPS_SAMPLE: [number, number][] = [
  [13.1009, 77.5961],
  [13.0921, 77.5946],
  [13.0874, 77.5922],
  [13.0755, 77.5911],
  [13.0643, 77.5901],
  [13.0522, 77.5933],
  [13.0431, 77.5952],
  [13.0359, 77.5971],
  [13.0244, 77.5946],
  [13.0103, 77.5917],
  [13.0011, 77.5862],
  [12.9927, 77.5783],
  [12.9841, 77.5731],
  [12.9769, 77.5716],
];
