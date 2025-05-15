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

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/odemakov/kvu-offline.git
   cd kvu-offline
   ```

2. Run development server:
   ```
   make dev
   ```

3. Build production server:
   ```
   make build
   ```

4. Run production server in docker swarm:
   ```
   make prod
   ```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This application is designed for personal use only. Please respect copyright laws and terms of service of knigavuhe.org when using this application.
