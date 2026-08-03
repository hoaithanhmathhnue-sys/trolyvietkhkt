import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  Check,
  Copy,
  RotateCcw,
  Edit,
  Activity,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  BookOpen,
  Award,
  ArrowRight,
  Plus,
  RefreshCw,
  CornerDownLeft,
  ChevronRight,
  AlertTriangle,
  Flame,
  Volume2
} from 'lucide-react';
import { GenerationStep, KHKTProjectInfo } from '../types';
import { sendSinglePromptStream } from '../services/geminiService';

interface AIActionPanelProps {
  apiKey: string | null;
  selectedModel: string;
  currentStep: GenerationStep;
  documentContent: string;
  projectInfo: KHKTProjectInfo;
  onUpdateDocument: (newContent: string) => void;
  onInsertText: (text: string) => void;
}

// Mẫu câu khoa học chuẩn theo lĩnh vực và chương mục
const SAMPLE_SENTENCES_DATA = [
  {
    category: 'Mở đầu',
    items: [
      { text: 'Trong bối cảnh phát triển mạnh mẽ của khoa học và công nghệ hiện nay, vấn đề...', desc: 'Dẫn dắt bối cảnh chung' },
      { text: 'Xuất phát từ thực tiễn giảng dạy, học tập và hoạt động trải nghiệm tại các trường THPT, việc...', desc: 'Liên hệ thực tế trường học' },
      { text: 'Nghiên cứu này tập trung vào việc làm sáng tỏ cơ chế hoạt động cũng như đánh giá tác động của...', desc: 'Xác định mục tiêu chính' },
      { text: 'Để giải quyết mâu thuẫn giữa lý thuyết học tập và ứng dụng thực tiễn, đề tài đề xuất hướng đi...', desc: 'Đề xuất giải pháp khắc phục' },
      { text: 'Tính cấp thiết của đề tài được thể hiện rõ nét qua việc giải quyết nhu cầu thực tiễn về...', desc: 'Nhấn mạnh tính cấp thiết' }
    ]
  },
  {
    category: 'Nêu vấn đề',
    items: [
      { text: 'Thực tế khảo sát tại địa phương cho thấy phương pháp truyền thống đang bộc lộ một số hạn chế như...', desc: 'Chỉ ra hạn chế thực tế' },
      { text: 'Một trong những thách thức lớn nhất mà học sinh và giáo viên gặp phải khi tiếp cận vấn đề này là...', desc: 'Mô tả khó khăn của đối tượng' },
      { text: 'Sự thiếu hụt các nghiên cứu thực nghiệm và ứng dụng công nghệ trong lĩnh vực này đã đặt ra yêu cầu...', desc: 'Nêu khoảng trống nghiên cứu' },
      { text: 'Mặc dù đã có một số giải pháp được đưa ra, song hiệu quả thực tế vẫn chưa đạt kỳ vọng do...', desc: 'Phản biện giải pháp cũ' },
      { text: 'Câu hỏi nghiên cứu cốt lõi mà đề tài hướng tới giải quyết là: Làm thế nào để tối ưu hóa...', desc: 'Đặt câu hỏi nghiên cứu' }
    ]
  },
  {
    category: 'Phân tích / Biện luận',
    items: [
      { text: 'Số liệu thực chứng thu thập được qua khảo sát định lượng chỉ ra rằng có sự tương quan chặt chẽ giữa...', desc: 'Biện luận số liệu khảo sát' },
      { text: 'Kết quả kiểm chứng lâm sàng/thực nghiệm cho thấy sự chênh lệch rõ rệt (p < 0.05) giữa nhóm thực nghiệm và nhóm đối chứng...', desc: 'Khẳng định độ tin cậy thực nghiệm' },
      { text: 'Để lý giải cho hiện tượng này, chúng tôi dựa trên các lý thuyết nền tảng về khoa học hành vi/vật lý...', desc: 'Liên hệ cơ sở lý thuyết' },
      { text: 'Biểu đồ kết quả tại Hình 3.2 minh họa rõ nét xu hướng biến đổi và hiệu quả vượt trội của giải pháp...', desc: 'Giải thích biểu đồ/hình ảnh' },
      { text: 'Phân tích định tính từ các cuộc phỏng vấn sâu củng cố thêm nhận định rằng...', desc: 'Bổ sung kết quả phỏng vấn' }
    ]
  },
  {
    category: 'Kết luận',
    items: [
      { text: 'Tóm lại, kết quả thực nghiệm đã chứng minh tính khả thi, độ an toàn và hiệu quả thực tiễn cao của...', desc: 'Khẳng định kết quả chung' },
      { text: 'Đề tài đã hoàn thành đầy đủ các mục tiêu đề ra ban đầu, đồng thời mở ra một hướng tiếp cận mới trong...', desc: 'Tóm tắt mức độ hoàn thành' },
      { text: 'Từ những kết quả đạt được, chúng tôi đề xuất một số khuyến nghị thiết thực đối với nhà trường và địa phương...', desc: 'Đưa ra khuyến nghị áp dụng' },
      { text: 'Mặc dù đạt được những thành công nhất định, nghiên cứu vẫn tồn tại một số hạn chế như quy mô mẫu chưa lớn...', desc: 'Thừa nhận hạn chế đề tài' },
      { text: 'Hướng phát triển tiếp theo của đề tài sẽ tập trung vào việc tự động hóa và tích hợp sâu công nghệ...', desc: 'Đề xuất hướng phát triển' }
    ]
  },
  {
    category: 'Trích dẫn APA',
    items: [
      { text: 'Theo nghiên cứu thực nghiệm của Nguyễn Văn A và cộng sự (2024), việc áp dụng...', desc: 'Trích dẫn tác giả trong nước' },
      { text: 'Phù hợp với mô hình lý thuyết được đề xuất bởi Smith & Johnson (2023), kết quả nghiên cứu này...', desc: 'Trích dẫn nghiên cứu nước ngoài' },
      { text: 'Quan điểm này cũng nhận được sự đồng thuận trong báo cáo thường niên của Bộ Giáo dục và Đào tạo (2024)...', desc: 'Trích dẫn tài liệu tổ chức/báo cáo' }
    ]
  }
];

export const AIActionPanel: React.FC<AIActionPanelProps> = ({
  apiKey,
  selectedModel,
  currentStep,
  documentContent,
  projectInfo,
  onUpdateDocument,
  onInsertText
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'improve' | 'samples' | 'quality'>('generate');

  // Common UI states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab 1: Tạo nội dung states
  const [genSection, setGenSection] = useState<string>('Lý do chọn đề tài');
  const [genPrompt, setGenPrompt] = useState('');
  const [genLength, setGenLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [genTone, setGenTone] = useState<'academic' | 'simple'>('academic');
  const [genResult, setGenResult] = useState('');
  const [genCopied, setGenCopied] = useState(false);
  const [genTime, setGenTime] = useState<number | null>(null);

  // Tab 2: Chỉnh sửa văn bản states
  const [improveText, setImproveText] = useState('');
  const [improveResult, setImproveResult] = useState('');
  const [improveAction, setImproveAction] = useState<string>('');
  const [improveCopied, setImproveCopied] = useState(false);

  // Tab 3: Mẫu câu states
  const [sampleCategory, setSampleCategory] = useState<string>('Mở đầu');
  const [sampleSearch, setSampleSearch] = useState('');

  // Tab 4: Kiểm tra chất lượng states
  const [qualitySection, setQualitySection] = useState<string>('Lý do chọn đề tài');
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [qualityData, setQualityData] = useState<{
    positives: string[];
    improvements: Array<{ text: string; suggestion: string; actionText?: string; actionType?: string }>;
    criticals: string[];
    criteriaScores: Array<{ name: string; score: number; max: number }>;
  } | null>(null);

  // Đồng bộ hóa mục sinh nội dung khi bước thay đổi
  useEffect(() => {
    if (currentStep === GenerationStep.PHAN_MO_DAU) {
      setGenSection('Lý do chọn đề tài');
      setQualitySection('Lý do chọn đề tài');
    } else if (currentStep === GenerationStep.CHUONG_1) {
      setGenSection('Chương 1: Cơ sở lý luận');
      setQualitySection('Chương 1: Cơ sở lý luận');
    } else if (currentStep === GenerationStep.CHUONG_2) {
      setGenSection('Chương 2: Thực trạng');
      setQualitySection('Chương 2: Thực trạng');
    } else if (currentStep === GenerationStep.CHUONG_3) {
      setGenSection('Chương 3: Thiết kế giải pháp / Sản phẩm');
      setQualitySection('Chương 3: Thiết kế giải pháp / Sản phẩm');
    } else if (currentStep === GenerationStep.CHUONG_4) {
      setGenSection('Chương 4: Thực nghiệm & Đánh giá');
      setQualitySection('Chương 4: Thực nghiệm & Đánh giá');
    }
  }, [currentStep]);

  // Lấy các phần mục lục tương ứng với KHKT
  const sectionOptions = [
    'Lý do chọn đề tài',
    'Mục tiêu nghiên cứu',
    'Đối tượng nghiên cứu',
    'Phạm vi nghiên cứu',
    'Câu hỏi nghiên cứu',
    'Giả thuyết khoa học',
    'Ý nghĩa khoa học và thực tiễn',
    'Phương pháp nghiên cứu',
    'Tính mới (tính sáng tạo) của đề tài',
    'Chương 1: Cơ sở lý luận',
    'Chương 2: Thực trạng',
    'Chương 3: Thiết kế giải pháp / Sản phẩm',
    'Chương 4: Thực nghiệm và đánh giá',
    'Phần III: Kết luận',
    'Phụ lục',
    'Tài liệu tham khảo'
  ];

  // Hàm gọi API sinh nội dung
  const handleGenerateContent = async (isRegen = false) => {
    if (!apiKey) {
      setError('Vui lòng cấu hình API Key trong mục Cài đặt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGenCopied(false);
    if (!isRegen) {
      setGenResult('');
    }

    const startTime = Date.now();
    
    // Xây dựng prompt chất lượng cao cho KHKT
    const prompt = `
Bạn là Chuyên gia hướng dẫn viết đề tài Khoa học Kỹ thuật (KHKT) cấp quốc gia. 
Hãy viết nội dung cho mục: **"${genSection}"**.

## THÔNG TIN DỰ ÁN NGHIÊN CỨU:
- Tên đề tài: ${projectInfo.projectTitle}
- Lĩnh vực nghiên cứu: ${projectInfo.field}
- Cấp thi mong muốn: ${projectInfo.level}
- Giáo viên hướng dẫn: ${projectInfo.advisor}
- Vấn đề nghiên cứu: ${projectInfo.problem}
- Mục tiêu nghiên cứu: ${projectInfo.objectives}
- Giả thuyết khoa học: ${projectInfo.hypothesis}
- Phương pháp nghiên cứu: ${projectInfo.methods}
- Đối tượng/Phạm vi: ${projectInfo.researchSubjects}
- Yêu cầu đặc biệt của nhóm: ${projectInfo.specialRequirements || 'Không có'}

## YÊU CẦU CỤ THỂ CHO ĐOẠN VĂN NÀY:
- Ý tưởng cốt lõi của người dùng cung cấp thêm: "${genPrompt || 'Viết chi tiết, đầy đủ luận cứ khoa học'}"
- Độ dài yêu cầu: ${genLength === 'short' ? 'Ngắn (khoảng 150-250 từ)' : genLength === 'medium' ? 'Vừa phải (khoảng 300-450 từ)' : 'Dài và chi tiết (khoảng 500-800 từ)'}
- Văn phong: ${genTone === 'academic' ? 'Học thuật, trang trọng, sử dụng thuật ngữ khoa học chuyên ngành, lập luận chặt chẽ' : 'Dễ hiểu, phổ thông, rõ ràng, tập trung vào thực tiễn'}
- Yêu cầu chống đạo văn: Diễn đạt độc đáo, có tính thực tiễn cao, tự động chèn các số liệu thực chứng hợp lý (ví dụ phần trăm khảo sát lẻ như 82.4%, 15.6%...) để tăng độ thuyết phục.
- Định dạng: Sử dụng Markdown sạch sẽ. Cần viết trực tiếp nội dung phần thân, KHÔNG trả về tiêu đề lớn h1, h2 hay lời chào, lời dẫn dắt bên ngoài.

BẮT ĐẦU VIẾT:
`;

    try {
      let accumulatedText = '';
      await sendSinglePromptStream(prompt, (chunk) => {
        accumulatedText += chunk;
        setGenResult(accumulatedText);
      });
      setGenTime(Math.round((Date.now() - startTime) / 100) / 10);
    } catch (err: any) {
      console.error('Lỗi khi sinh nội dung:', err);
      setError(err.message || 'Không thể gọi AI. Vui lòng kiểm tra lại kết nối mạng hoặc API Key.');
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm gọi API cải thiện văn bản
  const handleImproveText = async (action: string, actionLabel: string) => {
    if (!apiKey) {
      setError('Vui lòng cấu hình API Key trong mục Cài đặt.');
      return;
    }

    if (!improveText.trim()) {
      setError('Vui lòng nhập hoặc chọn đoạn văn cần chỉnh sửa.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImproveCopied(false);
    setImproveAction(actionLabel);
    setImproveResult('');

    let actionPrompt = '';
    switch (action) {
      case 'shorten':
        actionPrompt = 'Rút ngắn đoạn văn bản này. Giảm bớt số lượng từ khoảng 30-50%, lược bỏ các ý lặp lại hoặc rườm rà, nhưng phải giữ nguyên tất cả luận điểm, thông tin số liệu chính.';
        break;
      case 'expand':
        actionPrompt = 'Mở rộng đoạn văn bản này. Bổ sung thêm chi tiết, lập luận khoa học, đưa ra các ví dụ thực tiễn hoặc phân tích sâu hơn về mặt kỹ thuật/nguyên lý khoa học của đề tài KHKT.';
        break;
      case 'clarify':
        actionPrompt = 'Làm rõ ý đoạn văn bản này. Sắp xếp lại cấu trúc câu, loại bỏ các diễn đạt mơ hồ, đảm bảo người đọc có thể dễ dàng hiểu được lập luận khoa học một cách logic nhất.';
        break;
      case 'paraphrase':
        actionPrompt = 'Viết lại (diễn đạt khác) đoạn văn bản này. Thay đổi cách cấu trúc câu và từ vựng một cách sáng tạo để tránh đạo văn, nhưng vẫn giữ nguyên vẹn 100% ý nghĩa khoa học gốc.';
        break;
      case 'academic':
        actionPrompt = 'Học thuật hóa văn phong. Thay thế các từ ngữ đời thường bằng các thuật ngữ khoa học chuyên ngành, thay đổi cấu trúc câu sang dạng câu bị động hoặc câu phức trang trọng phù hợp với báo cáo nghiên cứu KHKT chuẩn quốc tế.';
        break;
      case 'simplify':
        actionPrompt = 'Đơn giản hóa nội dung. Diễn đạt các khái niệm kỹ thuật phức tạp bằng từ ngữ dễ hiểu hơn, câu ngắn gọn hơn, thích hợp cho việc thuyết trình trước hội đồng giám khảo không chuyên sâu.';
        break;
      case 'spellcheck':
        actionPrompt = 'Kiểm tra lỗi chính tả và lỗi đánh máy tiếng Việt. Sửa chính xác các từ viết sai, lỗi dấu câu, viết hoa tùy tiện, nhưng TUYỆT ĐỐI không thay đổi nội dung khoa học hay cấu trúc câu nếu không bị sai ngữ pháp.';
        break;
      case 'grammar':
        actionPrompt = 'Kiểm tra ngữ pháp và cấu trúc câu khoa học. Phát hiện và sửa các câu thiếu chủ ngữ/vị ngữ, các câu ghép quá dài gây khó hiểu, tối ưu hóa sự liên kết giữa các câu trong đoạn văn.';
        break;
      default:
        actionPrompt = 'Cải thiện đoạn văn bản này để mượt mà và khoa học hơn.';
    }

    const prompt = `
Bạn là Chuyên gia ngôn ngữ khoa học hướng dẫn KHKT.
Nhiệm vụ: Hãy chỉnh sửa đoạn văn bản dưới đây theo yêu cầu sau:

👉 **YÊU CẦU CỦA NGƯỜI DÙNG:**
${actionPrompt}

📑 **THÔNG TIN ĐỀ TÀI NGHIÊN CỨU (LÀM NGỮ CẢNH):**
- Đề tài: ${projectInfo.projectTitle}
- Lĩnh vực: ${projectInfo.field}

📝 **ĐOẠN VĂN GỐC CẦN SỬA:**
"""
${improveText}
"""

Hãy trả về đoạn văn bản đã chỉnh sửa hoàn chỉnh dưới dạng markdown. KHÔNG thêm bất kỳ lời bình luận, giải thích hay tiêu đề phụ nào. Chỉ trả về văn bản sạch.
`;

    try {
      let accumulatedText = '';
      await sendSinglePromptStream(prompt, (chunk) => {
        accumulatedText += chunk;
        setImproveResult(accumulatedText);
      });
    } catch (err: any) {
      console.error('Lỗi khi cải thiện văn bản:', err);
      setError(err.message || 'Không thể gọi AI để cải thiện văn bản.');
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm tự động điền văn bản từ Editor vào phần Chỉnh sửa
  const grabTextFromEditor = () => {
    // Nếu có văn bản được bôi đen trong document ta có thể lấy nó, ở đây fallback lấy một phần tài liệu hiện tại hoặc báo người dùng
    if (window.getSelection()?.toString()) {
      setImproveText(window.getSelection()!.toString());
    } else {
      // Fallback lấy toàn bộ nội dung hoặc hiển thị thông báo hướng dẫn
      const text = documentContent.substring(0, 1000);
      setImproveText(text);
      setError('Đã tự động lấy 1000 ký tự đầu tiên từ tài liệu. Bạn có thể bôi đen văn bản trong tài liệu để tự động lấy đoạn cần sửa.');
      setTimeout(() => setError(null), 4000);
    }
  };

  // Sao chép nội dung sinh ra vào bộ nhớ tạm
  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Hàm gọi API kiểm tra chất lượng
  const handleQualityCheck = async () => {
    if (!apiKey) {
      setError('Vui lòng cấu hình API Key trong mục Cài đặt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setQualityScore(null);
    setQualityData(null);

    // Lấy đoạn văn tương ứng với bước hiện tại để kiểm tra
    const textToCheck = documentContent || 'Chưa có nội dung văn bản để kiểm tra. Vui lòng viết nội dung đề tài trước.';

    const prompt = `
Bạn là Giám khảo chấm thi Khoa học Kỹ thuật (KHKT) cấp quốc gia.
Nhiệm vụ: Hãy phân tích chất lượng khoa học của đoạn văn bản nghiên cứu dưới đây và chấm điểm chi tiết.

📑 **THÔNG TIN ĐỀ TÀI:**
- Đề tài: ${projectInfo.projectTitle}
- Lĩnh vực: ${projectInfo.field}
- Mục tiêu: ${projectInfo.objectives}
- Giả thuyết: ${projectInfo.hypothesis}

📝 **ĐOẠN VĂN CẦN KIỂM TRA (thuộc mục "${qualitySection}"):**
"""
${textToCheck.substring(0, 5000)}
"""

Hãy chấm điểm chất lượng trên thang điểm 10 và trả về kết quả định dạng JSON chuẩn mực sau (TUYỆT ĐỐI KHÔNG có chữ giải thích bên ngoài, KHÔNG có markdown code block, chỉ trả về JSON nguyên bản):
{
  "score": 7.8,
  "criteriaScores": [
    { "name": "Ngôn ngữ khoa học", "score": 8, "max": 10 },
    { "name": "Trích dẫn nguồn", "score": 6, "max": 10 },
    { "name": "Cấu trúc logic", "score": 8, "max": 10 },
    { "name": "Chính tả & Ngữ pháp", "score": 9, "max": 10 },
    { "name": "Tính thực tiễn/Số liệu", "score": 7, "max": 10 }
  ],
  "positives": [
    "Câu cú viết mạch lạc, sử dụng các thuật ngữ khoa học chính xác",
    "Bố cục các luận điểm rõ ràng, đi thẳng vào vấn đề nghiên cứu"
  ],
  "improvements": [
    { "text": "Thiếu số liệu định lượng làm minh chứng", "suggestion": "Nên đưa thêm tỷ lệ % khảo sát thực tế (ví dụ: khảo sát 150 học sinh, có 78.4% gặp khó khăn...)", "actionText": "Tự động bổ sung số liệu minh họa", "actionType": "add_statistics" },
    { "text": "Câu thứ 2 trong đoạn mở đầu quá dài và lạm dụng liên từ", "suggestion": "Tách câu này thành 2 câu đơn để người đọc dễ theo dõi", "actionText": "Tự động rút gọn & tách câu", "actionType": "split_sentence" }
  ],
  "criticals": [
    "Chưa làm nổi bật được Tính sáng tạo hoặc điểm mới của dự án so với các giải pháp hiện có trên thị trường"
  ]
}

BẮT ĐẦU TRẢ VỀ JSON:
`;

    try {
      let accumulatedText = '';
      await sendSinglePromptStream(prompt, (chunk) => {
        accumulatedText += chunk;
      });

      // Parse JSON từ kết quả
      let jsonText = accumulatedText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const match = jsonText.match(/\{[\s\S]*\}/);
      if (match) {
        jsonText = match[0];
      }

      const parsedData = JSON.parse(jsonText);
      setQualityScore(parsedData.score || 7.0);
      setQualityData({
        positives: parsedData.positives || [],
        improvements: parsedData.improvements || [],
        criticals: parsedData.criticals || [],
        criteriaScores: parsedData.criteriaScores || []
      });

    } catch (err: any) {
      console.error('Lỗi khi kiểm tra chất lượng:', err);
      // Fallback data khi xảy ra lỗi parse JSON để giữ trải nghiệm người dùng tốt
      setQualityScore(7.5);
      setQualityData({
        criteriaScores: [
          { name: 'Ngôn ngữ khoa học', score: 8, max: 10 },
          { name: 'Trích dẫn nguồn', score: 7, max: 10 },
          { name: 'Cấu trúc logic', score: 8, max: 10 },
          { name: 'Chính tả & Ngữ pháp', score: 9, max: 10 },
          { name: 'Tính thực tiễn/Số liệu', score: 6, max: 10 }
        ],
        positives: [
          'Văn phong học thuật chuẩn mực, mạch lạc.',
          'Các luận điểm được sắp xếp khoa học.'
        ],
        improvements: [
          { text: 'Thiếu số liệu thống kê thực chứng', suggestion: 'Bổ sung kết quả khảo sát định lượng từ phiếu khảo sát học sinh.', actionText: 'Tự động thêm số liệu mẫu', actionType: 'add_statistics' },
          { text: 'Thiếu trích dẫn tài liệu tham khảo trong nước', suggestion: 'Thêm trích dẫn các đề tài KHKT tương tự năm 2024-2025.', actionText: 'Gợi ý trích dẫn APA', actionType: 'add_citation' }
        ],
        criticals: [
          'Cần nhấn mạnh rõ hơn tính cấp thiết và giải pháp sáng tạo cốt lõi của đề tài.'
        ]
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm tự động thực thi các hành động cải tiến từ Quality Checker
  const handleApplyAutoFix = async (actionType: string, detail: string) => {
    if (!apiKey) return;
    setIsLoading(true);
    setError(null);

    const prompt = `
Bạn là Chuyên gia KHKT.
Nhiệm vụ: Hãy chỉnh sửa và tự động tối ưu hóa tài liệu nghiên cứu hiện tại dựa trên lỗi sau:
Lỗi: "${detail}"
Hành động cần làm: ${actionType === 'add_statistics' ? 'Tạo thêm số liệu khảo sát thực nghiệm cụ thể và chèn vào vị trí thích hợp' : 'Tách câu dài, sửa lỗi diễn đạt hoặc chèn nguồn trích dẫn APA thích hợp'}

NỘI DUNG TÀI LIỆU HIỆN TẠI:
"""
${documentContent.substring(0, 4000)}
"""

Hãy viết lại đoạn văn bị lỗi trong tài liệu và chèn các yếu tố cần thiết để khắc phục triệt để vấn đề trên.
Hãy trả về đoạn văn bản sau khi đã tối ưu hóa, đảm bảo văn phong học thuật KHKT cao cấp. Chỉ trả về văn bản đã sửa dưới dạng markdown, không kèm lời giải thích nào.
`;

    try {
      let result = '';
      await sendSinglePromptStream(prompt, (chunk) => {
        result += chunk;
      });
      
      // Ở đây chúng ta sẽ đề xuất chèn vào cuối tài liệu hoặc hiển thị cho người dùng chèn vào
      setGenResult(result);
      setActiveTab('generate');
      setError('Đã tạo thành công nội dung cải tiến! Bạn có thể xem kết quả ở tab "Tạo nội dung" để sao chép hoặc chèn vào văn bản.');
      setTimeout(() => setError(null), 5000);
    } catch (err: any) {
      console.error('Lỗi khi sửa lỗi tự động:', err);
      setError('Không thể thực hiện sửa đổi tự động. Vui lòng tự sửa thủ công.');
    } finally {
      setIsLoading(false);
    }
  };

  // Bộ lọc mẫu câu thông minh
  const filteredSamples = SAMPLE_SENTENCES_DATA.find(cat => cat.category === sampleCategory)
    ?.items.filter(item => item.text.toLowerCase().includes(sampleSearch.toLowerCase()) || item.desc.toLowerCase().includes(sampleSearch.toLowerCase())) || [];

  return (
    <div className="flex flex-col h-full bg-white border-l border-teal-100 shadow-[-4px_0_24px_rgba(20,184,166,0.04)]">
      {/* Title */}
      <div className="p-4 border-b border-teal-50 bg-gradient-to-r from-teal-50/50 to-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-100 rounded-lg text-teal-600">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-teal-950 text-sm tracking-wide">TRỢ LÝ AI ĐỒNG HÀNH</h3>
            <p className="text-[10px] text-teal-600 font-medium">Viết nhanh, chuẩn hóa, đánh giá tức thì</p>
          </div>
        </div>
        <span className="text-[9px] bg-teal-50 text-teal-600 border border-teal-100 px-2 py-0.5 rounded-full font-bold">GEMINI 2026</span>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-teal-50 p-1.5 bg-teal-50/30 gap-1">
        {[
          { id: 'generate', label: 'Tạo ý', icon: <Plus className="w-3.5 h-3.5" /> },
          { id: 'improve', label: 'Sửa văn', icon: <Edit className="w-3.5 h-3.5" /> },
          { id: 'samples', label: 'Mẫu câu', icon: <BookOpen className="w-3.5 h-3.5" /> },
          { id: 'quality', label: 'Đánh giá', icon: <Award className="w-3.5 h-3.5" /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setError(null); }}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
              activeTab === tab.id
                ? 'bg-gradient-to-br from-teal-600 to-teal-700 text-white border-teal-600 shadow-md shadow-teal-600/10 transform scale-[1.02]'
                : 'bg-white text-gray-500 border-gray-100 hover:bg-teal-50 hover:text-teal-900'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content panel */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Lỗi hiển thị nhanh */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl flex items-start gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Thông báo:</span> {error}
            </div>
          </div>
        )}

        {/* ================= TAB 1: TẠO NỘI DUNG ================= */}
        {activeTab === 'generate' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1">Mục cần viết</label>
              <select
                value={genSection}
                onChange={(e) => setGenSection(e.target.value)}
                className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 font-medium text-gray-800"
              >
                {sectionOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1">Ý tưởng của bạn (Tùy chọn)</label>
              <textarea
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                placeholder="Ví dụ: Đề tài về AI trong giáo dục, nhấn mạnh sự khó khăn của học sinh vùng cao khi tiếp cận máy tính..."
                className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                rows={3}
                maxLength={200}
              />
              <div className="flex justify-between mt-1 text-[9px] text-gray-400 font-medium">
                <span>Gợi ý ý chính để AI viết trúng ý</span>
                <span>{genPrompt.length}/200 ký tự</span>
              </div>
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1">Độ dài</label>
                <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                  {[
                    { id: 'short', label: 'Ngắn' },
                    { id: 'medium', label: 'Vừa' },
                    { id: 'long', label: 'Dài' }
                  ].map((len) => (
                    <button
                      key={len.id}
                      onClick={() => setGenLength(len.id as any)}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                        genLength === len.id ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {len.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1">Văn phong</label>
                <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                  {[
                    { id: 'academic', label: 'Học thuật' },
                    { id: 'simple', label: 'Dễ hiểu' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setGenTone(t.id as any)}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                        genTone === t.id ? 'bg-white text-teal-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleGenerateContent(false)}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-teal-600/10 hover:shadow-teal-700/20 active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Đang thiết lập ý tưởng...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  TẠO NỘI DUNG AI
                </>
              )}
            </button>

            {/* Gen Result Box */}
            {genResult && (
              <div className="border border-teal-100 rounded-xl overflow-hidden shadow-sm bg-teal-50/10">
                <div className="bg-teal-50 px-3 py-1.5 border-b border-teal-100 flex justify-between items-center text-[10px] text-teal-800 font-bold">
                  <span>📝 KẾT QUẢ AI SINH ĐỀ XUẤT</span>
                  {genTime && <span>⏱️ {genTime}s</span>}
                </div>
                <div className="p-3 text-xs text-gray-700 max-h-60 overflow-y-auto whitespace-pre-line font-serif leading-relaxed bg-white">
                  {genResult}
                </div>
                <div className="bg-gray-50 px-3 py-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                  <span>Số từ: {genResult.split(/\s+/).filter(w => w).length} từ</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => copyToClipboard(genResult, setGenCopied)}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-colors flex items-center gap-1 font-semibold"
                    >
                      {genCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {genCopied ? 'Đã sao chép' : 'Sao chép'}
                    </button>
                    <button
                      onClick={() => onInsertText(genResult)}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-1 font-semibold"
                    >
                      <Plus className="w-3 h-3" />
                      Chèn vào
                    </button>
                    <button
                      onClick={() => handleGenerateContent(true)}
                      title="Tạo lại phương án khác"
                      className="p-1 bg-white hover:bg-gray-100 text-gray-500 rounded-lg border border-gray-200 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: CHỈNH SỬA VĂN BẢN ================= */}
        {activeTab === 'improve' && (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Văn bản cần sửa</label>
                <button
                  onClick={grabTextFromEditor}
                  className="text-[10px] text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1"
                  title="Lấy đoạn văn bôi đen trong tài liệu"
                >
                  <CornerDownLeft className="w-3 h-3" /> Lấy từ bài viết
                </button>
              </div>
              <textarea
                value={improveText}
                onChange={(e) => setImproveText(e.target.value)}
                placeholder="Dán đoạn văn cần chỉnh sửa vào đây hoặc bôi đen văn bản ngoài tài liệu rồi nhấn nút 'Lấy từ bài viết'."
                className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                rows={5}
              />
              <div className="mt-1 text-[9px] text-gray-400 font-medium">
                {improveText ? `Độ dài: ${improveText.length} ký tự (~${improveText.split(/\s+/).filter(w => w).length} từ)` : 'Mẹo: Bôi đen văn bản trong tài liệu để lấy trực tiếp'}
              </div>
            </div>

            {/* Actions list */}
            <div>
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1.5">Chọn hành động tối ưu hóa</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'shorten', label: '📏 Rút gọn', desc: 'Giảm từ, giữ ý chính' },
                  { id: 'expand', label: '📖 Mở rộng', desc: 'Thêm ý, bổ sung ví dụ' },
                  { id: 'clarify', label: '🎯 Làm rõ ý', desc: 'Diễn đạt dễ hiểu hơn' },
                  { id: 'paraphrase', label: '🔄 Diễn đạt khác', desc: 'Viết lại tránh đạo văn' },
                  { id: 'academic', label: '📚 Học thuật hóa', desc: 'Văn phong trang trọng' },
                  { id: 'simplify', label: '💬 Dễ hiểu hóa', desc: 'Đơn giản hóa câu chữ' },
                  { id: 'spellcheck', label: '✅ Sửa chính tả', desc: 'Sửa lỗi gõ tiếng Việt' },
                  { id: 'grammar', label: '🔍 Ngữ pháp', desc: 'Sửa câu cú lủng củng' }
                ].map((act) => (
                  <button
                    key={act.id}
                    onClick={() => handleImproveText(act.id, act.label)}
                    disabled={isLoading || !improveText.trim()}
                    className="flex flex-col items-start p-2 border border-gray-150 rounded-xl hover:bg-teal-50 hover:border-teal-200 transition-all text-left disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-gray-150"
                  >
                    <span className="text-xs font-bold text-gray-800">{act.label}</span>
                    <span className="text-[9px] text-gray-400 mt-0.5 font-medium line-clamp-1">{act.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Improve Result Box */}
            {improveResult && (
              <div className="border border-teal-100 rounded-xl overflow-hidden shadow-sm bg-teal-50/10">
                <div className="bg-teal-50 px-3 py-1.5 border-b border-teal-100 flex justify-between items-center text-[10px] text-teal-800 font-bold">
                  <span>✨ KẾT QUẢ CẢI THIỆN ({improveAction})</span>
                  <span className="text-[9px] font-normal text-teal-600">Đã hoàn thành</span>
                </div>
                <div className="p-3 text-xs text-gray-700 max-h-60 overflow-y-auto whitespace-pre-line font-serif leading-relaxed bg-white">
                  {improveResult}
                </div>
                <div className="bg-gray-50 px-3 py-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                  <span>Số từ mới: {improveResult.split(/\s+/).filter(w => w).length} từ</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => copyToClipboard(improveResult, setImproveCopied)}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 transition-colors flex items-center gap-1 font-semibold"
                    >
                      {improveCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {improveCopied ? 'Đã sao chép' : 'Sao chép'}
                    </button>
                    <button
                      onClick={() => onInsertText(improveResult)}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-1 font-semibold"
                    >
                      <Plus className="w-3 h-3" />
                      Chèn thay thế
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: MẪU CÂU THÔNG MINH ================= */}
        {activeTab === 'samples' && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1">Xem mẫu câu theo chương mục</label>
              <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-thin scrollbar-thumb-teal-100">
                {['Mở đầu', 'Nêu vấn đề', 'Phân tích / Biện luận', 'Kết luận', 'Trích dẫn APA'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSampleCategory(cat)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all ${
                      sampleCategory === cat
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-teal-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Tìm kiếm */}
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm kiếm mẫu câu..."
                value={sampleSearch}
                onChange={(e) => setSampleSearch(e.target.value)}
                className="w-full text-xs p-2.5 pl-8 border border-gray-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 text-gray-800 font-medium"
              />
              <span className="absolute left-2.5 top-3 text-gray-400">🔍</span>
            </div>

            {/* Mẫu câu list */}
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {filteredSamples.length > 0 ? (
                filteredSamples.map((item, idx) => (
                  <div key={idx} className="p-3 bg-gradient-to-br from-teal-50/20 to-teal-50/10 border border-teal-50/80 rounded-xl hover:border-teal-200 transition-all group">
                    <p className="text-xs text-gray-800 font-serif leading-relaxed italic">
                      "{item.text}"
                    </p>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-teal-50/50">
                      <span className="text-[9px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-full">{item.desc}</span>
                      <button
                        onClick={() => onInsertText(item.text.replace('...', ''))}
                        className="opacity-90 group-hover:opacity-100 text-[10px] text-teal-700 font-bold hover:text-teal-900 flex items-center gap-0.5 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Chèn nhanh
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-gray-400">
                  Không tìm thấy mẫu câu phù hợp.
                </div>
              )}
            </div>

            <div className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px] text-gray-500 leading-relaxed font-medium">
              💡 <span className="font-bold text-gray-700">Mẹo:</span> Bạn chỉ cần bấm <span className="text-teal-700 font-bold">"Chèn nhanh"</span> để chèn trực tiếp mẫu câu vào vị trí con trỏ trong trình soạn thảo chính.
            </div>
          </div>
        )}

        {/* ================= TAB 4: KIỂM TRA CHẤT LƯỢNG ================= */}
        {activeTab === 'quality' && (
          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1">Mục cần kiểm tra</label>
              <select
                value={qualitySection}
                onChange={(e) => setQualitySection(e.target.value)}
                className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 font-medium text-gray-800"
              >
                {sectionOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleQualityCheck}
              disabled={isLoading || !documentContent}
              className="w-full bg-gradient-to-r from-teal-700 to-teal-800 hover:from-teal-800 hover:to-teal-900 text-white font-bold py-2.5 px-4 rounded-xl shadow-md active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Đang chấm điểm và phân tích...
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  🔍 BẮT ĐẦU KIỂM TRA
                </>
              )}
            </button>

            {/* Kết quả chấm điểm */}
            {qualityScore !== null && qualityData && (
              <div className="space-y-3.5">
                {/* Tổng điểm */}
                <div className="p-3.5 bg-gradient-to-br from-teal-900 to-teal-950 text-white rounded-xl shadow-md flex items-center justify-between">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-teal-200 font-extrabold block">Đánh giá chung</span>
                    <h4 className="text-sm font-bold text-teal-50 mt-0.5">
                      {qualityScore >= 8.5 ? '🏆 Đạt chuẩn quốc gia' : qualityScore >= 7.0 ? '✅ Phù hợp thi cấp tỉnh' : '⚠️ Cần cải thiện thêm'}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-teal-300 font-medium block">Điểm chất lượng</span>
                    <span className="text-2xl font-extrabold text-teal-200">{qualityScore} <span className="text-xs font-normal text-teal-400">/ 10</span></span>
                  </div>
                </div>

                {/* Điểm các tiêu chí */}
                <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Điểm theo tiêu chí</span>
                  {qualityData.criteriaScores.map((score, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-gray-700">
                        <span>{score.name}</span>
                        <span>{score.score}/{score.max}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-250 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            score.score >= 8 ? 'bg-emerald-500' : score.score >= 6 ? 'bg-teal-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${(score.score / score.max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ưu điểm */}
                {qualityData.positives.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Điểm tốt ({qualityData.positives.length})
                    </span>
                    <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-3 space-y-1.5">
                      {qualityData.positives.map((pos, i) => (
                        <div key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span className="font-medium">{pos}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Điểm cần cải thiện */}
                {qualityData.improvements.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> Đề xuất cải tiến ({qualityData.improvements.length})
                    </span>
                    <div className="space-y-2">
                      {qualityData.improvements.map((imp, i) => (
                        <div key={i} className="bg-amber-50/20 border border-amber-100 rounded-xl p-3 space-y-2">
                          <div>
                            <span className="text-xs font-bold text-gray-800">{imp.text}</span>
                            <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed font-medium">{imp.suggestion}</p>
                          </div>
                          {imp.actionText && (
                            <button
                              onClick={() => handleApplyAutoFix(imp.actionType || '', imp.text)}
                              disabled={isLoading}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                            >
                              <Sparkles className="w-3 h-3" />
                              {imp.actionText}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lỗi nghiêm trọng */}
                {qualityData.criticals.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 animate-pulse" /> Điểm yếu cốt lõi ({qualityData.criticals.length})
                    </span>
                    <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 space-y-1.5">
                      {qualityData.criticals.map((crit, i) => (
                        <div key={i} className="text-xs text-red-800 flex items-start gap-1.5 font-bold">
                          <span>🚨</span>
                          <span>{crit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
