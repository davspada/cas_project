use tokio_postgres::{NoTls, Error as PgError};
use tokio::net::{TcpListener};
use std::sync::Arc;
use tokio_tungstenite::{accept_async, tungstenite::protocol::Message, tungstenite::protocol::CloseFrame, tungstenite::protocol::frame::coding::CloseCode, tungstenite::Error as WsError};
use futures::{StreamExt, SinkExt};
use serde::{Deserialize, Serialize};
use geo_types::Point;

#[derive(Serialize, Deserialize, Debug)]
struct ClientData {
    code: String,
    position: Point<f64>, // latitude, longitude
    transport_mode: String,
}

#[tokio::main]
async fn main() -> Result<(), PgError> {
    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(addr).await.expect("Impossibile collegarsi");

    // Connessione al database PostGIS
    let (db_client, connection) = tokio_postgres::connect("host=localhost user=postgis password=password dbname=mydb", NoTls).await?;
    let db_client = Arc::new(db_client);

    // Gestione della connessione del database
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("Errore nella connessione al database: {}", e);
        }
    });

    println!("Server WebSocket in ascolto su: {}", addr);

    while let Ok((stream, _)) = listener.accept().await {
        let db_client = Arc::clone(&db_client);

        tokio::spawn(async move {
            let ws_stream = accept_async(stream).await.expect("Errore durante l'handshake WebSocket");
            println!("Handshake WebSocket completato");

            let (mut write, mut read) = ws_stream.split();

            // Autenticazione e ricezione dei dati iniziali
            if let Some(auth_message) = read.next().await {
                match auth_message {
                    Ok(msg) if msg.is_text() => {
                        let client_data: ClientData = serde_json::from_str(msg.to_text().unwrap()).unwrap();
                        
                        if let Ok(true) = validate_and_update_client(&db_client, &client_data).await {
                            println!("Autenticazione e aggiornamento riusciti per il codice: {}", client_data.code);

                            // Inizio il ciclo principale per la gestione dei messaggi successivi
                            while let Some(message) = read.next().await {
                                match message {
                                    Ok(msg) => match msg {
                                        Message::Text(received_text) => {
                                            let updated_data: ClientData = serde_json::from_str(&received_text).unwrap();
                                            update_client_data(&db_client, &updated_data).await.unwrap();
                                            write.send(Message::text(received_text)).await.unwrap();
                                        }
                                        Message::Close(_) => {
                                            println!("Il client ha chiuso la connessione.");
                                            disconnect_client(&db_client, &client_data.code).await.unwrap();
                                            break;
                                        }
                                        _ => {}
                                    },
                                    Err(WsError::ConnectionClosed) => {
                                        println!("Il client si è disconnesso.");
                                        disconnect_client(&db_client, &client_data.code).await.unwrap();
                                        break;
                                    }
                                    Err(e) => {
                                        println!("Errore: {}", e);
                                        break;
                                    }
                                }
                            }
                        } else {
                            println!("Autenticazione fallita per il codice: {}", client_data.code);
                            let close_frame = CloseFrame {
                                code: CloseCode::Normal,
                                reason: "Autenticazione fallita".into(),
                            };
                            write.send(Message::Close(Some(close_frame))).await.unwrap();
                        }
                    }
                    _ => {
                        println!("Autenticazione fallita, nessun token ricevuto.");
                        let close_frame = CloseFrame {
                            code: CloseCode::Normal,
                            reason: "Autenticazione fallita".into(),
                        };
                        write.send(Message::Close(Some(close_frame))).await.unwrap();
                    }
                }
            }
        });
    }
    Ok(())
}

// Funzione per validare e aggiornare o inserire il client nel DB
async fn validate_and_update_client(client: &tokio_postgres::Client, data: &ClientData) -> Result<bool, PgError> {
    let query = "SELECT EXISTS(SELECT 1 FROM users WHERE code = $1)";
    let exists = client.query_one(query, &[&data.code]).await?.get::<_, bool>(0);

    if exists {
        // Se l'entry esiste, aggiorna i dati
        let update = "UPDATE users SET position = ST_SetSRID(ST_MakePoint($2, $3), 4326), transport_mode = $4, connected = true WHERE code = $1";
        client.execute(update, &[&data.code, &data.position.x(), &data.position.y(), &data.transport_mode]).await?;
        Ok(true)
    } else {
        // Se l'entry non esiste, inserisce una nuova riga
        let insert = "INSERT INTO users (code, connected, position, transport_mode) VALUES ($1, true, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4)";
        client.execute(insert, &[&data.code, &data.position.x(), &data.position.y(), &data.transport_mode]).await?;
        Ok(true)
    }
}


// Funzione per aggiornare i dati del client durante la connessione
async fn update_client_data(client: &tokio_postgres::Client, data: &ClientData) -> Result<(), PgError> {
    let query = "SELECT EXISTS(SELECT 1 FROM users WHERE code = $1 AND connected = true)";
    let exists = client.query_one(query, &[&data.code]).await?.get::<_, bool>(0);

    if !exists {
        let update = "UPDATE users SET position = ST_SetSRID(ST_MakePoint($2, $3), 4326), transport_mode = $4 WHERE code = $1";
        client.execute(update, &[&data.code, &data.position.x(), &data.position.y(), &data.transport_mode]).await?;
    }

    Ok(())
}

// Funzione per disconnettere il client
async fn disconnect_client(client: &tokio_postgres::Client, code: &str) -> Result<(), PgError> {
    let update = "UPDATE users SET connected = false WHERE code = $1";
    client.execute(update, &[&code]).await?;
    Ok(())
}
