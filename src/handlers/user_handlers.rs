use bcrypt::{hash, verify};
use rusqlite::{params, Connection, Result};
use warp::Reply;
use crate::{HistoryQueryParams, MessageBody, User};

fn get_db_connection() -> Result<Connection> {
    Connection::open("chat.db")
}

pub(crate) fn login(user: User) -> impl Reply {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(_) => return warp::reply::json(&"Database error"),
    };

    let mut stmt = match conn.prepare("SELECT password FROM users WHERE username = ?") {
        Ok(s) => s,
        Err(_) => return warp::reply::json(&"Database error"),
    };

    let db_password: String = match stmt.query_row(params![user.username], |row| row.get(0)) {
        Ok(p) => p,
        Err(rusqlite::Error::QueryReturnedNoRows) => return warp::reply::json(&"User not found"),
        Err(_) => return warp::reply::json(&"Database error"),
    };

    if verify(&user.password, &db_password).unwrap_or(false) {
        warp::reply::json(&"Login successful")
    } else {
        warp::reply::json(&"Invalid password")
    }
}

pub(crate) fn register_user(user: User) -> impl Reply {
    let hashed_password = hash(&user.password, 4).unwrap();
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(_) => return warp::reply::json(&"Database error"),
    };

    if let Err(_) = conn.execute(
        "INSERT INTO users (username, password) VALUES (?1, ?2)",
        params![user.username, hashed_password],
    ) {
        return warp::reply::json(&"Database error");
    }

    warp::reply::json(&"Registration successful")
}

pub(crate) fn get_users() -> impl Reply {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(_) => return warp::reply::json(&"Database error"),
    };
    let mut stmt = match conn.prepare("SELECT username FROM users") {
        Ok(s) => s,
        Err(_) => return warp::reply::json(&"Database error"),
    };
    

    let users: Result<Vec<String>> = stmt.query_map([], |row| row.get(0)).unwrap().collect();

    match users {
        Ok(u) => warp::reply::json(&u),
        Err(_) => warp::reply::json(&"Database error"),
    }
}


pub(crate) fn get_history(params: HistoryQueryParams) -> impl Reply {
    let conn = match get_db_connection() {
        Ok(c) => c,
        Err(_) => return warp::reply::json(&"Database error"),
    };

    let mut stmt = match conn.prepare(
        "SELECT sender, receiver, message \
        FROM messages \
        WHERE (sender = ?1 AND receiver = ?2) OR (sender = ?2 AND receiver = ?1) \
        ORDER BY timestamp ASC"
    ) {
        Ok(s) => s,
        Err(_) => return warp::reply::json(&"Database error"),
    };

    let messages: Result<Vec<MessageBody>> = stmt.query_map(
        params![params.user_from, params.user_to],
        |row| Ok(MessageBody {
            sender: row.get(0)?,
            receiver: row.get(1)?,
            message: row.get(2)?,
        })
    ).unwrap().collect();


    match messages {
        Ok(m) => warp::reply::json(&m),
        Err(_) => warp::reply::json(&"Database error"),
    }
}

pub(crate) fn save_message(payload: &MessageBody) -> Result<()> {
    let conn = get_db_connection()?;

    conn.execute(
        "INSERT INTO messages (sender, receiver, message) VALUES (?1, ?2, ?3)",
        params![payload.sender, payload.receiver, payload.message],
    )?;

    Ok(())
}