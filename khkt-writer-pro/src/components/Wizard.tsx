import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ArrowRight, ArrowLeft, Bot, CheckCircle2, ChevronDown } from 'lucide-react';

const fields = [
  "Vật lý - Kỹ thuật",
  "Tin học - Phần mềm",
  "Hóa - Sinh",
  "Vật liệu - Môi trường",
  "Khoa học xã hội và hành vi"
];
const levels = ["Cấp trường", "Cấp tỉnh/thành phố", "Cấp quốc gia"];

export default function Wizard() {
  const { createProject, setView } = useAppStore();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({
    title: '',
    field: '',
    level: '',
    members: [''],
    teacher: '',
    problem: '',
    importance: '',
    objectives: [''],
    methods: [],
    hypothesis: '',
    results: ''
  });

  const update = (key: string, value: any) => setFormData({ ...formData, [key]: value });

  const handleNext = () => setStep(s => Math.min(5, s + 1));
  const handlePrev = () => setStep(s => Math.max(1, s - 1));
  const handleFinish = () => {
    createProject({
      ...formData,
      content: {
        introduction: {
          hypothesis: formData.hypothesis,
          reason: '', purpose: '', questions: ''
        }
      } as any
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-12">
      <div className="mb-8">
        <button onClick={() => setView('dashboard')} className="text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 flex items-center gap-1">
          <ArrowLeft size={16} /> Quay lại Dashboard
        </button>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Tạo dự án mới</h2>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">Bước {step}/5</span>
        </div>
        <div className="flex gap-2 mt-6">
          {[1,2,3,4,5].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-indigo-500' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tên đề tài</label>
              <input 
                type="text" 
                value={formData.title} 
                onChange={e => update('title', e.target.value)}
                placeholder="VD: Nghiên cứu ứng dụng..." 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl shadow-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 p-3 outline-none transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider text-xs">Lĩnh vực</label>
                <div className="relative">
                  <select 
                    value={formData.field} 
                    onChange={e => update('field', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-3 appearance-none outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                  >
                    <option value="">Chọn lĩnh vực...</option>
                    {fields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider text-xs">Cấp độ tham gia</label>
                <div className="relative">
                  <select 
                    value={formData.level} 
                    onChange={e => update('level', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-3 appearance-none outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                  >
                    <option value="">Chọn cấp độ...</option>
                    {levels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider text-xs">Người hướng dẫn</label>
              <input 
                type="text" 
                value={formData.teacher} 
                onChange={e => update('teacher', e.target.value)}
                placeholder="Tên giáo viên/chuyên gia hướng dẫn" 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl shadow-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 p-3 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex items-center justify-between p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-indigo-900 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Bot size={18} />
                </div>
                <span className="text-sm font-bold">Bật gợi ý AI cho nội dung này</span>
              </div>
              <div className="w-10 h-6 bg-indigo-500 rounded-full relative cursor-pointer shadow-inner">
                <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 shadow-sm"></div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Vấn đề bạn muốn giải quyết là gì?</label>
              <textarea 
                value={formData.problem} 
                onChange={e => update('problem', e.target.value)}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-3 outline-none resize-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800"
                placeholder="Mô tả ngắn gọn vấn đề thực tiễn..."
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tại sao vấn đề này quan trọng?</label>
              <textarea 
                value={formData.importance} 
                onChange={e => update('importance', e.target.value)}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-3 outline-none resize-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800"
                placeholder="Ý nghĩa thực tiễn khi giải quyết được vấn đề này..."
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Mục tiêu nghiên cứu</label>
              {formData.objectives.map((obj: string, i: number) => (
                <div key={i} className="flex gap-2 mb-3">
                  <input 
                    type="text" 
                    value={obj}
                    onChange={(e) => {
                      const newObj = [...formData.objectives];
                      newObj[i] = e.target.value;
                      update('objectives', newObj);
                    }}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-3 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800"
                    placeholder={`Mục tiêu ${i + 1}`}
                  />
                  {i === formData.objectives.length - 1 && (
                    <button 
                      onClick={() => update('objectives', [...formData.objectives, ''])}
                      className="px-4 text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm"
                    >
                      Thêm
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Phương pháp sử dụng</label>
              <div className="grid grid-cols-2 gap-3">
                {['Khảo sát bảng hỏi', 'Phỏng vấn sâu', 'Thực nghiệm', 'Quan sát', 'Phân tích tài liệu', 'Khác'].map(method => (
                  <label key={method} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-600"
                      checked={formData.methods.includes(method)}
                      onChange={(e) => {
                        const newMethods = e.target.checked 
                          ? [...formData.methods, method]
                          : formData.methods.filter((m: string) => m !== method);
                        update('methods', newMethods);
                      }}
                    />
                    <span className="text-sm font-medium text-slate-800">{method}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Giả thuyết khoa học</label>
              <textarea 
                value={formData.hypothesis} 
                onChange={e => update('hypothesis', e.target.value)}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-3 outline-none resize-none mb-2 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800"
                placeholder="Nếu... thì..."
              />
              {formData.hypothesis.length > 10 && (
                <div className="flex gap-2 items-start p-3 bg-emerald-50 text-emerald-800 text-sm font-medium rounded-xl border border-emerald-100 shadow-sm mt-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>Giả thuyết có vẻ rõ ràng và có thể kiểm chứng. Bạn có thể chi tiết hóa thêm bằng số liệu kỳ vọng.</span>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 mt-4">Kết quả dự kiến đạt được</label>
              <textarea 
                value={formData.results} 
                onChange={e => update('results', e.target.value)}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-3 outline-none resize-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-800"
                placeholder="Mô tả sản phẩm/giải pháp dự kiến cuối cùng..."
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-300 text-center py-6">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-indigo-200">
              <Bot size={32} />
            </div>
            <h3 className="text-3xl font-bold text-slate-900 mb-2">Sẵn sàng tạo dự án!</h3>
            <p className="text-slate-500 mb-8 max-w-md mx-auto text-sm font-medium">
              AI đã ghi nhận thông tin dự án "{formData.title || 'Dự án mới'}". Bạn muốn bắt đầu từ đâu?
            </p>
            
            <div className="space-y-4 max-w-sm mx-auto text-left">
              <label className="flex items-start gap-4 p-5 border-2 border-indigo-500 bg-indigo-50 rounded-2xl cursor-pointer shadow-sm relative">
                <input type="radio" name="template" defaultChecked className="mt-1 flex-shrink-0 text-indigo-600 focus:ring-indigo-500" />
                <div>
                  <div className="font-bold text-indigo-900 text-sm">Template chuẩn AI</div>
                  <div className="text-xs text-indigo-700/80 mt-1.5 leading-relaxed font-medium">Cấu trúc đề tài hoàn chỉnh, kèm theo gợi ý nội dung cho từng phần và checklist theo dõi tiến độ.</div>
                </div>
              </label>
              <label className="flex items-start gap-4 p-5 border border-slate-200 bg-white rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input type="radio" name="template" className="mt-1 flex-shrink-0 text-slate-600 focus:ring-slate-500" />
                <div>
                  <div className="font-bold text-slate-800 text-sm">Template trống</div>
                  <div className="text-xs text-slate-500 mt-1.5 font-medium">Chỉ tạo thư mục gốc, tự viết từ đầu.</div>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between items-center px-2">
        <button 
          onClick={handlePrev}
          disabled={step === 1}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-colors ${step === 1 ? 'text-slate-300 cursor-not-allowed hidden' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 bg-white shadow-sm'}`}
        >
          <ArrowLeft size={18} /> Quay lại
        </button>
        
        {step < 5 ? (
          <button 
            onClick={handleNext}
            className="flex items-center gap-2 px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-sm ml-auto"
          >
            Tiếp tục <ArrowRight size={18} />
          </button>
        ) : (
          <button 
             onClick={handleFinish}
            className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-sm hover:bg-indigo-700 hover:scale-[1.02] transition-all ml-auto"
          >
            Tạo dự án 🚀
          </button>
        )}
      </div>
    </div>
  );
}
