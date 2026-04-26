import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SearchSchema = z.object({
  query: z.string().min(1).max(200),
});

const DetailsSchema = z.object({
  placeId: z.string().min(1).max(300),
});

export type PlaceSearchResult = {
  placeId: string;
  name: string;
  formattedAddress: string;
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  openNow?: boolean | null;
  lat?: number;
  lng?: number;
};

export type PlaceDetails = PlaceSearchResult & {
  priceLevel?: string;
  websiteUri?: string;
  googleMapsUri?: string;
};

const FIELD_MASK_SEARCH = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.currentOpeningHours.openNow",
  "places.location",
].join(",");

const FIELD_MASK_DETAILS = [
  "id",
  "displayName",
  "formattedAddress",
  "primaryTypeDisplayName",
  "rating",
  "userRatingCount",
  "currentOpeningHours.openNow",
  "location",
  "priceLevel",
  "websiteUri",
  "googleMapsUri",
].join(",");

function getKey(): string {
  const k = process.env.GOOGLE_MAPS_API_KEY;
  if (!k) throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  return k;
}

export const searchPlaces = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchSchema.parse(input))
  .handler(async ({ data }): Promise<{ results: PlaceSearchResult[]; error: string | null }> => {
    try {
      const key = getKey();
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": FIELD_MASK_SEARCH,
        },
        body: JSON.stringify({ textQuery: data.query, languageCode: "ko" }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Places searchText failed", res.status, txt);
        return { results: [], error: `검색 실패 (${res.status})` };
      }
      const json = (await res.json()) as {
        places?: Array<{
          id: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          primaryTypeDisplayName?: { text?: string };
          rating?: number;
          userRatingCount?: number;
          currentOpeningHours?: { openNow?: boolean };
          location?: { latitude: number; longitude: number };
        }>;
      };
      const results: PlaceSearchResult[] = (json.places ?? []).map((p) => ({
        placeId: p.id,
        name: p.displayName?.text ?? "(이름 없음)",
        formattedAddress: p.formattedAddress ?? "",
        primaryType: p.primaryTypeDisplayName?.text,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        openNow: p.currentOpeningHours?.openNow ?? null,
        lat: p.location?.latitude,
        lng: p.location?.longitude,
      }));
      return { results, error: null };
    } catch (err) {
      console.error("searchPlaces error", err);
      return { results: [], error: "검색 중 오류가 발생했어요" };
    }
  });

export const getPlaceDetails = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DetailsSchema.parse(input))
  .handler(async ({ data }): Promise<{ place: PlaceDetails | null; error: string | null }> => {
    try {
      const key = getKey();
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(data.placeId)}?languageCode=ko`,
        {
          method: "GET",
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": FIELD_MASK_DETAILS,
          },
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        console.error("Place details failed", res.status, txt);
        return { place: null, error: `상세 조회 실패 (${res.status})` };
      }
      const p = (await res.json()) as {
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        primaryTypeDisplayName?: { text?: string };
        rating?: number;
        userRatingCount?: number;
        currentOpeningHours?: { openNow?: boolean };
        location?: { latitude: number; longitude: number };
        priceLevel?: string;
        websiteUri?: string;
        googleMapsUri?: string;
      };
      const place: PlaceDetails = {
        placeId: p.id,
        name: p.displayName?.text ?? "(이름 없음)",
        formattedAddress: p.formattedAddress ?? "",
        primaryType: p.primaryTypeDisplayName?.text,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        openNow: p.currentOpeningHours?.openNow ?? null,
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        priceLevel: p.priceLevel,
        websiteUri: p.websiteUri,
        googleMapsUri: p.googleMapsUri,
      };
      return { place, error: null };
    } catch (err) {
      console.error("getPlaceDetails error", err);
      return { place: null, error: "상세 조회 중 오류가 발생했어요" };
    }
  });
