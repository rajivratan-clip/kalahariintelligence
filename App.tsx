import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  Folder,
  Wand2,
  CreditCard,
  Settings,
  User,
  LogOut,
  LayoutDashboard,
  Users,
  Activity,
  Search,
  Menu,
  Bell,
  Sparkles,
} from 'lucide-react';
import FrictionForensic from './components/FrictionForensic';
import AnalyticsStudio from './components/AnalyticsStudio';
import AskAISidebar from './components/AskAISidebar';
import { ViewMode, AiContext, AnalyticsConfigUpdate } from './types';
import { useAiOrchestrator } from './engines/useAiOrchestrator';

const SIDEBAR_BG = '#0947A4';

const VideoGeneratorIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M18.0063 6.60336L22.5375 2.97818C22.6697 2.87228 22.829 2.80588 22.9973 2.7866C23.1655 2.76733 23.3358 2.79598 23.4885 2.86924C23.6411 2.94251 23.77 3.05741 23.8602 3.20072C23.9504 3.34403 23.9983 3.50991 23.9984 3.67925V14.3211C23.9983 14.4904 23.9504 14.6563 23.8602 14.7996C23.77 14.9429 23.6411 15.0578 23.4885 15.1311C23.3358 15.2044 23.1655 15.233 22.9973 15.2137C22.829 15.1945 22.6697 15.1281 22.5375 15.0222L18.0063 11.397"
      fill="none"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.4113 17.3889H3.62562C3.13726 17.4586 2.63939 17.4136 2.17142 17.2576C1.70345 17.1015 1.27822 16.8387 0.929402 16.4899C0.580585 16.1411 0.317754 15.7159 0.161717 15.2479C0.00568045 14.7799 -0.0392787 14.282 0.0303989 13.7937V4.20643C-0.0392787 3.71807 0.00568045 3.2202 0.161717 2.75223C0.317754 2.28426 0.580585 1.85903 0.929402 1.51021C1.27822 1.16139 1.70345 0.898565 2.17142 0.742528C2.63939 0.586491 3.13726 0.541532 3.62562 0.611209H14.4113C14.8996 0.541532 15.3975 0.586491 15.8655 0.742528C16.3335 0.898565 16.7587 1.16139 17.1075 1.51021C17.4563 1.85903 17.7191 2.28426 17.8752 2.75223C18.0312 3.2202 18.0762 3.71807 18.0065 4.20643V13.7937C18.0762 14.282 18.0312 14.7799 17.8752 15.2479C17.7191 15.7159 17.4563 16.1411 17.1075 16.4899C16.7587 16.8387 16.3335 17.1015 15.8655 17.2576C15.3975 17.4136 14.8996 17.4586 14.4113 17.3889Z"
      fill="none"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.87441 5.03558L10.2061 5.95516C10.5741 6.97609 11.3782 7.78018 12.3991 8.14814L13.3187 8.47985C13.4016 8.50995 13.4016 8.62727 13.3187 8.65737L12.3991 8.98908C11.3782 9.35704 10.5741 10.1611 10.2061 11.1821L9.87441 12.1016C9.84431 12.1846 9.72699 12.1846 9.69689 12.1016L9.36518 11.1821C8.99722 10.1611 8.19313 9.35704 7.1722 8.98908L6.25263 8.65737C6.1697 8.62727 6.1697 8.50995 6.25263 8.47985L7.1722 8.14814C8.19313 7.78018 8.99722 6.97609 9.36518 5.95516L9.69689 5.03558C9.72699 4.95266 9.84431 4.95266 9.87441 5.03558Z"
      fill="white"
    />
    <path
      d="M5.82832 9.80331L5.99417 10.2631C6.17815 10.7736 6.5802 11.1756 7.09066 11.3596L7.55045 11.5254C7.59191 11.5405 7.59191 11.5992 7.55045 11.6142L7.09066 11.7801C6.5802 11.964 6.17815 12.3661 5.99417 12.8766L5.82832 13.3363C5.81327 13.3778 5.75461 13.3778 5.73956 13.3363L5.5737 12.8766C5.38972 12.3661 4.98768 11.964 4.47721 11.7801L4.01743 11.6142C3.97596 11.5992 3.97596 11.5405 4.01743 11.5254L4.47721 11.3596C4.98768 11.1756 5.38972 10.7736 5.5737 10.2631L5.73956 9.80331C5.75461 9.76185 5.81327 9.76185 5.82832 9.80331Z"
      fill="white"
    />
  </svg>
);

type NavKey =
  | 'home'
  | 'creations'
  | 'clip-ai'
  | 'video-generator'
  | 'billing'
  | 'analytics'
  | 'funnel'
  | 'segment'
  | 'friction'
  | 'settings'
  | 'profile'
  | 'signout';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 72;

/** Ref for Analytics Studio to register config updates from AI guided build */
type ConfigApplicator = (updates: AnalyticsConfigUpdate) => void;

const App = () => {
  // Default to Analytics Studio as the primary workspace
  const [activeView, setActiveView] = useState<ViewMode>('analytics');
  const [activeNavKey, setActiveNavKey] = useState<NavKey>('analytics');
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AiContext | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const applyConfigRef = useRef<ConfigApplicator | null>(null);
  const [buildSuccessToast, setBuildSuccessToast] = useState<string | null>(null);
  
  const { getActiveSession, ensureDefaultSession } = useAiOrchestrator();

  // Ensure default session exists on mount
  useEffect(() => {
    ensureDefaultSession();
  }, [ensureDefaultSession]);

  const handleExplain = (title: string, data: unknown) => {
    setAiContext({
      contextName: title,
      data: data,
      prompt: `Analyze this ${title} data. Identify specific revenue leaks and user friction points. Data: ${JSON.stringify(data)}`,
    });
    setIsAiOpen(true);
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAiOpen(true);
  };

  const mainMenuItems: Array<{
    key: NavKey;
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }> | React.FC;
    view?: ViewMode;
    customIcon?: boolean;
  }> = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'creations', label: 'Creations', icon: Folder },
    { key: 'clip-ai', label: 'Clip AI', icon: Wand2 },
    { key: 'video-generator', label: 'Video Generator', icon: VideoGeneratorIcon, customIcon: true },
    { key: 'billing', label: 'Billing & Plan', icon: CreditCard },
    { key: 'analytics', label: '⭐ Analytics Studio', icon: LayoutDashboard, view: 'analytics' },
    { key: 'friction', label: 'Friction Forensic', icon: Activity, view: 'friction' },
  ];

  const bottomMenuItems: Array<{ key: NavKey; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'signout', label: 'Sign out', icon: LogOut },
  ];

  const handleNavClick = (item: (typeof mainMenuItems)[0]) => {
    setActiveNavKey(item.key);
    if (item.view) setActiveView(item.view);
    setIsSidebarCollapsed(true);
  };

  const handleBottomClick = (key: NavKey) => {
    setActiveNavKey(key);
    setIsSidebarCollapsed(true);
  };

  const handleSettingsClick = () => {
    setActiveNavKey('settings');
    setIsSidebarCollapsed(true);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden" style={{ fontFamily: 'Roboto, sans-serif' }}>
      {/* Left Sidebar - expand on hover when collapsed; collapse on selection or mouse leave */}
      <aside
        className="h-screen flex flex-col flex-shrink-0 fixed left-0 top-0 z-30 transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{
          backgroundColor: SIDEBAR_BG,
          width: isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        }}
        onMouseEnter={() => setIsSidebarCollapsed(false)}
        onMouseLeave={() => setIsSidebarCollapsed(true)}
      >
        {/* When collapsed: logo mark only (no wordmark name). When expanded: full logo. */}
        <div className={`flex items-center border-b border-white/10 shrink-0 ${isSidebarCollapsed ? 'justify-center px-0 py-5' : 'px-6 py-8'}`}>
          {isSidebarCollapsed ? (
            <div className="h-8 w-8 overflow-hidden flex items-center justify-center" style={{ width: 32 }}>
              <img
                src="https://cliperact.b-cdn.net/website-rebranding-cliperact/New%20Cliperact%20Logo-13%201%20(3).svg"
                alt=""
                className="h-8 object-cover object-left"
                style={{ width: 80 }}
              />
            </div>
          ) : (
            <img
              src="https://cliperact.b-cdn.net/website-rebranding-cliperact/New%20Cliperact%20Logo-13%201%20(3).svg"
              alt="Cliperact"
              className="h-10 w-auto"
            />
          )}
        </div>

        <nav className="flex-1 flex flex-col overflow-x-hidden overflow-y-auto">
          <div className={`space-y-1 ${isSidebarCollapsed ? 'px-2 py-2' : 'px-4 py-2'}`}>
            {mainMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNavKey === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item)}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center text-white transition-colors rounded-lg ${
                    isActive ? 'bg-white/20' : 'hover:bg-white/10'
                  } ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}`}
                  style={{ fontFamily: 'Roboto, sans-serif' }}
                >
                  {item.customIcon ? (
                    <VideoGeneratorIcon />
                  ) : (
                    <Icon size={20} strokeWidth={2} />
                  )}
                  {!isSidebarCollapsed && (
                    <span className="text-[15px] font-normal whitespace-nowrap">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-auto mb-4">
            <button
              onClick={handleSettingsClick}
              title={isSidebarCollapsed ? 'Settings' : undefined}
              className={`w-full flex items-center text-white transition-colors rounded-lg mb-6 ${
                activeNavKey === 'settings' ? 'bg-white/20' : 'hover:bg-white/10'
              } ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}`}
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              <Settings size={20} strokeWidth={2} />
              {!isSidebarCollapsed && (
                <span className="text-[15px] font-normal whitespace-nowrap">Settings</span>
              )}
            </button>

            <div className={`space-y-1 ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
              {bottomMenuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleBottomClick(item.key)}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center text-white transition-colors rounded-lg ${
                    activeNavKey === item.key ? 'bg-white/20' : 'hover:bg-white/10'
                  } ${isSidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}`}
                  style={{ fontFamily: 'Roboto, sans-serif' }}
                >
                  <item.icon size={20} strokeWidth={2} />
                  {!isSidebarCollapsed && (
                    <span className="text-[15px] font-normal whitespace-nowrap">{item.label}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content - dynamic margin based on sidebar state */}
      <div
        className="flex-1 flex flex-col min-w-0 transition-[margin-left] duration-200 ease-in-out"
        style={{ marginLeft: isSidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
      >
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <button className="lg:hidden text-slate-500" aria-label="Menu">
              <Menu size={20} />
            </button>

            <form onSubmit={handleGlobalSearch} className="flex-1 max-w-2xl relative group">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#0947A4] transition-colors"
                size={18}
              />
              <input
                type="text"
                placeholder="AskAI: Why did revenue dip yesterday?"
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-[#0947A4] focus:ring-1 focus:ring-[#0947A4] rounded-lg text-sm transition-all outline-none"
              />
            </form>
          </div>

          <div className="flex items-center gap-4 ml-4">
            <button
              onClick={() => setIsAiOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
              aria-label="Open AI Assistant"
            >
              <Sparkles size={18} />
              <span className="hidden sm:inline">Ask AI</span>
            </button>
            <button className="relative text-slate-400 hover:text-slate-600" aria-label="Notifications">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="h-8 w-8 rounded-full bg-slate-200 border border-slate-300 overflow-hidden">
              <img src="https://picsum.photos/100/100" alt="User" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          {activeView === 'analytics' && (
            <AnalyticsStudio
              onExplain={handleExplain}
              onOpenAskAI={() => setIsAiOpen(true)}
              applyConfigRef={applyConfigRef}
            />
          )}
          {activeView === 'friction' && <FrictionForensic />}
        </main>
      </div>

      <AskAISidebar
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        context={aiContext}
        activeView={activeView}
        currentViewConfig={getActiveSession()?.currentViewConfig}
        onApplyConfig={(updates) => {
          applyConfigRef.current?.(updates);
          const stepCount = updates.funnel_steps?.length ?? 0;
          if (updates.analysis_type === 'funnel' && stepCount > 0) {
            setBuildSuccessToast(`✓ Funnel built with ${stepCount} steps`);
            setTimeout(() => setBuildSuccessToast(null), 4000);
          } else if (updates.analysis_type === 'segmentation') {
            setBuildSuccessToast('✓ Segmentation chart ready');
            setTimeout(() => setBuildSuccessToast(null), 4000);
          }
        }}
      />

      {isAiOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsAiOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Build success toast */}
      {buildSuccessToast && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 bg-emerald-600 text-white rounded-lg shadow-lg font-medium flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {buildSuccessToast}
        </div>
      )}
    </div>
  );
};

export default App;
