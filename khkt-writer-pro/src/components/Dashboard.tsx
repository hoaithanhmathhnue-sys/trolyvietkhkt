import { useAppStore } from '../store/useAppStore';
import { PlusCircle, FileText, Library, Trash2, Edit3 } from 'lucide-react';

export default function Dashboard() {
  const { projects, setView, setCurrentProject, deleteProject } = useAppStore();

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12 space-y-12">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">KHKT Writer Pro</h1>
          <p className="text-slate-500 mt-2">Trợ lý viết đề tài Khoa học Kỹ thuật thông minh</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setView('library')}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm font-medium"
          >
            <Library size={18} />
            Thư viện mẫu
          </button>
          <button 
            onClick={() => setView('wizard')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold shadow-sm"
          >
            <PlusCircle size={18} />
            Tạo dự án mới
          </button>
        </div>
      </header>

      <main>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Dự án của bạn</h2>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-24 border border-slate-200 rounded-2xl bg-white shadow-sm">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-sm font-bold text-slate-900">Chưa có dự án nào</h3>
            <p className="mt-1 text-sm text-slate-500">Bắt đầu bằng cách tạo dự án mới hoặc sử dụng thư viện mẫu.</p>
            <div className="mt-6">
              <button
                onClick={() => setView('wizard')}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition-colors"
              >
                <PlusCircle size={16} />
                Tạo dự án mới
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all hover:border-indigo-300">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 line-clamp-1" title={project.title}>
                      {project.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium tracking-wide mt-1 uppercase">{project.field || 'Chưa xác định lĩnh vực'}</p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    <span>Tiến độ</span>
                    <span>{project.progress}%</span>
                  </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${project.progress}%` }}></div>
                  </div>
                </div>

                <div className="mt-6 flex justify-between items-center border-t border-slate-100 pt-4">
                  <span className="text-xs font-medium text-slate-400">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => deleteProject(project.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Xóa"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      onClick={() => setCurrentProject(project.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-indigo-700 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
                    >
                      <Edit3 size={14} />
                      Tiếp tục
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
