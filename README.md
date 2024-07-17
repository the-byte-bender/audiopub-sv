# AudioPub

AudioPub is a platform for users to publicly share audio content and engage with other users or audios.

## WTF is wrong with the commit history?

You may notice that the commit history for this project seems to start abruptly. This is because I recently ported the entire application to Svelte, resulting in a new repository. The previous codebase and its history are no longer relevant to this current implementation.

## License.

This project is licensed under the GNU Affero General Public License (AGPL) version 3.0.

Please note that this section provides only a brief overview and is not legal advice. For the full terms and conditions of the license, refer to the `LICENSE` file in this repository or visit the official GNU AGPL license page at:

https://www.gnu.org/licenses/agpl-3.0.en.html

It's important that you read and understand the full license text before modifying or distributing this software. If you have any questions about your rights and obligations under this license, consider consulting someone who knows what they're doing.

Key points of the AGPL (subject to the full license terms):

1. You may use, modify, and distribute the software.
2. If you modify the software, you must make your changes available under the same AGPL license.
3. If you run a modified version of the software on a server and allow users to interact with it remotely, you must provide the source code of your modified version to those users.

I chose this license to ensure that improvements and modifications to this project remain open and accessible to the community.

## User-Generated Content

While the code for AudioPub is licensed under the AGPL, it's important to note that user-generated content (such as uploaded audio files, comments, and other user generated content) is not covered by this license. I do not claim ownership or copyright over user-generated content. All rights to such content belong to their respective creators or rightful owners.

Users are responsible for ensuring they have the necessary rights and permissions for any content they upload or share on AudioPub.

## Getting Started

AudioPub is built with SvelteKit and uses the Node adapter. It also uses MariaDB as its database. To set up the development environment:

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up MariaDB:
   - Install MariaDB on your system if you haven't already
   - Create a new database for AudioPub
4. Configure environment variables:
   - Rename `.env.example` to `.env` and Fill in the values in the `.env` file
5. Start the development server:
   ```
   npm run dev
   ```

This will allow you to explore and modify the code locally.

## Contributing

I welcome contributions to AudioPub! your efforts are appreciated. Here's how you can contribute:

1. Fork the repository
2. Create a new branch for your changes.
3. Make your changes and commit them with clear, descriptive messages
4. Push your changes to your fork
5. Submit a pull request with a comprehensive description of your changes

For major changes, please open an issue first to discuss what you would like to change. You can also open an issue for suggestions, discussions, bugs etc.

## Security Notice

While AudioPub's code is open source, please be aware that I cannot guarantee the security of hosted forks or modified versions of the platform. For your safety and privacy, it's recommended to use only the official deployment at [audiopub.site](https://audiopub.site).

Third-party deployments may contain undisclosed modifications that could compromise your security or privacy. Always exercise caution when using platforms handling your personal data or content.

## Contact

For support, feedback, or inquiries, please open an issue or email me at cccefg2@gmail.com
