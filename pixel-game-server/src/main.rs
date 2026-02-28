// This file is the entry point of the Rust application. It initializes the server, loads the configuration, and starts listening for incoming connections.

use std::net::{TcpListener, TcpStream};
use std::io::{Read, Write};
use std::thread;
use std::sync::{Arc, Mutex};

mod config;
mod server;
mod game;
mod network;
mod utils;

fn main() {
    // Load configuration
    let config = config::load_config().expect("Failed to load configuration");

    // Initialize server
    let listener = TcpListener::bind(format!("0.0.0.0:{}", config.port)).expect("Failed to bind to address");
    println!("Server listening on port {}", config.port);

    let connections = Arc::new(Mutex::new(Vec::new()));

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let connections = Arc::clone(&connections);
                thread::spawn(move || {
                    handle_connection(stream, connections);
                });
            }
            Err(e) => {
                eprintln!("Error accepting connection: {}", e);
            }
        }
    }
}

fn handle_connection(mut stream: TcpStream, connections: Arc<Mutex<Vec<TcpStream>>>) {
    // Add the new connection to the list
    connections.lock().unwrap().push(stream.try_clone().unwrap());

    let mut buffer = [0; 1024];
    while match stream.read(&mut buffer) {
        Ok(size) => {
            // Handle incoming data
            // For now, just echo it back
            stream.write(&buffer[0..size]).is_ok()
        }
        Err(_) => {
            // Remove the connection on error
            connections.lock().unwrap().retain(|s| s.peer_addr().unwrap() != stream.peer_addr().unwrap());
            false
        }
    } {}
}