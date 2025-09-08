/*
 * This file is part of the audiopub project.
 * 
 * Copyright (C) 2024 the-byte-bender
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { Audio } from "$lib/server/database";
import AudioFavorite from "$lib/server/database/models/audio_favorite";

export const load: PageServerLoad = async (event) => {
  let query = event.url.searchParams.get("q") as string;
  const pageString = event.url.searchParams.get("page") as string;
  const page = pageString ? parseInt(pageString) : 1;
  query = query?.trim();
  if (!query || query.length < 3) {
    return error(400, "Query must be at least 3 characters long");
  }
  const audios = await Audio.search(query, page);
  
  // Get favorite counts and user favorite status (with error handling)
  const audioIds = audios.map(audio => audio.id);
  const currentUser = event.locals.user;
  
  let favoriteCounts = new Map();
  let userFavorites = new Set();

  try {
    // Only fetch favorite data if there are audios to process
    if (audioIds.length > 0) {
      const favoriteData = await Promise.all([
        // Get individual counts for each audio
        Promise.all(audioIds.map(async (audioId) => {
          try {
            const count = await AudioFavorite.getFavoriteCount(audioId);
            return { audioId, count };
          } catch (err) {
            console.error(`Error getting favorite count for audio ${audioId}:`, err);
            return { audioId, count: 0 };
          }
        })),
        // Get user favorites
        currentUser ? (async () => {
          try {
            const results = await AudioFavorite.findAll({
              where: { 
                userId: currentUser.id,
                audioId: audioIds 
              },
              attributes: ['audioId']
            });
            return new Set(results.map(r => r.audioId));
          } catch (err) {
            console.error('Error getting user favorites:', err);
            return new Set();
          }
        })() : Promise.resolve(new Set())
      ]);

      // Process results
      favoriteCounts = new Map(favoriteData[0].map(item => [item.audioId, item.count]));
      userFavorites = favoriteData[1];
    }
  } catch (err) {
    console.error('Error fetching favorite data:', err);
    // Continue without favorite data
  }

  return {
    audios: audios.map((audio) => {
      const favoriteCount = favoriteCounts.get(audio.id) || 0;
      const isFavorited = userFavorites.has(audio.id);
      return audio.toClientside(true, favoriteCount, isFavorited);
    }),
    query,
    page,
  };
};
