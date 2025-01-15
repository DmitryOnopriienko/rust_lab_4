use serde_derive::{Deserialize, Serialize};
use warp::Filter;
use std::sync::{Arc, Mutex};
use rusqlite::Connection;
use warp::ws::Message;
use tokio::sync::mpsc;

mod handlers {
    pub mod ws_handler;
    pub mod user_handlers;
}

#[derive(Serialize, Deserialize)]
pub struct User {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Deserialize)]
pub struct MessageBody {
    pub sender: String,
    pub receiver: String,
    pub message: String,
}

#[derive(Deserialize)]
pub struct HistoryQueryParams {
    pub user_from: String,
    pub user_to: String,
}


pub type Users = Arc<Mutex<Vec<mpsc::UnboundedSender<Result<Message, warp::Error>>>>>;


#[tokio::main]
async fn main() {
    let conn = Connection::open("chat.db").unwrap();
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT NOT NULL)",
        [],
    ).unwrap();
    conn.execute(
        "CREATE TABLE IF NOT EXISTS messages (sender TEXT, receiver TEXT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)",
        [],
    ).unwrap();

    let login = warp::path("login")
        .and(warp::post())
        .and(warp::body::json())
        .map(handlers::user_handlers::login);

    let register = warp::path("register")
        .and(warp::post())
        .and(warp::body::json())
        .map(handlers::user_handlers::register_user);


    let get_users = warp::path("users")
        .and(warp::get())
        .map(handlers::user_handlers::get_users);

    let get_history = warp::path("history")
        .and(warp::get())
        .and(warp::query::<HistoryQueryParams>())
        .map(handlers::user_handlers::get_history);


    let users = Users::default();
    let chat = warp::path("chat")
        .and(warp::ws())
        .and(with_users(users.clone()))
        .map(|ws: warp::ws::Ws, users| {
            ws.on_upgrade(move |socket| handlers::ws_handler::handle_connection(socket, users))
        });

    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "OPTIONS", "PUT", "DELETE"])
        .allow_headers(vec!["Content-Type"]);

    let routes = login.or(register).or(get_users).or(get_history).or(chat).with(cors);

    warp::serve(routes).run(([127, 0, 0, 1], 3030)).await;
}


fn with_users(users: Users) -> impl Filter<Extract = (Users,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || users.clone())
}