import { AiProvider } from '../constants';

/**
 * API Key Manager - Quản lý nhiều API key với cơ chế xoay vòng.
 * Mỗi provider (Gemini / Agent Platform) có danh sách key riêng, không bao giờ trộn lẫn.
 */

export const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIza|AQ)[\w.\-]{20,}$/;

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
    source?: 'user' | 'env'; // key từ .env chỉ giữ trong bộ nhớ, không ghi xuống localStorage
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

interface ProviderKeyList {
    keys: ApiKeyInfo[];
    currentIndex: number;
}

const STORAGE_KEYS: Record<AiProvider, { list: string; single: string }> = {
    'gemini': { list: 'gemini_api_keys', single: 'gemini_api_key' },
    'agent-platform': { list: 'agent_platform_api_keys', single: 'agent_platform_api_key' },
};
const MAX_KEYS = 16;
const QUOTA_COOLDOWN = 10 * 60 * 1000;
const RATE_LIMIT_COOLDOWN = 60 * 1000;
const TRANSIENT_COOLDOWN = 2 * 60 * 1000;
// Lỗi tạm thời (mạng, 5xx) chỉ đưa key vào cooldown khi lặp lại nhiều lần liên tiếp
const MAX_TRANSIENT_ERRORS = 3;

// Đọc danh sách API key từ biến môi trường (.env). Lưu ý: biến VITE_* bị đóng gói vào JS phía client.
const getEnvKeys = (provider: AiProvider): string[] => {
    const raw = provider === 'agent-platform'
        ? (import.meta.env.VITE_AGENT_PLATFORM_API_KEYS || '')
        : (import.meta.env.VITE_GEMINI_API_KEYS || '');
    return raw.split(',').map((k: string) => k.trim()).filter((k: string) => GOOGLE_AI_API_KEY_PATTERN.test(k));
};

class ApiKeyManager {
    private lists: Partial<Record<AiProvider, ProviderKeyList>> = {};
    private onKeyRotation?: KeyRotationCallback;
    private onAllKeysFailed?: AllKeysFailedCallback;

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

    private getList(provider?: AiProvider): ProviderKeyList {
        const activeProvider = provider || this.getProvider();
        if (!this.lists[activeProvider]) {
            this.lists[activeProvider] = this.loadFromStorage(activeProvider);
        }
        return this.lists[activeProvider]!;
    }

    private loadFromStorage(provider: AiProvider): ProviderKeyList {
        const { list: listKey, single: singleKey } = STORAGE_KEYS[provider];
        const result: ProviderKeyList = { keys: [], currentIndex: 0 };

        try {
            const stored = localStorage.getItem(listKey);
            if (stored) {
                const data = JSON.parse(stored);
                result.keys = (Array.isArray(data.keys) ? data.keys : [])
                    .filter((k: ApiKeyInfo) => k && typeof k.key === 'string')
                    .map((k: ApiKeyInfo) => ({ ...k, source: 'user' as const }));
                result.currentIndex = Number(data.currentIndex) || 0;
            }
        } catch (e) {
            console.error(`Lỗi load API keys cho ${provider}:`, e);
        }

        // Bản cũ từng ghi cả key .env xuống localStorage: loại chúng khỏi danh sách "của người dùng"
        const envKeys = getEnvKeys(provider);
        result.keys = result.keys.filter(k => !envKeys.includes(k.key));

        // Key người dùng chọn gần nhất (ô đơn) luôn được ưu tiên dùng trước
        const preferred = (localStorage.getItem(singleKey) || '').trim();
        if (preferred && GOOGLE_AI_API_KEY_PATTERN.test(preferred) && !envKeys.includes(preferred)) {
            let idx = result.keys.findIndex(k => k.key === preferred);
            if (idx === -1 && result.keys.length < MAX_KEYS) {
                result.keys.push(this.newKeyInfo(preferred, 'Key của tôi', 'user'));
                idx = result.keys.length - 1;
            }
            if (idx !== -1) result.currentIndex = idx;
        }

        for (const envKey of envKeys) {
            if (result.keys.length >= MAX_KEYS) break;
            if (!result.keys.some(k => k.key === envKey)) {
                result.keys.push(this.newKeyInfo(envKey, `Key hệ thống ${result.keys.length + 1}`, 'env'));
            }
        }

        if (result.currentIndex >= result.keys.length) result.currentIndex = 0;
        return result;
    }

    private newKeyInfo(key: string, name: string, source: 'user' | 'env'): ApiKeyInfo {
        return { key, name, status: 'active', errorCount: 0, addedAt: Date.now(), source };
    }

    private saveToStorage(provider?: AiProvider): void {
        const activeProvider = provider || this.getProvider();
        const list = this.getList(activeProvider);
        const { list: listKey, single: singleKey } = STORAGE_KEYS[activeProvider];

        try {
            const userKeys = list.keys.filter(k => k.source !== 'env');
            const current = list.keys[list.currentIndex];
            localStorage.setItem(listKey, JSON.stringify({
                keys: userKeys,
                currentIndex: Math.max(0, userKeys.indexOf(current as ApiKeyInfo)),
            }));

            // Ô đơn chỉ chứa key người dùng tự nhập, không chứa key hệ thống
            if (current && current.source !== 'env') {
                localStorage.setItem(singleKey, current.key);
            }
        } catch (e) {
            console.error(`Lỗi lưu API keys cho ${activeProvider}:`, e);
        }
    }

    private checkAndResetCooldowns(provider?: AiProvider): void {
        const now = Date.now();
        this.getList(provider).keys.forEach(keyInfo => {
            if (keyInfo.status === 'cooldown' && (!keyInfo.cooldownUntil || keyInfo.cooldownUntil <= now)) {
                keyInfo.status = 'active';
                keyInfo.errorCount = 0;
                keyInfo.cooldownUntil = undefined;
            }
        });
    }

    addKey(key: string, name?: string, provider?: AiProvider): { success: boolean; message: string } {
        const list = this.getList(provider);
        const trimmedKey = key.trim();

        if (!GOOGLE_AI_API_KEY_PATTERN.test(trimmedKey)) {
            return { success: false, message: 'Key không đúng định dạng (bắt đầu bằng AIza hoặc AQ)' };
        }
        if (list.keys.some(k => k.key === trimmedKey)) {
            return { success: false, message: 'Key này đã tồn tại' };
        }
        if (list.keys.length >= MAX_KEYS) {
            return { success: false, message: `Đã đạt giới hạn ${MAX_KEYS} key` };
        }

        list.keys.push(this.newKeyInfo(trimmedKey, name?.trim() || `Key ${list.keys.length + 1}`, 'user'));
        this.saveToStorage(provider);
        return { success: true, message: 'Đã thêm key thành công' };
    }

    /** Thêm (nếu chưa có) và chọn key làm key đang dùng; key được chọn thủ công luôn được kích hoạt lại. */
    useKey(key: string, provider?: AiProvider): { success: boolean; message: string } {
        const trimmedKey = key.trim();
        const list = this.getList(provider);
        if (!list.keys.some(k => k.key === trimmedKey)) {
            const added = this.addKey(trimmedKey, 'Key của tôi', provider);
            if (!added.success) return added;
        }
        return this.setActiveKey(trimmedKey, provider);
    }

    removeKey(key: string, provider?: AiProvider): { success: boolean; message: string } {
        const list = this.getList(provider);
        const index = list.keys.findIndex(k => k.key === key);
        if (index === -1) {
            return { success: false, message: 'Không tìm thấy key' };
        }

        list.keys.splice(index, 1);
        if (index < list.currentIndex || list.currentIndex >= list.keys.length) {
            list.currentIndex = Math.max(0, list.currentIndex - 1);
        }
        this.saveToStorage(provider);
        return { success: true, message: 'Đã xóa key' };
    }

    /** Key đang dùng; bỏ qua key đang lỗi/cooldown và tự chuyển sang key còn hoạt động. */
    getActiveKey(provider?: AiProvider): string | null {
        const list = this.getList(provider);
        this.checkAndResetCooldowns(provider);
        if (list.keys.length === 0) {
            return null;
        }

        for (let i = 0; i < list.keys.length; i++) {
            const idx = (list.currentIndex + i) % list.keys.length;
            if (list.keys[idx].status === 'active') {
                list.currentIndex = idx;
                return list.keys[idx].key;
            }
        }
        return null;
    }

    markKeyError(key: string, errorType: string, provider?: AiProvider): ApiKeyRotationResult {
        const list = this.getList(provider);
        let keyInfo = list.keys.find(k => k.key === key);
        if (!keyInfo) {
            if (!GOOGLE_AI_API_KEY_PATTERN.test(key)) {
                return { success: false, hasMoreKeys: false, message: 'Không tìm thấy key' };
            }
            keyInfo = this.newKeyInfo(key, 'Key của tôi', 'user');
            list.keys.push(keyInfo);
        }
        list.currentIndex = list.keys.indexOf(keyInfo);

        keyInfo.lastError = errorType;
        keyInfo.errorCount++;

        if (errorType === 'QUOTA_EXCEEDED') {
            keyInfo.status = 'cooldown';
            keyInfo.cooldownUntil = Date.now() + QUOTA_COOLDOWN;
        } else if (errorType === 'RATE_LIMIT') {
            keyInfo.status = 'cooldown';
            keyInfo.cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN;
        } else if (errorType === 'INVALID_API_KEY' || errorType === 'PERMISSION_DENIED') {
            keyInfo.status = 'error';
        } else if (keyInfo.errorCount >= MAX_TRANSIENT_ERRORS) {
            keyInfo.status = 'cooldown';
            keyInfo.cooldownUntil = Date.now() + TRANSIENT_COOLDOWN;
        }

        this.saveToStorage(provider);
        return this.rotateToNextKey(errorType, provider);
    }

    rotateToNextKey(reason: string = 'manual', provider?: AiProvider): ApiKeyRotationResult {
        const list = this.getList(provider);
        this.checkAndResetCooldowns(provider);
        const fromKey = list.keys[list.currentIndex]?.key;

        for (let i = 1; i <= list.keys.length; i++) {
            const nextIndex = (list.currentIndex + i) % list.keys.length;
            const nextKey = list.keys[nextIndex];

            if (nextKey.status === 'active' && nextKey.key !== fromKey) {
                list.currentIndex = nextIndex;
                this.saveToStorage(provider);

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

    getAllKeys(provider?: AiProvider): ApiKeyInfo[] {
        this.checkAndResetCooldowns(provider);
        return [...this.getList(provider).keys];
    }

    getKeyStats(provider?: AiProvider): { total: number; active: number; error: number; cooldown: number } {
        this.checkAndResetCooldowns(provider);
        const keys = this.getList(provider).keys;
        return {
            total: keys.length,
            active: keys.filter(k => k.status === 'active').length,
            error: keys.filter(k => k.status === 'error').length,
            cooldown: keys.filter(k => k.status === 'cooldown').length
        };
    }

    resetKey(key: string, provider?: AiProvider): { success: boolean; message: string } {
        const keyInfo = this.getList(provider).keys.find(k => k.key === key);
        if (!keyInfo) {
            return { success: false, message: 'Không tìm thấy key' };
        }

        keyInfo.status = 'active';
        keyInfo.errorCount = 0;
        keyInfo.cooldownUntil = undefined;
        keyInfo.lastError = undefined;

        this.saveToStorage(provider);
        return { success: true, message: 'Đã kích hoạt lại key' };
    }

    updateKeyName(key: string, newName: string, provider?: AiProvider): { success: boolean; message: string } {
        const keyInfo = this.getList(provider).keys.find(k => k.key === key);
        if (!keyInfo) {
            return { success: false, message: 'Không tìm thấy key' };
        }

        keyInfo.name = newName.trim() || keyInfo.name;
        this.saveToStorage(provider);
        return { success: true, message: 'Đã cập nhật tên key' };
    }

    maskKey(key: string): string {
        if (!key || key.length < 8) return '***';
        return key.substring(0, 4) + '...' + key.substring(key.length - 4);
    }

    hasAvailableKeys(provider?: AiProvider): boolean {
        this.checkAndResetCooldowns(provider);
        return this.getList(provider).keys.some(k => k.status === 'active');
    }

    getCurrentIndex(provider?: AiProvider): number {
        return this.getList(provider).currentIndex;
    }

    setActiveKey(keyOrIndex: string | number, provider?: AiProvider): { success: boolean; message: string } {
        const list = this.getList(provider);
        const index = typeof keyOrIndex === 'number'
            ? keyOrIndex
            : list.keys.findIndex(k => k.key === keyOrIndex.trim());

        if (index < 0 || index >= list.keys.length) {
            return { success: false, message: 'Key không tồn tại' };
        }

        const keyInfo = list.keys[index];
        keyInfo.status = 'active';
        keyInfo.errorCount = 0;
        keyInfo.cooldownUntil = undefined;
        keyInfo.lastError = undefined;

        list.currentIndex = index;
        this.saveToStorage(provider);
        return { success: true, message: `Đã chuyển sang key: ${keyInfo.name}` };
    }

    resetAllKeys(provider?: AiProvider): { success: boolean; message: string } {
        let resetCount = 0;
        this.getList(provider).keys.forEach(keyInfo => {
            if (keyInfo.status !== 'active') {
                keyInfo.status = 'active';
                keyInfo.errorCount = 0;
                keyInfo.cooldownUntil = undefined;
                keyInfo.lastError = undefined;
                resetCount++;
            }
        });

        this.saveToStorage(provider);
        return { success: true, message: `Đã reset ${resetCount} key` };
    }

    getNextAvailableKey(provider?: AiProvider): string | null {
        const list = this.getList(provider);
        this.checkAndResetCooldowns(provider);

        for (let i = 1; i <= list.keys.length; i++) {
            const nextKey = list.keys[(list.currentIndex + i) % list.keys.length];
            if (nextKey.status === 'active') {
                return nextKey.key;
            }
        }
        return null;
    }

    /** Số key hệ thống (.env) đang có cho provider — dùng để hiển thị, không lộ giá trị key */
    getEnvKeyCount(provider?: AiProvider): number {
        return this.getList(provider).keys.filter(k => k.source === 'env').length;
    }
}

export const apiKeyManager = new ApiKeyManager();
