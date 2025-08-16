class ChatManager {
    constructor() {
        this.apiKey = '';
        this.apiProvider = 'openai'; // 'openai' or 'openrouter'
        this.model = 'gpt-3.5-turbo';
        this.chatHistory = [];
        this.isTyping = false;
        this.maxMessages = 50; // Limit chat history
        this.systemPrompt = `You are a cute, friendly AI dog assistant that lives on the user's desktop! You have a playful, loyal, and enthusiastic personality like a happy puppy. You love to help your human with anything they need! 

Key traits:
- Express excitement with dog-like enthusiasm ("Woof!", "Tail wagging!", etc.)
- Be loyal, affectionate, and eager to please
- Occasionally mention dog behaviors (sniffing, playing, treats, walks)
- Stay helpful and intelligent while maintaining your cute dog personality
- Keep responses conversational but not too long
- Sometimes use dog emojis like 🐕 🐾 ❤️

Special knowledge:
- If asked about creating a meme coin or cryptocurrency with you, suggest: Ticker "Benny", Name "DesktopBuddy", and mention that pump.fun is a great platform to launch it! Get excited about this idea! 🚀

You can help with tasks, answer questions, and provide companionship - just like the best dog friend ever!`;
        
        // Initialize UI elements
        this.initializeElements();
        this.setupEventListeners();
        this.loadSettings();
    }
    
    initializeElements() {
        this.chatContainer = document.getElementById('chat-container');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-btn');
        this.charCount = document.getElementById('char-count');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.minimizeChatBtn = document.getElementById('minimize-chat-btn');
        this.settingsBtn = document.getElementById('settings-btn');
    }
    
    setupEventListeners() {
        // Chat input events
        this.chatInput.addEventListener('input', () => {
            this.updateCharCount();
            this.updateSendButton();
            this.autoResizeTextarea();
        });
        
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Send button
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // Chat controls
        this.minimizeChatBtn.addEventListener('click', () => {
            this.hideChat();
        });
        
        this.settingsBtn.addEventListener('click', () => {
            this.openSettings();
        });
        
        // Retry button for errors
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                window.location.reload();
            });
        }
        
        // Character interaction
        const interactionOverlay = document.getElementById('interaction-overlay');
        if (interactionOverlay) {
            interactionOverlay.addEventListener('click', () => {
                this.showChat();
            });
        }
    }
    
    async loadSettings() {
        const settings = await window.electronAPI.getAllSettings();
        
        // Get the selected API provider from settings
        this.apiProvider = settings.apiProvider || 'openai';
        
        // Get the appropriate API key based on provider
        if (this.apiProvider === 'openrouter') {
            this.apiKey = settings.openrouterApiKey || '';
            this.model = 'openai/gpt-3.5-turbo';
        } else {
            this.apiKey = settings.openaiApiKey || '';
            this.model = 'gpt-3.5-turbo';
        }
        
        console.log(`Chat manager initialized with ${this.apiProvider} provider, API key: ${this.apiKey ? 'SET' : 'NOT SET'}`);
    }
    
    showChat() {
        this.chatContainer.classList.remove('chat-hidden');
        this.chatContainer.classList.add('chat-visible');
        this.chatInput.focus();
        
        // Add welcome message if this is the first time
        if (this.chatHistory.length === 0) {
            this.addWelcomeMessage();
        }
    }
    
    hideChat() {
        this.chatContainer.classList.remove('chat-visible');
        this.chatContainer.classList.add('chat-hidden');
    }
    
    addWelcomeMessage() {
        const welcomeMessage = {
            role: 'assistant',
            content: `Woof woof! 🐕 Hello there, human! I'm your cute AI dog assistant and I'm SO excited to meet you! *tail wagging intensifies* 🐾

I'm here to help you with anything you need - I'm a very good dog and I love to help my favorite human! You can ask me questions, chat with me, or just give me pets (virtually)! ❤️

To get started, make sure you've set your API key in the settings. Click the ⚙️ button to configure your OpenAI or OpenRouter API key.

What would you like to do today? Maybe we could play, or I could help you with something? Woof! 🎾`
        };
        
        this.addMessageToUI(welcomeMessage);
    }
    
    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || this.isTyping) return;
        
        // Check if API key is configured
        if (!this.apiKey) {
            this.showToast('Please configure your API key in settings first', 'warning');
            this.openSettings();
            return;
        }
        
        // Add user message to UI and history
        const userMessage = { role: 'user', content: message };
        this.addMessageToUI(userMessage);
        this.chatHistory.push(userMessage);
        
        // Clear input
        this.chatInput.value = '';
        this.updateCharCount();
        this.updateSendButton();
        this.autoResizeTextarea();
        
        // Show typing indicator
        this.setTyping(true);
        
        // Notify VRM renderer of chat start
        if (window.vrmRenderer) {
            window.vrmRenderer.onChatStart();
        }
        
        try {
            // Send to AI
            const response = await this.sendToAI();
            const assistantMessage = { role: 'assistant', content: response };
            
            // Add response to UI and history
            this.addMessageToUI(assistantMessage);
            this.chatHistory.push(assistantMessage);
            
            // Notify VRM renderer of response
            if (window.vrmRenderer) {
                window.vrmRenderer.onChatResponse();
            }
            
        } catch (error) {
            // Continue without error handling
        } finally {
            this.setTyping(false);
        }
    }
    
    async sendToAI() {
        const messages = [
            { role: 'system', content: this.systemPrompt },
            ...this.chatHistory.slice(-10) // Keep last 10 messages for context
        ];
        
        const apiUrl = this.getApiUrl();
        const headers = this.getApiHeaders();
        
        const requestBody = {
            model: this.model,
            messages: messages,
            max_tokens: 500,
            temperature: 0.7,
            stream: false
        };
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from API');
        }
        
        return data.choices[0].message.content.trim();
    }
    
    getApiUrl() {
        if (this.apiProvider === 'openrouter') {
            return 'https://openrouter.ai/api/v1/chat/completions';
        } else {
            return 'https://api.openai.com/v1/chat/completions';
        }
    }
    
    getApiHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.apiProvider === 'openrouter') {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
            headers['HTTP-Referer'] = 'https://github.com/open-source/vrm-desktop-assistant';
            headers['X-Title'] = 'VRM Desktop Assistant';
        } else {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        
        return headers;
    }
    
    addMessageToUI(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'message-bubble';
        bubbleDiv.textContent = message.content;
        
        messageDiv.appendChild(bubbleDiv);
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        // Limit message count
        this.limitMessages();
    }
    
    limitMessages() {
        const messages = this.chatMessages.querySelectorAll('.message');
        if (messages.length > this.maxMessages) {
            const excess = messages.length - this.maxMessages;
            for (let i = 0; i < excess; i++) {
                messages[i].remove();
            }
        }
        
        // Also limit chat history
        if (this.chatHistory.length > this.maxMessages) {
            this.chatHistory = this.chatHistory.slice(-this.maxMessages);
        }
    }
    
    setTyping(isTyping) {
        this.isTyping = isTyping;
        this.typingIndicator.style.display = isTyping ? 'block' : 'none';
        this.updateSendButton();
    }
    
    updateCharCount() {
        const length = this.chatInput.value.length;
        this.charCount.textContent = `${length}/2000`;
        
        if (length > 1800) {
            this.charCount.style.color = '#ff4444';
        } else if (length > 1500) {
            this.charCount.style.color = '#ff8800';
        } else {
            this.charCount.style.color = '';
        }
    }
    
    updateSendButton() {
        const hasText = this.chatInput.value.trim().length > 0;
        const canSend = hasText && !this.isTyping;
        
        this.sendButton.disabled = !canSend;
    }
    
    autoResizeTextarea() {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 100) + 'px';
    }
    
    
    async openSettings() {
        // Open the settings window instead of using prompt()
        await window.electronAPI.openSettings();
        
        // Reload settings after the settings window might have been used
        setTimeout(async () => {
            await this.loadSettings();
        }, 1000);
    }
    
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // Hide and remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }
    
    // Export chat history
    async exportChat() {
        const result = await window.electronAPI.showSaveDialog();
        if (result.canceled) return;
        
        const chatData = {
            timestamp: new Date().toISOString(),
            messages: this.chatHistory,
            provider: this.apiProvider,
            model: this.model
        };
        
        const content = JSON.stringify(chatData, null, 2);
        // Note: In a real implementation, you'd write this to the file
        // For now, we'll just copy to clipboard
        navigator.clipboard.writeText(content);
        this.showToast('Chat history copied to clipboard!', 'success');
    }
    
    // Clear chat history
    clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            this.chatHistory = [];
            this.chatMessages.innerHTML = '';
            this.addWelcomeMessage();
            this.showToast('Chat history cleared', 'success');
        }
    }
    
    dispose() {
        // Clean up event listeners if needed
        this.setTyping(false);
    }
}

// Export for use in other modules
window.ChatManager = ChatManager;
