# Pixel Game Server

## Overview
The Pixel Game Server is a multiplayer 2D pixel art game server built in Rust. It is designed to handle multiple player connections, manage game state, and facilitate communication between clients.

## Features
- Multiplayer support
- Game state management
- Player session handling
- Network communication protocol

## Getting Started

### Prerequisites
- Rust (latest stable version)
- Cargo (Rust package manager)

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd pixel-game-server
   ```

2. Build the project:
   ```
   cargo build
   ```

3. Run the server:
   ```
   cargo run
   ```

### Configuration
The server configuration can be modified in the `src/config.rs` file. You can set parameters such as the port number and game settings.

### Running Tests
To run the tests for the game and network functionality, use:
```
cargo test
```

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.