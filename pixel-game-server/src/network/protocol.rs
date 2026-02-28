// This file defines the communication protocol between the server and clients, including message formats and expected behaviors.

pub mod protocol {
    use serde::{Serialize, Deserialize};

    #[derive(Serialize, Deserialize, Debug)]
    pub enum Message {
        Connect { username: String },
        Disconnect,
        Move { x: f32, y: f32 },
        Action { action_type: String },
        // Add more message types as needed
    }

    #[derive(Serialize, Deserialize, Debug)]
    pub struct Protocol {
        pub version: String,
        pub messages: Vec<Message>,
    }

    impl Protocol {
        pub fn new(version: &str) -> Self {
            Protocol {
                version: version.to_string(),
                messages: Vec::new(),
            }
        }

        pub fn add_message(&mut self, message: Message) {
            self.messages.push(message);
        }
    }
}