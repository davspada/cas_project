use serde::{Deserialize, Serialize};
use tokio_postgres::NoTls;
use bb8_postgres::PostgresConnectionManager;
use bb8::Pool;
use ws::{listen, Handler, Message, Result as WsResult, Handshake};
use dotenv::dotenv;
use std::env;
use log::{info, error};

/// Structure to represent a database query request.
#[derive(Debug, Serialize, Deserialize)]
struct QueryRequest {
    query: String,
}

/// Structure to represent a database response.
#[derive(Debug, Serialize, Deserialize)]
struct QueryResponse {
    result: String,
}

/// Structure for the WebSocket server handling connections and queries.
struct Server {
    out: ws::Sender, // Sender for sending messages to WebSocket clients.
    db_pool: Pool<PostgresConnectionManager<NoTls>>, // Database connection pool.
}

impl Handler for Server {
    /// Called when a WebSocket connection is opened.
    fn on_open(&mut self, _: Handshake) -> WsResult<()> {
        info!("WebSocket connection opened."); // Log when a connection is opened.
        Ok(())
    }

    /// Called when a WebSocket connection is closed.
    fn on_close(&mut self, _: ws::CloseCode, _: &str) {
        info!("WebSocket connection closed."); // Log when a connection is closed.
    }

    /// Called when a message is received from the WebSocket client.
    fn on_message(&mut self, msg: Message) -> WsResult<()> {
        info!("Message received: {:?}", msg); // Log the received message.

        // Deserialize the message into a QueryRequest instance.
        let query_request: QueryRequest = serde_json::from_str(msg.as_text()?).map_err(|e| {
            error!("Error deserializing message: {}", e);
            ws::Error::new(ws::ErrorKind::Internal, "Error deserializing message")
        })?;

        // Clone the sender and pool to use in the async task.
        let out = self.out.clone();
        let pool = self.db_pool.clone();

        // Spawn an async task to handle the database query.
        tokio::spawn(async move {
            // Get a connection from the pool.
            let conn = match pool.get().await {
                Ok(c) => c,
                Err(e) => {
                    error!("Error retrieving connection: {}", e);
                    return;
                }
            };

            // Execute the query on the database.
            match conn.query_one(&query_request.query, &[]).await {
                Ok(row) => {
                    // Extract the result from the row.
                    let result: String = row.get(0);
                    let response = QueryResponse { result };
                    let response_text = serde_json::to_string(&response).unwrap();
                    
                    // Send the response to the WebSocket client.
                    if let Err(e) = out.send(response_text) {
                        error!("Error sending message: {}", e);
                    }
                }
                Err(e) => {
                    error!("Error executing query: {}", e);
                }
            }
        });

        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables from .env file.
    dotenv().ok();
    
    // Initialize the logger.
    env_logger::init();

    // Retrieve the database URL and WebSocket address from environment variables.
    let database_url = env::var("DATABASE_URL").map_err(|e| {
        error!("Error reading DATABASE_URL environment variable: {}", e);
        Box::new(e) as Box<dyn std::error::Error>
    })?;
    let websocket_address = env::var("WEBSOCKET_ADDRESS").map_err(|e| {
        error!("Error reading WEBSOCKET_ADDRESS environment variable: {}", e);
        Box::new(e) as Box<dyn std::error::Error>
    })?;

    // Parse the database configuration.
    let config = database_url.parse::<tokio_postgres::Config>().map_err(|e| {
        error!("Error parsing database URL: {}", e);
        Box::new(e) as Box<dyn std::error::Error>
    })?;

    // Create a connection manager for the database.
    let manager = PostgresConnectionManager::new(config, NoTls);
    // Create a pool of database connections.
    let pool = Pool::builder().build(manager).await?;

    println!("WebSocket server listening on ws://{}", websocket_address);

    // Start the WebSocket server and assign the Server instance to each connection.
    listen(&websocket_address, |out| Server {
        out,
        db_pool: pool.clone(),
    }).unwrap();

    Ok(())
}
