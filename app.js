const apiUrl = 'http://localhost:3030';
let socket;
let currentUser = '';

document.addEventListener('DOMContentLoaded', () => fetchUsers());

const toggleForm = () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
    registerForm.style.display = registerForm.style.display === 'none' ? 'block' : 'none';
};

const handleAuthResponse = (response, successMessage, successCallback) => {
    response.json().then(result => {
        if (result === successMessage) {
            alert(successMessage);
            successCallback();
        } else {
            alert(result);
        }
    });
};


const authFetch = async (endpoint, data, successMessage, successCallback) => {
    try {
        const response = await fetch(`${apiUrl}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        handleAuthResponse(response, successMessage, successCallback);
    } catch (error) {
        console.error(`Error during ${endpoint}:`, error);
        alert('A network error occurred.');
    }
};



const login = () => {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    authFetch('login', { username, password }, 'Login successful', () => {
        currentUser = username;
        document.getElementById('current-user').textContent = username;
        showChat();
        establishWebSocketConnection();
    });
};

const register = () => {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    authFetch('register', { username, password }, 'Registration successful', () => {
        toggleForm();
        alert('You can now log in!');
    });
};

const showChat = () => {
    document.getElementById('login-register').style.display = 'none';
    document.getElementById('chat-container').style.display = 'flex';
    fetchUsers();
};

const fetchUsers = () => {
    fetch(`${apiUrl}/users`)
        .then(response => response.json())
        .then(users => {
            const usersList = document.getElementById('users');
            usersList.innerHTML = '';
            users.filter(user => user !== currentUser)
                .forEach(user => {
                    const userItem = document.createElement('li');
                    userItem.textContent = user;
                    userItem.onclick = () => selectUser(user);
                    usersList.appendChild(userItem);
                });
        })
        .catch(error => console.error('Error fetching users:', error));
};

const displayMessages = (messages, containerId = 'messages') => {
    const messagesDiv = document.getElementById(containerId);
    messagesDiv.innerHTML = '';

    messages.forEach((message) => {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = `${message.sender}: ${message.message}`;
        messagesDiv.appendChild(messageDiv);
    });
};

const fetchChatHistory = async (userFrom, userTo) => {
    try {
        const url = new URL(`${apiUrl}/history`);
        url.searchParams.append('user_from', userFrom);
        url.searchParams.append('user_to', userTo);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error fetching history: ${response.status}`);
        }
        const messages = await response.json();
        displayMessages(messages);

    } catch (error) {
        console.error('Error fetching/displaying chat history:', error);
        displayMessages([]);
    }
};

const selectUser = (user) => {
    document.getElementById('chat-with').textContent = user;
    fetchChatHistory(currentUser, user);
};

socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.sender === currentUser || message.receiver === currentUser) {
        displayMessages([message], 'messages', false);
    }
};


const establishWebSocketConnection = () => {
    const socketUrl = `ws://localhost:3030/chat`;
    socket = new WebSocket(socketUrl);

    socket.onopen = () => console.log('WebSocket connected');

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.sender === currentUser || message.receiver === currentUser) {
            displayMessages([message]);
        }
    };

    socket.onclose = () => console.log('WebSocket closed');
    socket.onerror = (error) => console.error('WebSocket error:', error);
};

const sendMessage = () => {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value;
    const receiver = document.getElementById('chat-with').textContent;

    if (message && socket.readyState === WebSocket.OPEN && receiver) {
        const messagePayload = { sender: currentUser, receiver, message };
        socket.send(JSON.stringify(messagePayload));
        messageInput.value = '';
    }
};