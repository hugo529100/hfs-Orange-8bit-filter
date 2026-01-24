'use strict';

(function() {
    const STORAGE_KEY = 'hfs_orange_filter';
    const FILTER_SELECT_ID = 'orange-filter-select';
    const EFFECT_SELECT_ID = 'orange-effect-select';
    const COLOR_SELECT_ID = 'orange-color-select';
    
    const LEVELS = {
        0: [], // Off
        4:  [0.08, .33, .66, .92], // 4-bit
        8:  [0.06, .14, .28, .42, .56, .7, .85, .92],
        12: [0.06, .09, .18, .27, .36, .45, .55, .65, .75, .85, .90, .92],
        16: Array.from({length: 16}, (_, i) => +(i/15).toFixed(3))
    }

    // Color configurations
    const COLORS = {
        'orange': { 
            r: 1.30, g: 1.00, b: 0.00,
            rBase: 1.0, gRatio: 0.7576, bRatio: 0.0909
        },      
        'yellow-green': { 
            r: 0.92, g: 0.90, b: 0.00,
            rBase: 0.98, gRatio: 1.0102, bRatio: 0.00
        },
        'blue-green': { 
            r: 0.00, g: 1.00, b: 0.75,
            rBase: 0.80, gRatio: 1.10, bRatio: 1.20
        },
        'pure-red': { 
            r: 1.40, g: 0.60, b: 0.20,
            rBase: 0.8, gRatio: 0.15, bRatio: 0.05
        },
        'black-white': { 
            r: 1.0, g: 1.0, b: 1.0,
            rBase: 1.0, gRatio: 1.0, bRatio: 1.0
        }      
    };

    // Pixelation configurations
    const PIXELATION_CONFIGS = {
        0: { size: 1, name: 'None' },
        1: { size: 4, name: 'CRT Scanlines' },
        2: { size: 8, name: '45° Diagonal Grid' },
        3: { size: 12, name: 'Square Dot Grid' },
        4: { size: 16, name: 'Pixelation (Block)' },
        5: { size: 12, name: 'Pixel+45° Grid' }  // 橫向像素 + 45°網格
    };

    // Check if localStorage is supported
    const isLocalStorageSupported = () => {
        try {
            localStorage.setItem('test', '1');
            localStorage.removeItem('test');
            return true;
        } catch (e) {
            return false;
        }
    };

    // Get stored configuration
    const getStoredConfig = () => {
        const defaultConfig = {
            level: 0,     // 0=off, 4, 8, 12, 16
            effect: 0,    // 0=off, 1=scanlines, 2=45° grid, 3=dot grid, 4=pixelation, 5=pixel+45° grid
            color: 'orange' // default orange
        };
        
        if (!isLocalStorageSupported()) return defaultConfig;
        
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : defaultConfig;
        } catch (e) {
            return defaultConfig;
        }
    };

    // Save configuration
    const saveConfig = (config) => {
        if (isLocalStorageSupported()) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        }
    };

    // Build SVG filter with pixelation effect
    function buildFilter(levels, effect, color) {
        if (levels === 0) return ''; // Turn off filter
        
        let l = LEVELS[levels];
        const colorConfig = COLORS[color] || COLORS.orange;
        
        // Calculate G and B channel values based on selected color
        let g, b;
        
        if (color === 'black-white') {
            // Black & White: all channels use same grayscale values
            g = l.map(v => +v.toFixed(3));
            b = l.map(v => +v.toFixed(3));
        } else {
            // Other colors: use corrected ratios
            g = l.map(v => +(v * colorConfig.gRatio).toFixed(3));
            b = l.map(v => +(v * colorConfig.bRatio).toFixed(3));
            
            // Adjust R channel
            l = l.map(v => +(v * colorConfig.rBase).toFixed(3));
        }
        
        // Add pixelation effect if selected (effect 4 or 5)
        let pixelationEffect = '';
        let inputSource = 'SourceGraphic';
        
        if (effect === 4) {
            // 原有的塊狀像素化
            pixelationEffect = `
                <!-- Pixelation effect (Block style) -->
                <feMorphology operator="erode" radius="${PIXELATION_CONFIGS[4].size/20}" in="SourceGraphic" result="eroded"/>
                <feMorphology operator="dilate" radius="${PIXELATION_CONFIGS[4].size/20}" in="eroded" result="pixelated"/>
            `;
            inputSource = 'pixelated';
        } else if (effect === 5) {
            // 新的橫向像素化效果
            const pixelSize = PIXELATION_CONFIGS[5].size;
            pixelationEffect = `
                <!-- Horizontal Pixelation effect -->
                <feMorphology operator="erode" radius="${pixelSize/18}" in="SourceGraphic" result="eroded"/>
                <feMorphology operator="dilate" radius="${pixelSize/18}" in="eroded" result="pixelated"/>
            `;
            inputSource = 'pixelated';
        }
        
        return `
        <filter id="orange8bit" color-interpolation-filters="sRGB">
            ${pixelationEffect}
            
            <!-- 1 Remove color but keep original brightness -->
            <feColorMatrix type="saturate" values="0" in="${inputSource}" result="mono"/>
            
            <!-- 3 Quantize to selected color tones -->
            <feComponentTransfer in="mono">
                <!-- Keep original brightness, only change color distribution -->
                <feFuncR type="discrete" tableValues="${l.join(' ')}"/>
                <feFuncG type="discrete" tableValues="${g.join(' ')}"/>
                <feFuncB type="discrete" tableValues="${b.join(' ')}"/>
            </feComponentTransfer>

            <!-- 4 Apply color gain -->
            <feColorMatrix type="matrix" values="
                ${colorConfig.r.toFixed(2)} 0    0    0 0
                0    ${colorConfig.g.toFixed(2)} 0    0 0
                0    0    ${colorConfig.b.toFixed(2)} 0 0
                0    0    0    1 0
            "/>
        </filter>`;
    }

    // Create SVG container
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'orange-filter-svg';
    svg.style.position = 'absolute';
    svg.style.width = svg.style.height = '0';
    svg.style.pointerEvents = 'none';
    document.body.appendChild(svg);

    // Apply configuration
    function applyConfig(config) {
        // Update SVG filter
        if (config.level === 0) {
            svg.innerHTML = '';
            document.documentElement.removeAttribute('data-orange-filter');
            document.documentElement.removeAttribute('data-scanlines-effect');
            document.documentElement.removeAttribute('data-grid-effect');
            document.documentElement.removeAttribute('data-dotgrid-effect');
            document.documentElement.removeAttribute('data-pixelation-effect');
            document.documentElement.removeAttribute('data-pixel-diag-grid-effect'); // 新增属性
            document.documentElement.removeAttribute('data-color-filter');
        } else {
            // Always apply color filter (if level is not 0)
            svg.innerHTML = buildFilter(config.level, config.effect, config.color);
            document.documentElement.setAttribute('data-orange-filter', 'true');
            document.documentElement.setAttribute('data-color-filter', config.color);
            
            // Clear all effect attributes
            document.documentElement.removeAttribute('data-scanlines-effect');
            document.documentElement.removeAttribute('data-grid-effect');
            document.documentElement.removeAttribute('data-dotgrid-effect');
            document.documentElement.removeAttribute('data-pixelation-effect');
            document.documentElement.removeAttribute('data-pixel-diag-grid-effect');
            
            // Set the selected effect
            if (config.effect === 1) {
                document.documentElement.setAttribute('data-scanlines-effect', 'true');
            } else if (config.effect === 2) {
                document.documentElement.setAttribute('data-grid-effect', 'true');
            } else if (config.effect === 3) {
                document.documentElement.setAttribute('data-dotgrid-effect', 'true');
            } else if (config.effect === 4) {
                document.documentElement.setAttribute('data-pixelation-effect', 'true');
            } else if (config.effect === 5) {
                document.documentElement.setAttribute('data-pixel-diag-grid-effect', 'true'); // 新效果
            }
        }
        
        // Save configuration
        saveConfig(config);
    }

    // Insert controls in Options dialog (English interface)
    function insertControls() {
        const optionsDialog = document.querySelector('.dialog[aria-modal="true"]');
        if (!optionsDialog || document.getElementById(FILTER_SELECT_ID)) return;

        const themeSelect = document.getElementById('option-theme');
        if (!themeSelect) return;

        // Get current configuration
        const config = getStoredConfig();

        // Create controls HTML (English)
        const controlsHTML = `
            <div style="margin-bottom: 0.8em;">
                <label style="display: block; margin-bottom: 0.2em; font-weight: 500;">Color Levels:</label>
                <select id="${FILTER_SELECT_ID}" style="width: 100%; padding: 0.4em;">
                    <option value="0">Filter Off</option>
                    <option value="4">4 levels (Minimal)</option>
                    <option value="8">8 levels (Retro)</option>
                    <option value="12">12 levels (Industrial)</option>
                    <option value="16">16 levels (Smoother)</option>
                </select>
            </div>
            <div style="margin-bottom: 0.8em;">
                <label style="display: block; margin-bottom: 0.2em; font-weight: 500;">Color Tone:</label>
                <select id="${COLOR_SELECT_ID}" style="width: 100%; padding: 0.4em;">
                    <option value="orange">ANSI Safety Orange</option>
                    <option value="yellow-green">Luminescent Green</option>
                    <option value="blue-green">Bioluminescent Cyan</option>
                    <option value="pure-red">Night Vision Red</option>
                    <option value="black-white">B & W</option>
                </select>
            </div>
            <div style="margin-bottom: 0.8em;">
                <label style="display: block; margin-bottom: 0.2em; font-weight: 500;">Overlay Effects:</label>
                <select id="${EFFECT_SELECT_ID}" style="width: 100%; padding: 0.4em;">
                    <option value="0">None</option>
                    <option value="1">CRT Scanlines</option>
                    <option value="2">45° Diagonal Grid</option>
                    <option value="3">Square Dot Grid</option>
                    <option value="4">Pixelation (Block)</option>
                    <option value="5">Pixel + 45° Grid</option>
                </select>
            </div>
        `;

        // Insert after theme selector
        themeSelect.insertAdjacentHTML('afterend', controlsHTML);

        // Set initial values
        const filterSelect = document.getElementById(FILTER_SELECT_ID);
        const colorSelect = document.getElementById(COLOR_SELECT_ID);
        const effectSelect = document.getElementById(EFFECT_SELECT_ID);
        
        filterSelect.value = config.level.toString();
        colorSelect.value = config.color;
        effectSelect.value = config.effect.toString();

        // Add event listeners
        filterSelect.addEventListener('change', function() {
            const newConfig = getStoredConfig();
            newConfig.level = parseInt(this.value);
            applyConfig(newConfig);
        });

        colorSelect.addEventListener('change', function() {
            const newConfig = getStoredConfig();
            newConfig.color = this.value;
            applyConfig(newConfig);
        });

        effectSelect.addEventListener('change', function() {
            const newConfig = getStoredConfig();
            newConfig.effect = parseInt(this.value);
            applyConfig(newConfig);
        });
    }

    // Initialize
    function init() {
        // Observe for Options dialog appearance
        const observer = new MutationObserver(() => {
            if (document.querySelector('.dialog-title')?.textContent.includes('Options')) {
                setTimeout(insertControls, 100); // Delay to ensure DOM is ready
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Apply initial configuration
        applyConfig(getStoredConfig());
    }

    // Ensure DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();