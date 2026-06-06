import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Bot, Save, FileDown, LogOut, FileText, CheckCircle2, ChevronRight, PenTool, BarChart3, ListChecks } from 'lucide-react';
import { cn } from '../lib/utils';
import { Project } from '../types';

interface QualityCheck {
  total: number;
  scores: any;
  issues: any[];
  strengths: string[];
}

export default function Editor() {
  const { view, setView, projects, currentProjectId, updateProjectContent } = useAppStore();
  const project = projects.find(p => p.id === currentProjectId);
  
  const [activeTab, setActiveTab] = useState('structure');
  const [currentSection, setCurrentSection] = useState<{group: 'introduction'|'body'|'conclusion'|'appendix', section: string}>({ group: 'introduction', section: 'reason' });
  const [localContent, setLocalContent] = useState('');
  
  // AI States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [qualityCheck, setQualityCheck] = useState<QualityCheck | null>(null);

  useEffect(() => {
    if (project) {
      setLocalContent(project.content[currentSection.group][currentSection.section as keyof typeof project.content[typeof currentSection.group]] as string || '');
    }
  }, [currentSection, project]);

  if (!project) return null;

  const sectionTitles: any = {
    introduction: {
      reason: '1. Lý do chọn đề tài',
      purpose: '2. Mục tiêu nghiên cứu',
      questions: '3. Câu hỏi nghiên cứu',
      hypothesis: '4. Giả thuyết khoa học'
    },
    body: {
      chapter1: 'Chương 1: Cơ sở lý luận',
      chapter2: 'Chương 2: Thực trạng',
      chapter3: 'Chương 3: Giải pháp',
      chapter4: 'Chương 4: Kết quả'
    }
  };

  const handleSave = () => {
    updateProjectContent(currentSection.group, currentSection.section, localContent);
  };

  const generateAIContent = async () => {
    setAiLoading(true);
    setAiResponse('');
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: sectionTitles[currentSection.group][currentSection.section],
          projectInfo: { title: project.title, field: project.field, problem: project.problem }
        })
      });
      const data = await res.json();
      setAiResponse(data.content || 'Error generating content');
    } catch (err) {
      setAiResponse('Không thể kết nối tới server AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const checkQuality = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: sectionTitles[currentSection.group][currentSection.section],
          text: localContent
        })
      });
      const data = await res.json();
      setQualityCheck(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Left Sidebar - Structure */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 flex items-center gap-2 text-slate-800 font-bold cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100" onClick={() => setView('dashboard')}>
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 shadow-sm">
            <LogOut size={14} />
          </div>
          Dashboard
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Cấu trúc đề tài</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                <ChevronRight size={14} className="rotate-90 text-slate-400" /> A. MỞ ĐẦU
              </div>
              <div className="pl-6 space-y-1">
                {Object.entries(sectionTitles.introduction).map(([key, title]) => (
                  <button 
                    key={key}
                    onClick={() => setCurrentSection({ group: 'introduction', section: key })}
                    className={cn(
                      "w-full text-left text-sm py-2 px-3 rounded-xl transition-colors font-medium border border-transparent",
                      currentSection.group === 'introduction' && currentSection.section === key ? "bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm font-bold" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                    )}
                  >
                    {title as string}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2 mt-6 uppercase tracking-wide">
                <ChevronRight size={14} className="rotate-90 text-slate-400" /> B. NỘI DUNG
              </div>
              <div className="pl-6 space-y-1">
                {Object.entries(sectionTitles.body).map(([key, title]) => (
                  <button 
                    key={key}
                    onClick={() => setCurrentSection({ group: 'body', section: key })}
                    className={cn(
                      "w-full text-left text-sm py-2 px-3 rounded-xl transition-colors font-medium border border-transparent",
                      currentSection.group === 'body' && currentSection.section === key ? "bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm font-bold" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-transparent"
                    )}
                  >
                    {title as string}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Editor Center */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
        <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <span>{project.title}</span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="font-bold text-slate-800">{sectionTitles[currentSection.group][currentSection.section]}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
              <Save size={16} /> Lưu
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 shadow-sm transition-colors">
              <FileDown size={16} /> Xuất file
            </button>
          </div>
        </div>

        {/* Toolbar Mock */}
        <div className="h-12 flex items-center px-6 gap-4 border-b border-slate-100 bg-slate-50">
          <div className="flex gap-1.5">
            <button className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-lg font-bold text-slate-700 transition-all">B</button>
            <button className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-lg italic text-slate-700 transition-all">I</button>
            <button className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-lg underline text-slate-700 transition-all">U</button>
          </div>
          <div className="w-px h-5 bg-slate-300 mx-2" />
          <div className="flex gap-1.5 text-sm font-bold">
            <button className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-lg text-slate-700 transition-all">H1</button>
            <button className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-lg text-slate-700 transition-all">H2</button>
          </div>
          <div className="w-px h-5 bg-slate-300 mx-2" />
          <div className="flex gap-1.5">
             <button className="px-2 py-1.5 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm rounded-lg text-sm font-bold text-slate-700 transition-all flex gap-1.5 items-center"><BarChart3 size={16}/> Biểu đồ</button>
          </div>
        </div>

        <div className="flex-1 p-10 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-slate-900 mb-8">{sectionTitles[currentSection.group][currentSection.section]}</h1>
            <textarea 
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              className="w-full h-full min-h-[500px] resize-none outline-none text-slate-800 placeholder-slate-300 text-lg leading-relaxed bg-transparent"
              placeholder="Bắt đầu viết nội dung của bạn tại đây..."
            />
          </div>
        </div>
      </div>

      {/* Right Sidebar - AI Panel */}
      <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col">
        <div className="flex border-b border-slate-200 bg-white">
          <button onClick={() => setActiveTab('ai')} className={cn("flex-1 py-3.5 text-[13px] font-bold border-b-2 transition-colors", activeTab === 'ai' ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
            <div className="flex items-center justify-center gap-2 uppercase tracking-wider"><Bot size={16}/> Trợ lý AI</div>
          </button>
          <button onClick={() => setActiveTab('tools')} className={cn("flex-1 py-3.5 text-[13px] font-bold border-b-2 transition-colors", activeTab === 'tools' ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
            <div className="flex items-center justify-center gap-2 uppercase tracking-wider"><ListChecks size={16}/> Kiểm tra</div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'ai' && (
            <>
              {/* Generate Section */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><PenTool size={14}/></div> Tạo nội dung tự động
                </h4>
                <p className="text-xs font-medium text-slate-500 mb-4 leading-relaxed">AI sẽ tạo bản nháp dựa trên thông tin dự án của bạn.</p>
                <button 
                  onClick={generateAIContent}
                  disabled={aiLoading}
                  className="w-full py-2.5 bg-slate-900 border border-transparent text-white rounded-xl text-sm font-bold hover:bg-slate-800 hover:shadow-md transition-all disabled:opacity-50"
                >
                  {aiLoading ? 'Đang tạo nội dung...' : '✨ Tạo nội dung'}
                </button>
              </div>

              {/* Response Section */}
              {aiResponse && (
                <div className="bg-indigo-50 p-5 rounded-2xl shadow-sm border border-indigo-100">
                  <h4 className="text-sm font-bold text-indigo-900 mb-3">Kết quả gợi ý</h4>
                  <div className="text-[13px] font-medium text-slate-700 bg-white p-4 rounded-xl border border-indigo-100 max-h-60 overflow-y-auto mb-4 leading-relaxed shadow-sm">
                    {aiResponse}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setLocalContent(localContent + (localContent ? '\n\n' : '') + aiResponse); handleSave(); }}
                      className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-sm transition-colors"
                    >
                      Chèn vào bài
                    </button>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 mb-3 block">Mẫu câu gợi ý</h4>
                <div className="space-y-2">
                  {['Trong bối cảnh hiện nay...', 'Xuất phát từ thực tiễn...', 'Nhằm giải quyết vấn đề...'].map((s, i) => (
                    <div key={i} className="group flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl border border-slate-100 cursor-pointer transition-colors">
                      <span className="text-sm font-medium text-slate-600 line-clamp-1">{s}</span>
                      <button 
                        onClick={() => setLocalContent(localContent + s)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-indigo-700 font-bold px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg ml-2 whitespace-nowrap shadow-sm transition-all"
                      >
                        Chèn
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'tools' && (
            <>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-baseline gap-2 block"><div className="p-1 bg-indigo-50 rounded text-indigo-600 inline-flex"><ListChecks size={14}/></div>Kiểm tra chất lượng phần này</h4>
                <button 
                  onClick={checkQuality}
                  disabled={aiLoading}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
                >
                  {aiLoading ? 'Đang phân tích...' : 'Kiểm tra ngay'}
                </button>
              </div>

              {qualityCheck && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between mb-5 pb-5 border-b border-slate-100">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest text-[11px]">Điểm tổng quát</span>
                    <span className={cn("text-2xl font-bold", qualityCheck.total >= 7 ? "text-emerald-500" : "text-amber-500")}>
                      {qualityCheck.total}
                    </span>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h5 className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-1.5"><CheckCircle2 size={14}/> Đạt yêu cầu</h5>
                      <ul className="text-[13px] font-medium text-slate-600 space-y-2">
                        {qualityCheck.strengths.map((s, i) => <li key={i} className="flex gap-2 items-start"><span className="text-emerald-400 mt-0.5">•</span> {s}</li>)}
                      </ul>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <h5 className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-1.5"> Cần cải thiện</h5>
                      <div className="space-y-3">
                        {qualityCheck.issues.map((issue, i) => (
                           <div key={i} className="p-4 border border-amber-100 bg-amber-50 rounded-xl">
                             <div className="text-sm font-bold text-slate-800">{issue.message}</div>
                             <div className="text-xs font-semibold text-amber-700 mt-2 bg-amber-100 overflow-hidden rounded p-2">Gợi ý: {issue.suggestion}</div>
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
