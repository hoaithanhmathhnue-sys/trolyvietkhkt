import Dashboard from './components/Dashboard';
import Wizard from './components/Wizard';
import EditorView from './components/EditorView';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const { view } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-200">
      {view === 'dashboard' && <Dashboard />}
      {view === 'wizard' && <Wizard />}
      {view === 'editor' && <EditorView />}
      {view === 'library' && (
        <div className="p-12 text-center text-slate-500 max-w-2xl mx-auto">
           <h2 className="text-2xl font-bold text-slate-800 mb-4">Thư viện mẫu</h2>
           <p>Thư viện chứa các đề tài đạt giải cao đang được cập nhật...</p>
           <button onClick={() => useAppStore.getState().setView('dashboard')} className="mt-6 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Quay lại Dashboard</button>
        </div>
      )}
    </div>
  );
}
