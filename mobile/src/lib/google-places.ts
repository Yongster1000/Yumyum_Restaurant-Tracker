// Thin wrapper around the Places API (New) — autocomplete + place details.
// Docs: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
//       https://developers.google.com/maps/documentation/places/web-service/place-details
//
// Requires "Places API (New)" (not just the legacy "Places API") enabled for
// the project behind EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in Google Cloud Console.

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export type PlacePrediction = {
  placeId: string;
  text: string;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  photoName: string | null;
  costBracket: string | null;
  foodType: string | null;
};

// Google's `priceLevel` enum (Places API (New)) mapped to a `$`-style bracket
// for display. A place with no price data comes back as `undefined` or
// `PRICE_LEVEL_UNSPECIFIED`, neither of which is in this map, so the lookup
// falls through to `null` below.
const PRICE_LEVEL_BRACKETS: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

// Groups an autocomplete session (keystrokes + the resulting details fetch)
// into one billable session, per Google's guidance. Callers should generate
// one per "search interaction" and discard it after fetchPlaceDetails.
export function createSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function autocompletePlaces(
  input: string,
  sessionToken: string,
): Promise<PlacePrediction[]> {
  if (!API_KEY || input.trim().length < 3) return [];

  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
    },
    body: JSON.stringify({ input, sessionToken }),
  });

  if (!response.ok) {
    throw new Error(`Places autocomplete failed: ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  const suggestions: any[] = json.suggestions ?? [];
  return suggestions
    .filter((suggestion) => suggestion.placePrediction)
    .map((suggestion) => ({
      placeId: suggestion.placePrediction.placeId,
      text: suggestion.placePrediction.text.text,
    }));
}

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails> {
  if (!API_KEY) throw new Error('Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY.');

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?sessionToken=${sessionToken}`,
    {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,location,photos,priceLevel,primaryTypeDisplayName',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Place details failed: ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  return {
    placeId: json.id,
    name: json.displayName?.text ?? '',
    address: json.formattedAddress ?? '',
    lat: json.location?.latitude ?? 0,
    lng: json.location?.longitude ?? 0,
    photoName: json.photos?.[0]?.name ?? null,
    costBracket: PRICE_LEVEL_BRACKETS[json.priceLevel] ?? null,
    // Google's one human-readable category for the place (e.g. "Italian
    // restaurant") — used as the place's sole food-type tag. `types` also
    // exists on the API but only as raw, untranslated enum strings (plus
    // generic noise like "point_of_interest"), so it's not usable as a label.
    foodType: json.primaryTypeDisplayName?.text ?? null,
  };
}

// Builds a renderable image URL for a stored `google_photo_name` (the Places
// API (New) photo *resource name*, e.g. "places/ChIJ.../photos/AeJ..."). The
// API key is appended here, at read time, rather than being baked into the
// stored column.
export function getPlacePhotoUrl(photoName: string, maxWidthPx = 800): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${API_KEY}`;
}
