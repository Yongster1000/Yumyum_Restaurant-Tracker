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
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
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
  };
}
