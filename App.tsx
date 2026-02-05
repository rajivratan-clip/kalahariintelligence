import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Search, 
  Activity, 
  Menu,
  ChevronRight,
  ChevronLeft,
  Settings,
  Bell
} from 'lucide-react';
import FunnelLab from './components/FunnelLab';
import SegmentStudio from './components/SegmentStudio';
import FrictionForensic from './components/FrictionForensic';
import AskAISidebar from './components/AskAISidebar';
import { ViewMode, AiContext } from './types';

const App = () => {
  const [activeView, setActiveView] = useState<ViewMode>('funnel');
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AiContext | null>(null);
  // Default to collapsed to prioritize workspace area as requested
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const handleExplain = (title: string, data: any) => {
    setAiContext({
      contextName: title,
      data: data,
      prompt: `Analyze this ${title} data. Identify specific revenue leaks and user friction points. Data: ${JSON.stringify(data)}`
    });
    setIsAiOpen(true);
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAiOpen(true);
    // In a real app, this would pass the search term to the AI
  };

  const NavItem = ({ icon, label, id, onClick }: { icon: React.ReactNode, label: string, id: ViewMode, onClick: () => void }) => (
    <button 
      onClick={onClick}
      title={isSidebarCollapsed ? label : undefined}
      className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-3'} py-3 rounded-lg transition-colors mb-1 ${
        activeView === id ? 'bg-brand-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
      }`}
    >
      <div className="flex-shrink-0">{icon}</div>
      {!isSidebarCollapsed && (
        <span className="ml-3 font-medium whitespace-nowrap overflow-hidden transition-all duration-200">
          {label}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      
      {/* Collapsible Sidebar */}
      <aside 
        className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out relative border-r border-slate-800 z-20`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-8 bg-slate-800 text-slate-400 rounded-full p-1 border border-slate-700 shadow-sm hover:text-white hover:bg-slate-700 z-50 focus:outline-none transition-transform"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Logo Area */}
        <div className={`h-16 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'px-6'} border-b border-slate-800`}>
          <Activity className="text-brand-500 flex-shrink-0" size={24} />
          {!isSidebarCollapsed && (
             <span className="ml-3 text-white font-bold text-xl tracking-tight truncate">ResortIQ</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {!isSidebarCollapsed && (
             <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4 whitespace-nowrap">Discovery</p>
          )}
          
          <NavItem 
            id="funnel"
            label="Funnel Lab" 
            icon={<LayoutDashboard size={20} />} 
            onClick={() => setActiveView('funnel')}
          />
          <NavItem 
            id="segment"
            label="Segment Studio" 
            icon={<Users size={20} />} 
            onClick={() => setActiveView('segment')}
          />
          <NavItem 
            id="friction"
            label="Friction Forensic" 
            icon={<Activity size={20} />} 
            onClick={() => setActiveView('friction')}
          />
        </nav>

        {/* Footer / Config */}
        <div className="p-3 border-t border-slate-800">
          <button 
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-start px-3'} py-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800`}
            title={isSidebarCollapsed ? "Configuration" : undefined}
          >
            <Settings size={20} />
            {!isSidebarCollapsed && <span className="ml-3 text-sm">Configuration</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar / Command Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
             <button className="lg:hidden text-slate-500">
               <Menu size={20} />
             </button>
             
             {/* AI Command Bar */}
             <form onSubmit={handleGlobalSearch} className="flex-1 max-w-2xl relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={18} />
                <input 
                  type="text" 
                  placeholder="AskAI: Why did revenue dip yesterday?" 
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-lg text-sm transition-all outline-none"
                />
             </form>
          </div>

          <div className="flex items-center gap-4 ml-4">
             <button className="relative text-slate-400 hover:text-slate-600">
                <Bell size={20} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
             </button>
             <div className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 overflow-hidden">
                <img src="https://picsum.photos/100/100" alt="User" className="w-full h-full object-cover" />
             </div>
          </div>
        </header>

        {/* Dynamic Workspace */}
        <main className="flex-1 overflow-hidden relative">
          {activeView === 'funnel' && <FunnelLab onExplain={handleExplain} />}
          {activeView === 'segment' && <SegmentStudio onExplain={handleExplain} />}
          {activeView === 'friction' && <FrictionForensic />}
        </main>
      </div>

      {/* AskAI Sidebar Drawer */}
      <AskAISidebar 
        isOpen={isAiOpen} 
        onClose={() => setIsAiOpen(false)} 
        context={aiContext}
      />
      
      {/* Overlay for Sidebar on mobile */}
      {isAiOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsAiOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default App;