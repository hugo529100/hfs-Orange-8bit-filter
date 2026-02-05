'use strict';

(function() {
    const STORAGE_KEY = 'hfs_orange_filter';
    const FILTER_SELECT_ID = 'orange-filter-select';
    const EFFECT_SELECT_ID = 'orange-effect-select';
    const COLOR_SELECT_ID = 'orange-color-select';
    const SCOPE_SELECT_ID = 'orange-scope-select';
    
    const LEVELS = {
        0: [], // Off
        4:  [0.08, .33, .66, .92],
        8:  [0.06, .14, .28, .42, .56, .7, .85, .92],
        12: [0.06, .09, .18, .27, .36, .45, .55, .65, .75, .85, .90, .92],
        16: Array.from({length: 16}, (_, i) => +(i/15).toFixed(3))
    }

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

    const PIXELATION_CONFIGS = {
        0: { size: 1, name: 'None' },
        1: { size: 4, name: 'CRT Scanlines' },
        2: { size: 8, name: '45° Diagonal Grid' },
        3: { size: 12, name: 'Square Dot Grid' },
        4: { size: 16, name: 'Pixelation (Block)' },
        5: { size: 12, name: 'Pixel+45° Grid' }
    };

    const isLocalStorageSupported = () => {
        try {
            localStorage.setItem('test', '1');
            localStorage.removeItem('test');
            return true;
        } catch (e) {
            return false;
        }
    };

    const getStoredConfig = () => {
        const defaultConfig = {
            level: 4,
            effect: 0,
            color: 'orange',
            scope: 1
        };
        
        if (!isLocalStorageSupported()) return defaultConfig;
        
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // 確保舊配置兼容新格式
                if (parsed.scope === undefined) {
                    parsed.scope = parsed.level === 0 ? 0 : 1;
                }
                return parsed;
            }
            return defaultConfig;
        } catch (e) {
            return defaultConfig;
        }
    };

    const saveConfig = (config) => {
        if (isLocalStorageSupported()) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        }
    };

    function buildFilter(levels, effect, color) {
        if (levels === 0) return '';
        
        let l = LEVELS[levels];
        const colorConfig = COLORS[color] || COLORS.orange;
        
        let g, b;
        
        if (color === 'black-white') {
            g = l.map(v => +v.toFixed(3));
            b = l.map(v => +v.toFixed(3));
        } else {
            g = l.map(v => +(v * colorConfig.gRatio).toFixed(3));
            b = l.map(v => +(v * colorConfig.bRatio).toFixed(3));
            l = l.map(v => +(v * colorConfig.rBase).toFixed(3));
        }
        
        let pixelationEffect = '';
        let inputSource = 'SourceGraphic';
        
        if (effect === 4) {
            pixelationEffect = `
                <feMorphology operator="erode" radius="${PIXELATION_CONFIGS[4].size/20}" in="SourceGraphic" result="eroded"/>
                <feMorphology operator="dilate" radius="${PIXELATION_CONFIGS[4].size/20}" in="eroded" result="pixelated"/>
            `;
            inputSource = 'pixelated';
        } else if (effect === 5) {
            const pixelSize = PIXELATION_CONFIGS[5].size;
            pixelationEffect = `
                <feMorphology operator="erode" radius="${pixelSize/18}" in="SourceGraphic" result="eroded"/>
                <feMorphology operator="dilate" radius="${pixelSize/18}" in="eroded" result="pixelated"/>
            `;
            inputSource = 'pixelated';
        }
        
        return `
        <filter id="orange8bit" color-interpolation-filters="sRGB">
            ${pixelationEffect}
            <feColorMatrix type="saturate" values="0" in="${inputSource}" result="mono"/>
            <feComponentTransfer in="mono">
                <feFuncR type="discrete" tableValues="${l.join(' ')}"/>
                <feFuncG type="discrete" tableValues="${g.join(' ')}"/>
                <feFuncB type="discrete" tableValues="${b.join(' ')}"/>
            </feComponentTransfer>
            <feColorMatrix type="matrix" values="
                ${colorConfig.r.toFixed(2)} 0    0    0 0
                0    ${colorConfig.g.toFixed(2)} 0    0 0
                0    0    ${colorConfig.b.toFixed(2)} 0 0
                0    0    0    1 0
            "/>
        </filter>`;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'orange-filter-svg';
    svg.style.position = 'absolute';
    svg.style.width = svg.style.height = '0';
    svg.style.pointerEvents = 'none';
    document.body.appendChild(svg);

    let currentConfig = getStoredConfig();

    function applyConfig(config, updateUI = true) {
        // 保存當前配置
        currentConfig = {...config};
        
        // 如果 scope 為 0，關閉所有效果
        if (config.scope === 0) {
            svg.innerHTML = '';
            document.documentElement.removeAttribute('data-orange-filter');
            document.documentElement.removeAttribute('data-scanlines-effect');
            document.documentElement.removeAttribute('data-grid-effect');
            document.documentElement.removeAttribute('data-dotgrid-effect');
            document.documentElement.removeAttribute('data-pixelation-effect');
            document.documentElement.removeAttribute('data-pixel-diag-grid-effect');
            document.documentElement.removeAttribute('data-color-filter');
            document.documentElement.removeAttribute('data-filter-scope');
        } else {
            // 只有在 scope 不為 0 時才應用 filter
            svg.innerHTML = buildFilter(config.level, config.effect, config.color);
            document.documentElement.setAttribute('data-orange-filter', 'true');
            document.documentElement.setAttribute('data-color-filter', config.color);
            document.documentElement.setAttribute('data-filter-scope', config.scope.toString());
            
            // 清除所有效果屬性
            document.documentElement.removeAttribute('data-scanlines-effect');
            document.documentElement.removeAttribute('data-grid-effect');
            document.documentElement.removeAttribute('data-dotgrid-effect');
            document.documentElement.removeAttribute('data-pixelation-effect');
            document.documentElement.removeAttribute('data-pixel-diag-grid-effect');
            
            // 設置選擇的效果
            if (config.effect === 1) {
                document.documentElement.setAttribute('data-scanlines-effect', 'true');
            } else if (config.effect === 2) {
                document.documentElement.setAttribute('data-grid-effect', 'true');
            } else if (config.effect === 3) {
                document.documentElement.setAttribute('data-dotgrid-effect', 'true');
            } else if (config.effect === 4) {
                document.documentElement.setAttribute('data-pixelation-effect', 'true');
            } else if (config.effect === 5) {
                document.documentElement.setAttribute('data-pixel-diag-grid-effect', 'true');
            }
        }
        
        saveConfig(config);
        
        // 如果需要，更新UI
        if (updateUI) {
            updateUIFromConfig(config);
        }
    }

    function updateUIFromConfig(config) {
        const filterSelect = document.getElementById(FILTER_SELECT_ID);
        const colorSelect = document.getElementById(COLOR_SELECT_ID);
        const effectSelect = document.getElementById(EFFECT_SELECT_ID);
        const scopeSelect = document.getElementById(SCOPE_SELECT_ID);
        
        if (filterSelect && colorSelect && effectSelect && scopeSelect) {
            // 先設置所有值
            scopeSelect.value = config.scope.toString();
            colorSelect.value = config.color;
            
            // 根據 scope 設置其他控件
            if (config.scope === 0) {
                // Filter Off 時，禁用其他控件
                filterSelect.disabled = true;
                effectSelect.disabled = true;
                // 但仍然顯示存儲的值
                filterSelect.value = config.level.toString();
                effectSelect.value = config.effect.toString();
            } else {
                // Filter On 時，啟用其他控件
                filterSelect.disabled = false;
                effectSelect.disabled = false;
                filterSelect.value = config.level.toString();
                effectSelect.value = config.effect.toString();
            }
        }
    }

    function insertControls() {
        const optionsDialog = document.querySelector('.dialog[aria-modal="true"]');
        if (!optionsDialog || document.getElementById(FILTER_SELECT_ID)) return;

        const themeSelect = document.getElementById('option-theme');
        if (!themeSelect) return;

        const controlsHTML = `
            <div style="margin-bottom: 0.8em;">
                <label style="display: block; margin-bottom: 0.2em; font-weight: 500;">Filter Scope:</label>
                <select id="${SCOPE_SELECT_ID}" style="width: 100%; padding: 0.4em;">
                    <option value="0">Filter Off (All Effects)</option>
                    <option value="1">Interface Colors Only</option>
                    <option value="2">Interface + Images</option>
                    <option value="3">Full Range (Including Videos)</option>
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
                <label style="display: block; margin-bottom: 0.2em; font-weight: 500;">Color Levels:</label>
                <select id="${FILTER_SELECT_ID}" style="width: 100%; padding: 0.4em;">
                    <option value="4">4 levels (Minimal)</option>
                    <option value="8">8 levels (Retro)</option>
                    <option value="12">12 levels (Industrial)</option>
                    <option value="16">16 levels (Smoother)</option>
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

        themeSelect.insertAdjacentHTML('afterend', controlsHTML);

        const filterSelect = document.getElementById(FILTER_SELECT_ID);
        const colorSelect = document.getElementById(COLOR_SELECT_ID);
        const effectSelect = document.getElementById(EFFECT_SELECT_ID);
        const scopeSelect = document.getElementById(SCOPE_SELECT_ID);

        // 初始設置UI狀態 - 使用currentConfig而不是重新讀取
        updateUIFromConfig(currentConfig);

        // 事件監聽器 - 使用正確的邏輯
        scopeSelect.addEventListener('change', function() {
            const scopeValue = parseInt(this.value);
            
            // 更新當前配置
            currentConfig.scope = scopeValue;
            
            if (scopeValue === 0) {
                // Filter Off: 禁用其他控件，但保持內部配置值
                filterSelect.disabled = true;
                effectSelect.disabled = true;
                // 注意：這裡不修改level和effect的值，只保存當前的
            } else {
                // Filter On: 啟用其他控件
                filterSelect.disabled = false;
                effectSelect.disabled = false;
                
                // 如果之前是Filter Off狀態，使用默認值
                if (currentConfig.level === 0) {
                    currentConfig.level = 4;
                    filterSelect.value = "4";
                }
                if (currentConfig.effect === undefined) {
                    currentConfig.effect = 0;
                    effectSelect.value = "0";
                }
            }
            
            // 應用配置（不更新UI，避免循環）
            applyConfig(currentConfig, false);
        });

        colorSelect.addEventListener('change', function() {
            currentConfig.color = this.value;
            if (currentConfig.scope !== 0) {
                applyConfig(currentConfig, false);
            }
        });

        filterSelect.addEventListener('change', function() {
            if (!filterSelect.disabled) {
                currentConfig.level = parseInt(this.value);
                if (currentConfig.scope !== 0) {
                    applyConfig(currentConfig, false);
                }
            }
        });

        effectSelect.addEventListener('change', function() {
            if (!effectSelect.disabled) {
                currentConfig.effect = parseInt(this.value);
                if (currentConfig.scope !== 0) {
                    applyConfig(currentConfig, false);
                }
            }
        });
    }

    function init() {
        // 立即應用初始配置
        applyConfig(currentConfig, false);
        
        // 觀察Options對話框
        const observer = new MutationObserver(() => {
            if (document.querySelector('.dialog-title')?.textContent.includes('Options')) {
                setTimeout(() => {
                    insertControls();
                }, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();