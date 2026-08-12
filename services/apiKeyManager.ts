import { AiProvider } from '../constants';

/**
 * API Key Manager - Quản lý nhiều API key với cơ chế xoay vòng
 */

export const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIzaSy|AQ)\S{8,}$/;

// Trạng thái của một API key
export type ApiKeyStatus = 'active' | 'error' | 'cooldown';

// Thông tin một API key
export interface ApiKeyInfo {
    key: string;
    name: string;
    status: ApiKeyStatus;
    lastError?: string;
    errorCount: number;
    cooldownUntil?: number; // Timestamp khi hết cooldown
    addedAt: number;
}

// Kết quả khi xoay key
export interface ApiKeyRotationResult {
    success: boolean;
    hasMoreKeys: boolean;
    newKey?: string;
    message: string;
}

// Callback khi có sự kiện
export type KeyRotationCallback = (info: { fromKey: string; toKey: string; reason: string }) => void;
export type AllKeysFailedCallback = () => void;

const GEMINI_STORAGE_KEY = 'gemini_api_keys';
const AGENT_PLATFORM_STORAGE_KEY = 'agent_platform_api_keys';
const MAX_KEYS = 16;
const COOLDOWN_DURATION = 5 * 60 * 1000;
const MAX_ERROR_COUNT = 1;

// Đọc danh sách API key từ biến môi trường (.env)
const getEnvKeys = (): { key: string; name: string }[] => {
    const envKeys = import.meta.env.VITE_GEMINI_API_KEYS || '';
    if (!envKeys) return [];
    return envKeys
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0)
        .map((k: string, i: number) => ({ key: k, name: `Key ${i + 1}` }));
};

const BACKUP_API_KEYS = getEnvKeys();

class ApiKeyManager {
    private keys: ApiKeyInfo[] = [];
    private currentIndex: number = 0;
    private onKeyRotation?: KeyRotationCallback;
    private onAllKeysFailed?: AllKeysFailedCallback;

    constructor() {
        this.loadFromStorage();
    }

    getProvider(): AiProvider {
        const stored = localStorage.getItem('google_ai_provider') as AiProvider;
        if (stored === 'agent-platform' || stored === 'gemini') {
            return stored;
        }
        return 'gemini';
    }

    setProvider(provider: AiProvider): void {
        localStorage.setItem('google_ai_provider', provider);
        localStorage.setItem('google_ai_provider_selection_source', 'manual');
    }

    setOnKeyRotation(callback: KeyRotationCallback) {
        this.onKeyRotation = callback;
    }

    setOnAllKeysFailed(callback: AllKeysFailedCallback) {
        this.onAllKeysFailed = callback;
    }

    loadFromStorage(provider?: AiProvider): void {
        const activeProvider = provider || this.getProvider();
        const storageKey = activeProvider === 'agent-platform' ? AGENT_PLATFORM_STORAGE_KEY : GEMINI_STORAGE_KEY;
        const singleKeyStorageName = activeProvider === 'agent-platform' ? 'agent_platform_api_key' : 'gemini_api_key';

        try {
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                this.keys = data.keys || [];
                this.currentIndex = data.currentIndex || 0;
                this.checkAndResetCooldowns();
            } else {
                this.keys = [];
                this.currentIndex = 0;
            }

            const oldKey = localStorage.getItem(singleKeyStorageName);
            if (oldKey && this.keys.length === 0) {
                this.addKey(oldKey, 'Key mặc định', activeProvider);
            }

            if (activeProvider === 'gemini') {
                this.injectBackupKeys();
            }
        } catch (e) {
            console.error(`Lỗi load API keys cho ${activeProvider}:`, e);
            this.keys = [];
            this.currentIndex = 0;
            if (activeProvider === 'gemini') {
                this.injectBackupKeys();
            }
        }
    }

    private injectBackupKeys(): void {
        let added = 0;
        for (const backup of BACKUP_API_KEYS) {
            if (!this.keys.some(k => k.key === backup.key)) {
                if (this.keys.length < MAX_KEYS) {
                    this.keys.push({
                        key: backup.key,
                        name: backup.name,
                        status: 'active',
                        errorCount: 0,
                        addedAt: Date.now(),
                    });
                    added++;
                }
            }
        }
        if (added > 0) {
            this.saveToStorage('gemini');
        }
    }

    saveToStorage(provider?: AiProvider): void {
        const activeProvider = provider || this.getProvider();
        const storageKey = activeProvider === 'agent-platform' ? AGENT_PLATFORM_STORAGE_KEY : GEMINI_STORAGE_KEY;
        const singleKeyStorageName = activeProvider === 'agent-platform' ? 'agent_platform_api_key' : 'gemini_api_key';

        try {
            const data = {
                keys: this.keys,
                currentIndex: this.currentIndex
            };
            localStorage.setItem(storageKey, JSON.stringify(data));

            const activeKey = this.getActiveKey(activeProvider);
            if (activeKey) {
                localStorage.setItem(singleKeyStorageName, activeKey);
            }
        } catch (e) {
            console.error(`Lỗi lưu API keys cho ${activeProvider}:`, e);
        }
    }

    private checkAndResetCooldowns(): void {
        const now = Date.now();
        let hasChanges = false;

        this.keys.forEach(keyInfo => {
            if (keyInfo.status === 'cooldown' && keyInfo.cooldownUntil && keyInfo.cooldownUntil <= now) {
                keyInfo.status = 'active';
                keyInfo.errorCount = 0;
                keyInfo.cooldownUntil = undefined;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            this.saveToStorage();
        }
    }

    addKey(key: string, name?: string, provider?: AiProvider): { success: boolean; message: string } {
        const activeProvider = provider || this.getProvider();
        if (this.keys.length >= MAX_KEYS) {
            return { success: false, message: `Đã đạt giới hạn ${MAX_KEYS} key` };
        }

        const trimmedKey = key.trim();
        if (this.keys.some(k => k.key === trimmedKey)) {
            return { success: false, message: 'Key này đã tồn tại' };
        }

        if (!GOOGLE_AI_API_KEY_PATTERN.test(trimmedKey)) {
            return { success: false, message: 'Key không đúng định dạng (bắt đầu bằng AIzaSy hoặc AQ)' };
        }

        const newKey: ApiKeyInfo = {
            key: trimmedKey,
            name: name?.trim() || `Key ${this.keys.length + 1}`,
            status: 'active',
            errorCount: 0,
            addedAt: Date.now()
        };

        this.keys.push(newKey);
        this.saveToStorage(activeProvider);

        return { success: true, message: 'Đã thêm key thành công' };
    }

    removeKey(key: string): { success: boolean; message: string } {
        const index = this.keys.findIndex(k => k.key === key);
        if (index === -1) {
            return { success: false, message: 'Không tìm thấy key' };
        }

        if (index === this.currentIndex) {
            if (this.keys.length > 1) {
                this.currentIndex = (this.currentIndex + 1) % (this.keys.length - 1);
            } else {
                this.currentIndex = 0;
            }
        } else if (index < this.currentIndex) {
            this.currentIndex--;
        }

        this.keys.splice(index, 1);
        this.saveToStorage();

        return { success: true, message: 'Đã xóa key' };
    }

    getActiveKey(provider?: AiProvider): string | null {
        const activeProvider = provider || this.getProvider();
        const singleKeyStorageName = activeProvider === 'agent-platform' ? 'agent_platform_api_key' : 'gemini_api_key';
        
        // 1. Kiểm tra trực tiếp trong localStorage key đơn lẻ
        const directKey = localStorage.getItem(singleKeyStorageName);
        if (directKey && GOOGLE_AI_API_KEY_PATTERN.test(directKey.trim())) {
            return directKey.trim();
        }

        // 2. Nếu không có key đơn lẻ, lấy từ mảng danh sách keys
        this.loadFromStorage(activeProvider);
        if (this.keys.length === 0) {
            return null;
        }

        for (let i = 0; i < this.keys.length; i++) {
            const idx = (this.currentIndex + i) % this.keys.length;
            const keyInfo = this.keys[idx];
            if (keyInfo.status === 'active') {
                this.currentIndex = idx;
                return keyInfo.key;
            }
        }

        return null;
    }

    markKeyError(key: string, errorType: string): ApiKeyRotationResult {
        const keyInfo = this.keys.find(k => k.key === key);
        if (!keyInfo) {
            return { success: false, hasMoreKeys: false, message: 'Không tìm thấy key' };
        }

        keyInfo.lastError = errorType;
        keyInfo.errorCount++;

        if (errorType === 'QUOTA_EXCEEDED' || errorType === 'RATE_LIMIT') {
            keyInfo.status = 'cooldown';
            keyInfo.cooldownUntil = Date.now() + COOLDOWN_DURATION;
        } else if (errorType === 'INVALID_API_KEY') {
            keyInfo.status = 'error';
        } else if (keyInfo.errorCount >= MAX_ERROR_COUNT) {
            keyInfo.status = 'cooldown';
            keyInfo.cooldownUntil = Date.now() + COOLDOWN_DURATION;
        }

        this.saveToStorage();
        return this.rotateToNextKey(errorType);
    }

    rotateToNextKey(reason: string = 'manual'): ApiKeyRotationResult {
        this.checkAndResetCooldowns();
        const fromKey = this.keys[this.currentIndex]?.key;

        for (let i = 1; i <= this.keys.length; i++) {
            const nextIndex = (this.currentIndex + i) % this.keys.length;
            const nextKey = this.keys[nextIndex];

            if (nextKey.status === 'active') {
                this.currentIndex = nextIndex;
                this.saveToStorage();

                if (this.onKeyRotation && fromKey) {
                    this.onKeyRotation({
                        fromKey: this.maskKey(fromKey),
                        toKey: this.maskKey(nextKey.key),
                        reason
                    });
                }

                return {
                    success: true,
                    hasMoreKeys: true,
                    newKey: nextKey.key,
                    message: `Đã chuyển sang key: ${nextKey.name}`
                };
            }
        }

        if (this.onAllKeysFailed) {
            this.onAllKeysFailed();
        }

        return {
            success: false,
            hasMoreKeys: false,
            message: 'Tất cả API key đều không khả dụng'
        };
    }

    getAllKeys(): ApiKeyInfo[] {
        this.checkAndResetCooldowns();
        return [...this.keys];
    }

    getKeyStats(): { total: number; active: number; error: number; cooldown: number } {
        this.checkAndResetCooldowns();
        return {
            total: this.keys.length,
            active: this.keys.filter(k => k.status === 'active').length,
            error: this.keys.filter(k => k.status === 'error').length,
            cooldown: this.keys.filter(k => k.status === 'cooldown').length
        };
    }

    resetKey(key: string): { success: boolean; message: string } {
        const keyInfo = this.keys.find(k => k.key === key);
        if (!keyInfo) {
            return { success: false, message: 'Không tìm thấy key' };
        }

        keyInfo.status = 'active';
        keyInfo.errorCount = 0;
        keyInfo.cooldownUntil = undefined;
        keyInfo.lastError = undefined;

        this.saveToStorage();
        return { success: true, message: 'Đã kích hoạt lại key' };
    }

    updateKeyName(key: string, newName: string): { success: boolean; message: string } {
        const keyInfo = this.keys.find(k => k.key === key);
        if (!keyInfo) {
            return { success: false, message: 'Không tìm thấy key' };
        }

        keyInfo.name = newName.trim() || keyInfo.name;
        this.saveToStorage();
        return { success: true, message: 'Đã cập nhật tên key' };
    }

    maskKey(key: string): string {
        if (!key || key.length < 8) return '***';
        return key.substring(0, 4) + '...' + key.substring(key.length - 4);
    }

    hasAvailableKeys(): boolean {
        this.checkAndResetCooldowns();
        return this.keys.some(k => k.status === 'active');
    }

    getCurrentIndex(): number {
        return this.currentIndex;
    }

    setActiveKey(keyOrIndex: string | number): { success: boolean; message: string } {
        let index: number;

        if (typeof keyOrIndex === 'number') {
            index = keyOrIndex;
        } else {
            index = this.keys.findIndex(k => k.key === keyOrIndex);
        }

        if (index < 0 || index >= this.keys.length) {
            return { success: false, message: 'Key không tồn tại' };
        }

        const keyInfo = this.keys[index];
        if (keyInfo.status !== 'active') {
            keyInfo.status = 'active';
            keyInfo.errorCount = 0;
            keyInfo.cooldownUntil = undefined;
            keyInfo.lastError = undefined;
        }

        this.currentIndex = index;
        this.saveToStorage();
        return { success: true, message: `Đã chuyển sang key: ${keyInfo.name}` };
    }

    resetAllKeys(): { success: boolean; message: string } {
        let resetCount = 0;
        this.keys.forEach(keyInfo => {
            if (keyInfo.status !== 'active') {
                keyInfo.status = 'active';
                keyInfo.errorCount = 0;
                keyInfo.cooldownUntil = undefined;
                keyInfo.lastError = undefined;
                resetCount++;
            }
        });

        this.saveToStorage();
        return { success: true, message: `Đã reset ${resetCount} key` };
    }

    getNextAvailableKey(): string | null {
        this.checkAndResetCooldowns();

        for (let i = 1; i <= this.keys.length; i++) {
            const nextIndex = (this.currentIndex + i) % this.keys.length;
            const nextKey = this.keys[nextIndex];
            if (nextKey.status === 'active') {
                return nextKey.key;
            }
        }
        return null;
    }
}

export const apiKeyManager = new ApiKeyManager();
