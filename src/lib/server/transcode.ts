import { exec } from "child_process";

export default function transcode(inputFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputFilePath = `${inputFilePath}.aac`;
    const ffmpegCommand = `ffmpeg -y -hide_banner -loglevel error -nostdin -i "${inputFilePath}" -c:a aac -b:a 256k "${outputFilePath}"`;
    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        error.message = error.message.replace(ffmpegCommand, "");
        console.error(`Error transcoding file: ${error}`);
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
