// Hand-written to match supabase/migrations/0001_init.sql.
// Regenerate with the Supabase CLI once the project is linked:
//   npx supabase gen types typescript --linked > src/types/database.ts

export type User = {
  id: string;
  display_name: string;
  created_at: string;
};

export type Place = {
  id: string;
  google_place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  cost_bracket: string | null;
  google_photo_name: string | null;
  created_at: string;
};

export type FoodType = {
  id: string;
  name: string;
};

export type PlaceFoodType = {
  place_id: string;
  food_type_id: string;
};

export type Entry = {
  id: string;
  user_id: string;
  place_id: string;
  rating: number | null;
  visited: boolean;
  comment: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
};

// Convenience shapes for joined queries used by the Own/Discover/Place-detail screens.
export type EntryWithPlace = Entry & { place: Place };
export type EntryWithUser = Entry & { user: User };
export type PlaceWithFoodTypes = Place & { food_types: FoodType[] };

export type Database = {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User> & Pick<User, 'id' | 'display_name'>; Update: Partial<User> };
      places: {
        Row: Place;
        Insert: Partial<Place> & Pick<Place, 'google_place_id' | 'name' | 'address' | 'lat' | 'lng'>;
        Update: Partial<Place>;
      };
      food_types: { Row: FoodType; Insert: Partial<FoodType> & Pick<FoodType, 'name'>; Update: Partial<FoodType> };
      place_food_types: { Row: PlaceFoodType; Insert: PlaceFoodType; Update: Partial<PlaceFoodType> };
      entries: {
        Row: Entry;
        Insert: Partial<Entry> & Pick<Entry, 'user_id' | 'place_id'>;
        Update: Partial<Entry>;
      };
    };
  };
};
