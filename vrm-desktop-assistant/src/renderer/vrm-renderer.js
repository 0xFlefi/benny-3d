class VRMRenderer {
    constructor() {
        this.isLoaded = false;
        this.canvas = null;
        this.fallbackMode = false;
        
        // Animation states
        this.animationStates = {
            idle: 'idle',
            talking: 'talking',
            thinking: 'thinking',
            happy: 'happy',
            moving: 'moving'
        };
        
        this.currentState = this.animationStates.idle;
        
        // Bind methods
        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
    }
    
    async init(canvasId) {
        try {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) {
                throw new Error(`Canvas with id '${canvasId}' not found`);
            }
            
            // Check if THREE.js is available
            if (typeof THREE === 'undefined') {
                console.warn('THREE.js not available, using fallback mode');
                this.useFallbackMode();
                return;
            }
            
            // Initialize Three.js scene
            this.initScene();
            this.initCamera();
            this.initRenderer();
            this.initLighting();
            
            // Load VRM character
            await this.loadVRM();
            
            // Setup event listeners
            window.addEventListener('resize', this.onWindowResize);
            
            // Start animation loop
            this.animate();
            
            this.isLoaded = true;
            this.hideLoading();
            
            console.log('VRM Renderer initialized successfully');
            
        } catch (error) {
            this.useFallbackMode();
        }
    }
    
    useFallbackMode() {
        this.fallbackMode = true;
        this.hideLoading();
        this.createCSSCharacter();
        this.isLoaded = true;
        console.log('Using CSS fallback character');
    }
    
    createCSSCharacter() {
        // Hide canvas and create dog image character
        this.canvas.style.display = 'none';
        
        const container = this.canvas.parentNode;
        
        // Create dog character container with image
        const character = document.createElement('div');
        character.className = 'dog-character';
        
        const dogImage = document.createElement('img');
        dogImage.src = '../../assets/dog.png';
        dogImage.alt = 'Cute AI Dog Assistant';
        dogImage.className = 'dog-image';
        
        character.appendChild(dogImage);
        container.appendChild(character);
        
        // Add styles for dog image character
        const style = document.createElement('style');
        style.textContent = `
            .dog-character {
                position: relative;
                width: 250px;
                height: 250px;
                margin: 30px auto;
                display: flex;
                justify-content: center;
                align-items: center;
                animation: dogFloat 3s ease-in-out infinite;
                cursor: pointer;
                transition: transform 0.2s ease;
            }
            
            .dog-character:hover {
                transform: scale(1.05);
            }
            
            .dog-image {
                max-width: 100%;
                max-height: 100%;
                width: auto;
                height: auto;
                object-fit: contain;
                border-radius: 15px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                transition: all 0.3s ease;
            }
            
            .dog-character:hover .dog-image {
                box-shadow: 0 12px 35px rgba(0,0,0,0.25);
            }
            
            @keyframes dogFloat {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
            }
            
            @keyframes dogBounce {
                0%, 100% { transform: translateY(0px) scale(1); }
                50% { transform: translateY(-15px) scale(1.05); }
            }
            
            @keyframes dogWiggle {
                0%, 100% { transform: rotate(0deg); }
                25% { transform: rotate(-3deg); }
                75% { transform: rotate(3deg); }
            }
            
            @keyframes dogPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.08); }
            }
            
            .dog-character.talking {
                animation: dogBounce 0.6s ease-in-out infinite;
            }
            
            .dog-character.thinking {
                animation: dogFloat 1s ease-in-out infinite;
            }
            
            .dog-character.thinking .dog-image {
                filter: brightness(1.1) contrast(1.1);
            }
            
            .dog-character.happy {
                animation: dogWiggle 0.5s ease-in-out infinite;
            }
            
            .dog-character.happy .dog-image {
                filter: brightness(1.2) saturate(1.3);
            }
            
            .dog-character.moving {
                animation: dogPulse 0.8s ease-in-out infinite;
            }
            
            .dog-character.moving .dog-image {
                filter: blur(0.5px) brightness(1.1);
            }
            
            /* Add a cute glow effect */
            .dog-character.idle .dog-image {
                filter: drop-shadow(0 0 10px rgba(255, 182, 193, 0.3));
            }
        `;
        
        document.head.appendChild(style);
        
        this.characterElement = character;
    }
    
    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = null; // Transparent background
    }
    
    initCamera() {
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
        this.camera.position.set(0, 1.2, 2.5);
        this.camera.lookAt(0, 1, 0);
    }
    
    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true
        });
        
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
    }
    
    initLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }
    
    async loadVRM() {
        try {
            // Check if THREE.js is available
            if (typeof THREE === 'undefined') {
                console.warn('THREE.js not available, trying to load dog.vrm directly');
                await this.loadVRMDirect();
                return;
            }
            
            // Try to load VRM from correct Electron path
            const vrmPath = '../../assets/dog.vrm';
            
            try {
                console.log(`Loading VRM from: ${vrmPath}`);
                
                // If we have THREE.js, try normal VRM loading
                if (THREE.GLTFLoader) {
                    await this.loadVRMFromPath(vrmPath);
                    console.log(`VRM loaded successfully from: ${vrmPath}`);
                } else {
                    console.log('No GLTFLoader, trying direct VRM load');
                    await this.loadVRMDirect();
                }
            } catch (error) {
                console.warn(`Failed to load VRM from ${vrmPath}:`, error);
                console.log('Trying direct VRM load as fallback');
                await this.loadVRMDirect();
            }
            
        } catch (error) {
            console.error('Error loading VRM:', error);
            this.createPlaceholder();
        }
    }
    
    async loadVRMDirect() {
        try {
            console.log('Attempting direct VRM load...');
            const vrmPath = '../../assets/dog.vrm';
            
            // Fetch the VRM file
            const response = await fetch(vrmPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            console.log(`Dog.vrm loaded! Size: ${arrayBuffer.byteLength} bytes`);
            
            // For now, just show success and use placeholder with "VRM Loaded" status
            if (typeof THREE !== 'undefined') {
                this.createPlaceholder();
                // Update status to show VRM is loaded
                const statusElement = document.querySelector('.character-status');
                if (statusElement) {
                    statusElement.textContent = 'VRM File Loaded!';
                    statusElement.style.color = '#4CAF50';
                }
            } else {
                // Use CSS character but indicate VRM is loaded
                this.useFallbackMode();
                const statusElement = document.querySelector('.character-status');
                if (statusElement) {
                    statusElement.textContent = 'VRM File Loaded!';
                    statusElement.style.color = '#4CAF50';
                }
            }
            
            console.log('✅ Dog.vrm successfully loaded and ready!');
            
        } catch (error) {
            console.error('Failed to load dog.vrm directly:', error);
            if (typeof THREE !== 'undefined') {
                this.createPlaceholder();
            } else {
                this.useFallbackMode();
            }
        }
    }
    
    async loadVRMFromPath(path) {
        return new Promise((resolve, reject) => {
            // Import GLTFLoader from Three.js
            if (!THREE.GLTFLoader) {
                reject(new Error('GLTFLoader not available in THREE.js'));
                return;
            }
            
            const loader = new THREE.GLTFLoader();
            
            // Try to register VRM loader plugin
            try {
                // Check for VRM loader in various global locations
                let VRMLoaderPlugin = null;
                
                if (window.VRMLoaderPlugin) {
                    VRMLoaderPlugin = window.VRMLoaderPlugin;
                } else if (window.THREE_VRM && window.THREE_VRM.VRMLoaderPlugin) {
                    VRMLoaderPlugin = window.THREE_VRM.VRMLoaderPlugin;
                } else if (window.VRM && window.VRM.VRMLoaderPlugin) {
                    VRMLoaderPlugin = window.VRM.VRMLoaderPlugin;
                }
                
                if (VRMLoaderPlugin) {
                    console.log('Registering VRM Loader Plugin');
                    loader.register((parser) => new VRMLoaderPlugin(parser));
                } else {
                    console.warn('VRM Loader Plugin not found - will try to load as regular GLTF');
                }
            } catch (error) {
                console.warn('Failed to register VRM loader plugin:', error);
            }
            
            loader.load(
                path,
                (gltf) => {
                    console.log('GLTF loaded successfully, checking for VRM data...');
                    
                    // For VRM v2.x, VRM data should be in gltf.userData.vrm
                    let vrm = null;
                    if (gltf.userData && gltf.userData.vrm) {
                        vrm = gltf.userData.vrm;
                        console.log('Found VRM data in userData.vrm');
                    }
                    
                    if (vrm) {
                        // VRM loaded successfully
                        this.vrm = vrm;
                        
                        // Disable frustum culling for VRM
                        vrm.scene.traverse((obj) => {
                            obj.frustumCulled = false;
                        });
                        
                        // Position and scale the VRM
                        vrm.scene.position.set(0, 0, 0);
                        
                        // Auto-scale to fit in view
                        const box = new THREE.Box3().setFromObject(vrm.scene);
                        const size = box.getSize(new THREE.Vector3());
                        const maxSize = Math.max(size.x, size.y, size.z);
                        const scale = 1.5 / maxSize; // Slightly larger than before
                        vrm.scene.scale.setScalar(scale);
                        
                        // Center the model
                        const center = box.getCenter(new THREE.Vector3());
                        vrm.scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
                        
                        // Add to scene
                        this.scene.add(vrm.scene);
                        
                        console.log('VRM character loaded and configured successfully');
                        resolve(vrm);
                    } else {
                        // No VRM data found, try to use as regular GLTF
                        console.log('No VRM data found, using as regular GLTF model');
                        const model = gltf.scene;
                        
                        if (model) {
                            // Configure as regular 3D model
                            model.position.set(0, 0, 0);
                            
                            const box = new THREE.Box3().setFromObject(model);
                            const size = box.getSize(new THREE.Vector3());
                            const maxSize = Math.max(size.x, size.y, size.z);
                            const scale = 1.5 / maxSize;
                            model.scale.setScalar(scale);
                            
                            const center = box.getCenter(new THREE.Vector3());
                            model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
                            
                            this.scene.add(model);
                            this.vrmModel = model; // Store as regular model
                            
                            console.log('GLTF model loaded as fallback');
                            resolve(model);
                        } else {
                            reject(new Error('No scene found in loaded file'));
                        }
                    }
                },
                (progress) => {
                    if (progress.total > 0) {
                        const percent = (progress.loaded / progress.total) * 100;
                        this.updateLoadingProgress(percent);
                        console.log(`Loading progress: ${Math.round(percent)}%`);
                    }
                },
                (error) => {
                    console.error('Failed to load file:', error);
                    reject(new Error(`Failed to load VRM file: ${error.message}`));
                }
            );
        });
    }
    
    setupVRMAnimations() {
        if (!this.vrm) return;
        
        // Setup animation mixer if needed
        if (this.vrm.scene) {
            this.mixer = new THREE.AnimationMixer(this.vrm.scene);
        }
    }
    
    createPlaceholder() {
        // Create a simple placeholder character using basic geometries
        const group = new THREE.Group();
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.15, 32, 32);
        const headMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffdbac,
            transparent: true,
            opacity: 0.9
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, 1.6, 0);
        head.castShadow = true;
        group.add(head);
        
        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 32);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x4169e1,
            transparent: true,
            opacity: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.set(0, 1, 0);
        body.castShadow = true;
        group.add(body);
        
        this.scene.add(group);
        this.placeholderGroup = group;
        
        console.log('Three.js placeholder character created');
    }
    
    setAnimationState(state) {
        this.currentState = state;
        
        if (this.fallbackMode && this.characterElement) {
            // Remove all animation classes
            this.characterElement.className = 'dog-character';
            
            // Add appropriate class
            if (state !== this.animationStates.idle) {
                this.characterElement.classList.add(state);
            }
        }
        
        // Update character status
        this.updateCharacterStatus(state);
    }
    
    updateCharacterStatus(state) {
        const statusElement = document.querySelector('.character-status');
        if (statusElement) {
            const statusMap = {
                [this.animationStates.idle]: 'Ready',
                [this.animationStates.talking]: 'Talking',
                [this.animationStates.thinking]: 'Thinking',
                [this.animationStates.happy]: 'Happy',
                [this.animationStates.moving]: 'Moving'
            };
            statusElement.textContent = statusMap[state] || 'Ready';
        }
    }
    
    onMovementUpdate(direction) {
        this.setAnimationState(this.animationStates.moving);
        
        // Reset to idle after a delay
        clearTimeout(this.movementTimeout);
        this.movementTimeout = setTimeout(() => {
            this.setAnimationState(this.animationStates.idle);
        }, 1000);
    }
    
    onChatStart() {
        this.setAnimationState(this.animationStates.thinking);
    }
    
    onChatResponse() {
        this.setAnimationState(this.animationStates.talking);
        
        // Return to idle after talking
        setTimeout(() => {
            this.setAnimationState(this.animationStates.idle);
        }, 2000);
    }
    
    onWindowResize() {
        if (this.fallbackMode) return;
        
        if (!this.camera || !this.renderer || !this.canvas) return;
        
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    
    animate() {
        if (this.fallbackMode) return;
        
        if (!this.renderer || !this.scene || !this.camera) return;
        
        requestAnimationFrame(this.animate);
        
        const deltaTime = 0.016; // roughly 60fps
        
        // Update VRM if present
        if (this.vrm) {
            this.vrm.update(deltaTime);
        }
        
        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }
        
        // Simple rotation animation for placeholder
        if (this.placeholderGroup) {
            const time = Date.now() * 0.001;
            this.placeholderGroup.position.y = Math.sin(time * 2) * 0.1;
            this.placeholderGroup.rotation.y = Math.sin(time * 0.5) * 0.1;
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
    
    // UI Helper Methods
    hideLoading() {
        // No loading elements to hide
    }
    
    updateLoadingProgress(percent) {
        // No progress to update
    }
    
    dispose() {
        // Clean up resources
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.characterElement) {
            this.characterElement.remove();
        }
        
        window.removeEventListener('resize', this.onWindowResize);
        clearTimeout(this.movementTimeout);
    }
}

// Export for use in other modules
window.VRMRenderer = VRMRenderer;
