// Main application entry point for the renderer process
class VRMDesktopAssistant {
    constructor() {
        this.vrmRenderer = null;
        this.chatManager = null;
        this.isInitialized = false;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.onMovementUpdate = this.onMovementUpdate.bind(this);
    }
    
    async init() {
        try {
            console.log('Initializing VRM Desktop Assistant...');
            
            // Initialize VRM Renderer
            this.vrmRenderer = new VRMRenderer();
            await this.vrmRenderer.init('vrm-canvas');
            
            // Make VRM renderer globally available
            window.vrmRenderer = this.vrmRenderer;
            
            // Initialize Chat Manager
            this.chatManager = new ChatManager();
            
            // Make chat manager globally available
            window.chatManager = this.chatManager;
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup retry button
            this.setupRetryButton();
            
            this.isInitialized = true;
            console.log('VRM Desktop Assistant initialized successfully!');
            
            // Show ready notification
            if (this.chatManager) {
                this.chatManager.showToast('VRM Assistant is ready!', 'success');
            }
            
        } catch (error) {
            // Continue without error handling
        }
    }
    
    setupEventListeners() {
        // Listen for movement updates from main process
        if (window.electronAPI && window.electronAPI.onMovementUpdate) {
            window.electronAPI.onMovementUpdate(this.onMovementUpdate);
        }
        
        // Handle window focus/blur for performance optimization
        window.addEventListener('focus', () => {
            this.onWindowFocus();
        });
        
        window.addEventListener('blur', () => {
            this.onWindowBlur();
        });
        
        // Handle before unload
        window.addEventListener('beforeunload', () => {
            this.dispose();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
        
        // Prevent context menu in production
        if (!window.location.href.includes('--dev')) {
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
        }
    }
    
    setupRetryButton() {
        // No retry button needed anymore
    }
    
    onMovementUpdate(direction) {
        // Pass movement updates to VRM renderer for animation
        if (this.vrmRenderer && this.vrmRenderer.onMovementUpdate) {
            this.vrmRenderer.onMovementUpdate(direction);
        }
    }
    
    onWindowFocus() {
        // Resume animations and rendering when window gains focus
        console.log('Window focused - resuming full rendering');
        // Could implement performance optimizations here
    }
    
    onWindowBlur() {
        // Reduce performance when window loses focus
        console.log('Window blurred - optimizing performance');
        // Could reduce animation frame rate here
    }
    
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to open chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (this.chatManager) {
                this.chatManager.showChat();
            }
        }
        
        // Escape to close chat
        if (e.key === 'Escape') {
            e.preventDefault();
            if (this.chatManager) {
                this.chatManager.hideChat();
            }
        }
        
        // Ctrl/Cmd + R to reload (dev only)
        if ((e.ctrlKey || e.metaKey) && e.key === 'r' && 
            window.location.href.includes('--dev')) {
            e.preventDefault();
            window.location.reload();
        }
    }
    
    
    // Performance monitoring
    getPerformanceInfo() {
        if (!this.isInitialized) {
            return { status: 'not_initialized' };
        }
        
        const info = {
            status: 'running',
            timestamp: Date.now(),
            vrmLoaded: this.vrmRenderer ? this.vrmRenderer.isLoaded : false,
            chatReady: this.chatManager ? true : false,
            memoryUsage: performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            } : null
        };
        
        return info;
    }
    
    // Debug helpers
    toggleDebugMode() {
        const isDebug = document.body.classList.toggle('debug-mode');
        console.log(`Debug mode ${isDebug ? 'enabled' : 'disabled'}`);
        
        if (isDebug) {
            this.showDebugInfo();
        } else {
            this.hideDebugInfo();
        }
    }
    
    showDebugInfo() {
        const debugInfo = document.createElement('div');
        debugInfo.id = 'debug-info';
        debugInfo.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            max-width: 300px;
        `;
        
        const updateDebugInfo = () => {
            const perf = this.getPerformanceInfo();
            debugInfo.innerHTML = `
                <div><strong>VRM Desktop Assistant Debug</strong></div>
                <div>Status: ${perf.status}</div>
                <div>VRM Loaded: ${perf.vrmLoaded}</div>
                <div>Chat Ready: ${perf.chatReady}</div>
                ${perf.memoryUsage ? `
                    <div>Memory: ${perf.memoryUsage.used}MB / ${perf.memoryUsage.total}MB</div>
                ` : ''}
                <div>FPS: ${this.getFPS()}</div>
            `;
        };
        
        document.body.appendChild(debugInfo);
        this.debugInterval = setInterval(updateDebugInfo, 1000);
        updateDebugInfo();
    }
    
    hideDebugInfo() {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.remove();
        }
        
        if (this.debugInterval) {
            clearInterval(this.debugInterval);
            this.debugInterval = null;
        }
    }
    
    getFPS() {
        if (!this.frameCount) this.frameCount = 0;
        if (!this.lastTime) this.lastTime = performance.now();
        
        this.frameCount++;
        const now = performance.now();
        
        if (now - this.lastTime >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
            this.frameCount = 0;
            this.lastTime = now;
            this.currentFPS = fps;
        }
        
        return this.currentFPS || 0;
    }
    
    dispose() {
        console.log('Disposing VRM Desktop Assistant...');
        
        // Clean up VRM renderer
        if (this.vrmRenderer) {
            this.vrmRenderer.dispose();
            this.vrmRenderer = null;
        }
        
        // Clean up chat manager
        if (this.chatManager) {
            this.chatManager.dispose();
            this.chatManager = null;
        }
        
        // Clear debug info
        this.hideDebugInfo();
        
        // Remove global references
        window.vrmRenderer = null;
        window.chatManager = null;
        
        // Remove event listeners
        if (window.electronAPI && window.electronAPI.removeAllListeners) {
            window.electronAPI.removeAllListeners('movement-update');
        }
        
        this.isInitialized = false;
        console.log('VRM Desktop Assistant disposed');
    }
}


// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Starting VRM Desktop Assistant');
    
    // Create and initialize the main application
    const app = new VRMDesktopAssistant();
    window.vrmApp = app; // Make app globally accessible for debugging
    
    try {
        await app.init();
    } catch (error) {
        console.error('Failed to start application:', error);
    }
});

// Development helpers
if (window.location.href.includes('--dev')) {
    // Expose debug functions in development
    window.debugVRM = () => {
        if (window.vrmApp) {
            window.vrmApp.toggleDebugMode();
        }
    };
    
    window.getVRMInfo = () => {
        if (window.vrmApp) {
            return window.vrmApp.getPerformanceInfo();
        }
    };
    
    console.log('Development mode enabled. Use debugVRM() and getVRMInfo() for debugging.');
}
