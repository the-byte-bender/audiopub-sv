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
import { Audio, User } from "$lib/server/database";
import AudioFavorite from "$lib/server/database/models/audio_favorite";
import { Sequelize } from "sequelize";


export const load: PageServerLoad = async (event) => {
  let query = event.url.searchParams.get("q") as string;
  const pageString = event.url.searchParams.get("page") as string;
  const page = pageString ? parseInt(pageString) : 1;
  query = query?.trim();
  if (!query) {
    return {
      audios: [],
      query: "",
      page: 1,
      totalPages: 0,
    };
  }
  if (query.length < 3) {
    return {
      audios: [],
      query,
      page: 1,
      totalPages: 0,
      message: "Query must be at least 3 characters long",
    };
  }
  // Query 1: Get audios with users (standard search query)
  const { rows: audios, count } = await Audio.findAndCountAll({
    where: Sequelize.literal(
      `MATCH(title, description) AGAINST(:query IN NATURAL LANGUAGE MODE)`
    ),
    replacements: { query },
    limit: 30,
    offset: (page - 1) * 30,
    include: {
      model: User,
      where: event.locals.user?.isAdmin ? {} : { isTrusted: true },
    },
    nest: true,
  });
  
  // Query 2: Get favorite data efficiently
  const audioIds = audios.map(audio => audio.id);
  const currentUser = event.locals.user;
  
  let favoriteCounts = new Map<string, number>();
  let userFavorites = new Set<string>();

  if (audioIds.length > 0) {
    try {
      const [favoriteCountsData, userFavoritesData] = await Promise.all([
        // Get favorite counts for all audios in one query
        AudioFavorite.findAll({
          where: { audioId: audioIds },
          attributes: [
            'audioId',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
          ],
          group: ['audioId']
        }),
        // Get current user's favorites in one query
        currentUser ? AudioFavorite.findAll({
          where: { 
            userId: currentUser.id,
            audioId: audioIds 
          },
          attributes: ['audioId']
        }) : Promise.resolve([])
      ]);

      // Process results into maps for easy lookup
      favoriteCounts = new Map(
        favoriteCountsData.map(item => [
          item.audioId, 
          parseInt((item as any).get('count')) || 0
        ])
      );
      userFavorites = new Set(userFavoritesData.map(item => item.audioId));
      
    } catch (err) {
      console.error('Error fetching favorite data:', err);
      // Continue with empty data
    }
  }

  return {
    audios: audios.map((audio) => {
      const favoriteCount = favoriteCounts.get(audio.id) || 0;
      const isFavorited = userFavorites.has(audio.id);
      return audio.toClientside(true, favoriteCount, isFavorited);
    }),
    query,
    page,
    totalPages: Math.ceil(count / 30),
  };
};
