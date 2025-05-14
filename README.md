# KVU Offline - Audiobook Offline Player

KVU Offline is a Progressive Web Application (PWA) designed to enable offline listening of audiobooks from knigavuhe.org. This app allows you to download and store audiobooks for offline playback.

## Features

- **Simple Interface**: Easy-to-use form for entering book URLs
- **Fetching Capability**: Parses book pages to extract MP3 files
- **Offline Support**: Progressive Web App with offline capabilities
- **Mobile-Friendly**: Responsive design for all device sizes

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/kvu-offline.git
   cd kvu-offline
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run development server:
   ```
   npm run dev
   ```

4. Build for production:
   ```
   npm run build
   ```

## How to Use

1. Enter a URL from knigavuhe.org in the input field
2. Click "Download" to fetch the book information
3. The app will list all available audio files with their titles and durations
4. You can listen to or download individual files

## Development Roadmap

This is stage 1 of a multi-phase project:

- Stage 1: ✅ Basic book fetching and MP3 listing functionality
- Stage 2: Implementing a player with playback controls
- Stage 3: Managing a library of downloaded books
- Stage 4: Additional features like bookmarks, speed control, etc.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This application is designed for personal use only. Please respect copyright laws and terms of service of knigavuhe.org when using this application.