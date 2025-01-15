use futures_util::{StreamExt, FutureExt};
use warp::ws::{Message, WebSocket};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use crate::handlers::user_handlers::save_message;
use crate::{MessageBody, Users};

pub(crate) async fn handle_connection(ws: WebSocket, users: Users) {
    let (user_ws_tx, mut user_ws_rx) = ws.split();
    let (tx, rx) = mpsc::unbounded_channel();
    let rx = UnboundedReceiverStream::new(rx);

    tokio::spawn(rx.forward(user_ws_tx).map(|result| {
        if let Err(e) = result {
            eprintln!("Error sending message: {}", e);
        }
    }));

    users.lock().unwrap().push(tx);

    while let Some(result) = user_ws_rx.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                eprintln!("WebSocket error: {}", e);
                break;
            }
        };

        if let Ok(text) = msg.to_str() {
            if let Ok(message_body) = serde_json::from_str::<MessageBody>(text) {
                if let Err(e) = save_message(&message_body) {
                    eprintln!("Database error: {}", e);
                }
                broadcast_message(msg, &users).await;
            } else {
                eprintln!("Invalid message format");
            }
        }
    }
}

async fn broadcast_message(message: Message, users: &Users) {
    let text = match message.to_str() {
        Ok(t) => t,
        Err(_) => return,
    };

    let mut users_locked = users.lock().unwrap();
    let mut disconnected_indices: Vec<usize> = Vec::new();

    for (index, user) in users_locked.iter().enumerate() {
        if user.send(Ok(Message::text(text))).is_err() {
            disconnected_indices.push(index);
        }
    }

    for index in disconnected_indices.iter().rev() {
        users_locked.remove(*index);
    }
}