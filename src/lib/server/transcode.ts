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
import { exec } from "child_process";
import fs from "fs/promises";

export default function transcode(inputFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputFilePath = `${inputFilePath}.aac`;
    // ffmpeg writes to a temporary name and the result is renamed into place
    // once it is complete, so nothing ever serves a half-written file.
    const partialFilePath = `${outputFilePath}.part`;
    const ffmpegCommand = `ffmpeg -y -hide_banner -loglevel error -nostdin -i "${inputFilePath}" -c:a aac -b:a 256k -f adts "${partialFilePath}"`;
    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        error.message = error.message.replace(ffmpegCommand, "");
        console.error(`Error transcoding file: ${error}`);
        reject(error);
      } else {
        fs.rename(partialFilePath, outputFilePath).then(resolve, reject);
      }
    });
  });
}
