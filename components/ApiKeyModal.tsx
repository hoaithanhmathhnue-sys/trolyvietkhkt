import React, { useState, useEffect, useMemo } from 'react';
import { Button } from './Button';
import { Key, X, Zap, Cpu, Sparkles, ExternalLink, Bot, Globe, ShieldCheck, Server } from 'lucide-react';
import {
    AiProvider,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_AGENT_PLATFORM_MODEL,
    GEMINI_MODELS,
    AGENT_PLATFORM_MODELS,
    MODEL_INFO
} from '../constants';
import { apiKeyManager, GOOGLE_AI_API_KEY_PATTERN } from '../services/apiKeyManager';

interface ApiKeyModalProps {
    isOpen: boolean;
    onSave: (key: string, selectedModel: string, provider: AiProvider) => void;
    onClose: () => void;
    isDismissible?: boolean;
    currentProvider?: AiProvider;
}

// Đọc API keys từ biến môi trường theo provider
const getEnvApiKeys = (provider: AiProvider): string[] => {
    const envVar = provider === 'agent-platform'
        ? (import.meta.env.VITE_AGENT_PLATFORM_API_KEYS || import.meta.env.VITE_GEMINI_API_KEYS || '')
        : (import.meta.env.VITE_GEMINI_API_KEYS || '');

    if (!envVar) return [];
    return envVar.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
};

const ModelIcon: React.FC<{ modelId: string }> = ({ modelId }) => {
    if (modelId.includes('3-flash') || modelId.includes('2.5-flash')) return <Zap className="w-5 h-5" />;
    if (modelId.includes('-pro')) return <Sparkles className="w-5 h-5" />;
    return <Cpu className="w-5 h-5" />;
};

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
    isOpen,
    onSave,
    onClose,
    isDismissible = true,
    currentProvider
}) => {
    const [provider, setProvider] = useState<AiProvider>(currentProvider || apiKeyManager.getProvider());
    const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_GEMINI_MODEL);
    const [apiKey, setApiKey] = useState('');
    const [error, setError] = useState('');

    // Lấy danh sách key từ env cho provider hiện tại
    const envKeys = useMemo(() => getEnvApiKeys(provider), [provider]);
    const hasEnvKeys = envKeys.length > 0;

    // Tải cấu hình khi Modal mở hoặc khi provider thay đổi
    useEffect(() => {
        if (isOpen) {
            const activeProvider = provider || apiKeyManager.getProvider();
            const savedKey = activeProvider === 'agent-platform'
                ? (localStorage.getItem('agent_platform_api_key') || localStorage.getItem('gemini_api_key') || '')
                : (localStorage.getItem('gemini_api_key') || '');

            const savedModel = localStorage.getItem('selected_model');
            const validModels = activeProvider === 'agent-platform' ? AGENT_PLATFORM_MODELS : GEMINI_MODELS;
            const defaultModel = activeProvider === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL;

            setApiKey(savedKey);
            if (savedModel && (validModels as readonly string[]).includes(savedModel)) {
                setSelectedModel(savedModel);
            } else {
                setSelectedModel(defaultModel);
            }
        }
    }, [isOpen, provider]);

    // Xử lý chuyển Provider
    const handleProviderChange = (newProvider: AiProvider) => {
        setProvider(newProvider);
        setError('');

        const savedKey = newProvider === 'agent-platform'
            ? (localStorage.getItem('agent_platform_api_key') || localStorage.getItem('gemini_api_key') || '')
            : (localStorage.getItem('gemini_api_key') || '');

        const validModels = newProvider === 'agent-platform' ? AGENT_PLATFORM_MODELS : GEMINI_MODELS;
        const defaultModel = newProvider === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL;

        setApiKey(savedKey);
        setSelectedModel(defaultModel);
    };

    const handleSave = () => {
        const trimmedKey = apiKey.trim();

        // Nếu không nhập key → dùng key đầu tiên từ env
        let keyToSave = trimmedKey;
        if (!keyToSave && hasEnvKeys) {
            keyToSave = envKeys[0];
        }

        if (!keyToSave) {
            setError(`Vui lòng nhập API Key cho ${provider === 'agent-platform' ? 'Agent Platform API' : 'Google Gemini'}`);
            return;
        }

        if (!GOOGLE_AI_API_KEY_PATTERN.test(keyToSave)) {
            setError('API Key không hợp lệ. Key phải bắt đầu bằng "AIzaSy" hoặc "AQ" và đúng định dạng.');
            return;
        }

        // Lưu Provider vào localStorage
        apiKeyManager.setProvider(provider);

        // Lưu key vào storage tương ứng
        if (provider === 'agent-platform') {
            localStorage.setItem('agent_platform_api_key', keyToSave);
        } else {
            localStorage.setItem('gemini_api_key', keyToSave);
        }

        localStorage.setItem('selected_model', selectedModel);

        setError('');
        onSave(keyToSave, selectedModel, provider);
    };

    if (!isOpen) return null;

    const currentModels = provider === 'agent-platform' ? AGENT_PLATFORM_MODELS : GEMINI_MODELS;
    const selectedModelInfo = MODEL_INFO[selectedModel];

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex-shrink-0 relative bg-gradient-to-r from-sky-50 to-indigo-50">
                    {isDismissible && (
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-white/80"
                        >
                            <X size={20} />
                        </button>
                    )}

                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-sky-600 text-white rounded-xl shadow-sm">
                            <Key className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Cấu hình AI Provider & Model</h2>
                            <p className="text-sm text-gray-600">Chọn nhà cung cấp và kết nối API Key cho ứng dụng</p>
                        </div>
                    </div>

                    {/* Tab Chuyển đổi Provider */}
                    <div className="mt-5 grid grid-cols-2 gap-2 bg-gray-200/70 p-1.5 rounded-xl text-sm font-medium">
                        <button
                            type="button"
                            onClick={() => handleProviderChange('gemini')}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg transition-all ${
                                provider === 'gemini'
                                    ? 'bg-white text-sky-700 shadow-sm font-semibold'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                            }`}
                        >
                            <Globe className="w-4 h-4 text-sky-500" />
                            <span>Google Gemini AI</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleProviderChange('agent-platform')}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg transition-all ${
                                provider === 'agent-platform'
                                    ? 'bg-white text-emerald-700 shadow-sm font-semibold'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                            }`}
                        >
                            <Bot className="w-4 h-4 text-emerald-600" />
                            <span>Agent Platform API</span>
                        </button>
                    </div>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Badge mô tả provider đang chọn */}
                    <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                        provider === 'agent-platform'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-sky-50 border-sky-200 text-sky-800'
                    }`}>
                        {provider === 'agent-platform' ? (
                            <>
                                <Server className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <strong>Chế độ Agent Platform API:</strong> Sử dụng hạ tầng Agent Platform chuyên biệt của Google với cơ chế xác thực Vertex API linh hoạt, tốc độ và độ ổn định cao.
                                </div>
                            </>
                        ) : (
                            <>
                                <Globe className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <strong>Chế độ Google Gemini AI:</strong> Kết nối trực tiếp dịch vụ Google AI Studio API chuẩn chính thức của Google Gemini.
                                </div>
                            </>
                        )}
                    </div>

                    {/* Model Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-800 mb-3">
                            Chọn Mô Hình (Model) - {provider === 'agent-platform' ? 'Agent Platform' : 'Google Gemini'}
                        </label>
                        <div className="grid grid-cols-1 gap-3">
                            {currentModels.map((modelId) => {
                                const info = MODEL_INFO[modelId];
                                const isSelected = selectedModel === modelId;
                                return (
                                    <button
                                        key={modelId}
                                        type="button"
                                        onClick={() => setSelectedModel(modelId)}
                                        className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${isSelected
                                            ? provider === 'agent-platform'
                                                ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
                                                : 'border-sky-500 bg-sky-50/70 shadow-sm'
                                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${
                                            isSelected
                                                ? provider === 'agent-platform' ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            <ModelIcon modelId={modelId} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-semibold ${
                                                    isSelected
                                                        ? provider === 'agent-platform' ? 'text-emerald-900' : 'text-sky-900'
                                                        : 'text-gray-900'
                                                }`}>
                                                    {info?.name || modelId}
                                                </span>
                                                {info?.isDefault && (
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                                        Mặc định
                                                    </span>
                                                )}
                                                {info?.access === 'paid-only' && (
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                                                        Trả phí
                                                    </span>
                                                )}
                                                {info?.status === 'preview' && (
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full">
                                                        Preview
                                                    </span>
                                                )}
                                                {info?.status === 'retiring' && (
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                                        Sắp ngừng
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {info?.description || ''}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                                provider === 'agent-platform' ? 'bg-emerald-600' : 'bg-sky-600'
                                            }`}>
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic">
                            💡 Khi model được chọn gặp sự cố quá tải hoặc giới hạn lượt gọi, hệ thống sẽ tự động chuyển đổi sang model dự phòng ({provider === 'agent-platform' ? 'Agent Platform Fallback' : 'Gemini Fallback'}).
                        </p>
                        {selectedModelInfo?.priceNote && (
                            <div className={`mt-3 p-3 rounded-lg border text-sm ${selectedModelInfo.status === 'retiring'
                                ? 'bg-red-50 border-red-200 text-red-800'
                                : 'bg-amber-50 border-amber-200 text-amber-800'
                                }`}>
                                <strong>{selectedModelInfo.access === 'paid-only' ? 'Lưu ý chi phí:' : 'Lưu ý model:'}</strong>{' '}
                                {selectedModelInfo.priceNote}
                            </div>
                        )}
                    </div>

                    {/* API Key Input */}
                    <div className="border-t border-gray-100 pt-6">
                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                            🔑 API Key cho {provider === 'agent-platform' ? 'Agent Platform' : 'Google Gemini'}{' '}
                            {hasEnvKeys && <span className="text-green-600 font-normal text-xs">(Đã có key sẵn từ hệ thống)</span>}
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => {
                                setApiKey(e.target.value);
                                setError('');
                            }}
                            placeholder={hasEnvKeys ? "Để trống để dùng key mặc định, hoặc nhập key riêng (AIza.../AQ...)" : "Nhập API Key (AIza... hoặc AQ...)"}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none text-sm font-mono shadow-sm transition-all"
                        />

                        {/* Error message */}
                        {error && (
                            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                                <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Thông báo key mặc định */}
                        {hasEnvKeys && (
                            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <span>Hệ thống đã tích hợp sẵn <strong>{envKeys.length} API Key</strong> dự phòng cho {provider === 'agent-platform' ? 'Agent Platform' : 'Gemini'}. Bạn có thể để trống hoặc dán key cá nhân.</span>
                            </div>
                        )}

                        {/* Preset API Keys - chỉ hiện nếu có keys từ env */}
                        {hasEnvKeys && (
                            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                <p className="text-xs font-semibold text-gray-700 mb-2">
                                    🔑 Chọn nhanh API Key dự phòng có sẵn:
                                </p>
                                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                    {envKeys.map((key, idx) => {
                                        const masked = key.startsWith('AIza') ? `AIza••••${key.slice(-4)}` : `AQ••••${key.slice(-4)}`;
                                        const isActive = apiKey === key;
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setApiKey(key);
                                                    setError('');
                                                }}
                                                className={`px-3 py-2 text-xs font-mono rounded-lg border transition-all text-left truncate ${isActive
                                                    ? 'border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-300 font-semibold'
                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-sky-300 hover:bg-sky-50'
                                                    }`}
                                                title={`Key #${idx + 1}`}
                                            >
                                                🔑 {masked}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Help text */}
                        <div className="mt-4 p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
                            <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-amber-600" />
                                Hướng dẫn lấy API Key miễn phí:
                            </p>
                            <ol className="space-y-1 list-decimal list-inside text-amber-800">
                                <li>Truy cập Google AI Studio (aistudio.google.com)</li>
                                <li>Đăng nhập tài khoản Google của bạn</li>
                                <li>Nhấn nút <strong>"Create API Key"</strong></li>
                                <li>Sao chép mã API Key và dán vào ô trên</li>
                            </ol>
                            <a
                                href="https://aistudio.google.com/api-keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
                            >
                                <ExternalLink size={14} />
                                Lấy API Key Google AI Studio
                            </a>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0 bg-gray-50">
                    {isDismissible && (
                        <Button variant="secondary" onClick={onClose}>
                            Đóng
                        </Button>
                    )}
                    <Button onClick={handleSave}>
                        Lưu Cấu Hình AI
                    </Button>
                </div>
            </div>
        </div>
    );
};
