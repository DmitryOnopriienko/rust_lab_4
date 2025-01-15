let socket;
let currentUser = '';

document.addEventListener('DOMContentLoaded', (event) => {
    fetchUsers();
});

const toggleForm = () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
    registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
};

const login = async () => {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const response = await fetch('http://localhost:3030/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (result === "Login successful") {
        currentUser = username;
        document.getElementById('current-user').textContent = username;
        showChat();
        connectWebSocket();
    } else {
        alert(result);
    }
};

const register = async () => {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    const response = await fetch('http://localhost:3030/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (result === 'Registration successful') {
        alert('You can now log in!');
        toggleForm();
    } else {
        alert(result);
    }
};

const showChat = () => {
    document.getElementById('login-register').style.display = 'none';
    document.getElementById('chat-container').style.display = 'flex';
    fetchUsers();
};

const fetchUsers = () => {
    fetch('http://localhost:3030/users')
        .then(response => response.json())
        .then(users => {
            const usersList = document.getElementById('users');
            usersList.innerHTML = '';
            users.forEach(user => {
                if (user !== currentUser) {
                    const userItem = document.createElement('li');
                    userItem.textContent = user;
                    userItem.onclick = () => selectUser(user);
                    usersList.appendChild(userItem);
                }
            });
        });
};

const fetchChatHistory = async (userFrom, userTo) => {
    try {
        const url = new URL('http://localhost:3030/history');
        const params = { user_from: userFrom, user_to: userTo };

        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
            const messages = await response.json();
            displayChatHistory(messages);
        } else {
            console.error('Failed to fetch chat history');
        }
    } catch (error) {
        console.error('Error fetching chat history:', error);
    }
};

const displayChatHistory = (messages) => {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = '';

    messages.forEach((message) => {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = `${message.sender}: ${message.message}`;
        messagesDiv.appendChild(messageDiv);
    });
};

const selectUser = (user) => {
    document.getElementById('chat-with').textContent = user;
    fetchChatHistory(currentUser, user);
};

const connectWebSocket = () => {
    const socketUrl = `ws://localhost:3030/chat`;
    socket = new WebSocket(socketUrl);
    console.log(encodeURIComponent(currentUser));
    socket.onopen = () => {
        console.log('WebSocket connected');
    };

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.sender === currentUser || message.receiver === currentUser) {
            displayMessage(message);
        }
    };

    socket.onclose = () => {
        console.log('WebSocket closed');
    };
};

const displayMessage = (message) => {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.textContent = `${message.sender}: ${message.message}`;
    messagesDiv.appendChild(messageDiv);
};

const sendMessage = () => {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value;

    if (message && socket.readyState === WebSocket.OPEN) {
        const messagePayload = {
            sender: currentUser,
            receiver: document.getElementById('chat-with').textContent,
            message
        };
        console.log(JSON.stringify(messagePayload));
        socket.send(JSON.stringify(messagePayload));
        messageInput.value = '';
    }
};