struct Connection {
    stream: std::net::TcpStream,
}

impl Connection {
    pub fn new(stream: std::net::TcpStream) -> Self {
        Connection { stream }
    }

    pub fn send_message(&mut self, message: &str) -> std::io::Result<()> {
        self.stream.write_all(message.as_bytes())?;
        Ok(())
    }

    pub fn receive_message(&mut self) -> std::io::Result<String> {
        let mut buffer = [0; 1024];
        let bytes_read = self.stream.read(&mut buffer)?;
        Ok(String::from_utf8_lossy(&buffer[..bytes_read]).to_string())
    }
}