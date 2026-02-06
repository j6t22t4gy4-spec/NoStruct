
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Modality } from '@google/genai';
import { AppMode, Message, ChatSession, Folder, User, ReportPage } from './types';
import { 
  generateEducationalResponse, 
  getAIClient, 
  encodePCM, 
  decodePCM, 
  decodeAudioData 
} from './services/geminiService';
import { supabase } from './services/supabaseService';
import { 
  ChatBubbleLeftRightIcon, 
  MicrophoneIcon, 
  MagnifyingGlassIcon, 
  LightBulbIcon, 
  PhotoIcon, 
  BoltIcon, 
  PaperAirplaneIcon,
  XMarkIcon,
  StopIcon,
  GlobeAltIcon,
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  QuestionMarkCircleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  ShareIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  DocumentMagnifyingGlassIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  MinusIcon,
  SpeakerWaveIcon,
  TrashIcon,
  AdjustmentsHorizontalIcon,
  DocumentPlusIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  CloudArrowUpIcon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
  FolderIcon,
  FolderPlusIcon,
  EllipsisVerticalIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  PlayIcon,
  MusicalNoteIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';


export default function App() {
  // === 상태 관리 ===
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT); 
  const [currentUser, setCurrentUser] = useState<any>(null); 
  const [isAuthLoading, setIsAuthLoading] = useState(true); 

  const [sessions, setSessions] = useState<ChatSession[]>([]); 
  const [folders, setFolders] = useState<Folder[]>([]); 
  const [guestSessions, setGuestSessions] = useState<ChatSession[]>(() => { 
    const saved = localStorage.getItem('guest_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [guestFolders, setGuestFolders] = useState<Folder[]>(() => { 
    const saved = localStorage.getItem('guest_folders');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null); 
  const [messages, setMessages] = useState<Message[]>([]); 
  
  const [input, setInput] = useState(''); 
  const [isTyping, setIsTyping] = useState(false); 
  const [mediaFile, setMediaFile] = useState<{data: string, type: string, name: string} | null>(null); 
  const [isLiveActive, setIsLiveActive] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024); 
  const [isHistoryOpen, setIsHistoryOpen] = useState(true); 
  const [isFoldersSectionOpen, setIsFoldersSectionOpen] = useState(true); 
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set()); 
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false); 
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false); 
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null); 
  const [folderDeletingId, setFolderDeletingId] = useState<string | null>(null); 
  
  const [isSidecarOpen, setIsSidecarOpen] = useState(false); 
  
  const [reports, setReports] = useState<ReportPage[]>([
    { title: '보고서', subtitle: 'BY NORUCT', sections: [] }
  ]);
  const [activeReportIndex, setActiveReportIndex] = useState(0); 
  const [reportZoom, setReportZoom] = useState(1);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null); 
  const liveSessionRef = useRef<any>(null); 
  const audioContextRef = useRef<AudioContext | null>(null); 
  const nextStartTimeRef = useRef(0); 
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set()); 
  const fileInputRef = useRef<HTMLInputElement>(null); 
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [searchQuery, setSearchQuery] = useState(''); 
  const reportRef = useRef<HTMLDivElement>(null); 
  const [isComposing, setIsComposing] = useState(false);


  const currentReport = reports[activeReportIndex] || { title: '보고서', subtitle: 'BY NORUCT', sections: [] };

  // === Supabase 데이터 Fetch 함수 ===
  const fetchUserData = async (userId: string) => {
    try {
      // 폴더 불러오기
      const { data: folderData, error: folderError } = await supabase
        .from('general_data')
        .select('*')
        .eq('user_id', userId)
        .eq('is_folder', true)
        .order('updated_at', { ascending: false });

      if (folderError) throw folderError;
      if (folderData) {
        const mappedFolders = folderData.map(f => ({
          ...f,
          updatedAt: f.updated_at ? new Date(f.updated_at).getTime() : Date.now()
        })) as Folder[];
        setFolders(mappedFolders);
      }

      // 세션(채팅) 불러오기1
      const { data: sessionData, error: sessionError } = await supabase
        .from('general_data')
        .select('*')
        .eq('user_id', userId)
        .eq('is_folder', false)
        .order('updated_at', { ascending: false });

      if (sessionError) throw sessionError;
      if (sessionData) {
        const mappedSessions = sessionData.map(s => ({
          ...s,
          updatedAt: s.updated_at ? new Date(s.updated_at).getTime() : Date.now(),
          // activeReportIndex는 DB 필드명과 TS 필드명이 일치하므로 자동 매핑됨
        })) as ChatSession[];
        setSessions(mappedSessions);
      }
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setIsAuthLoading(false);
      if (session?.user) fetchUserData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id);
      else {
        setSessions([]);
        setFolders([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const baseHeight = 56; 
      const maxHeight = baseHeight * 2.5; 
      const targetHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    localStorage.setItem('guest_sessions', JSON.stringify(guestSessions));
  }, [guestSessions]);

  useEffect(() => {
    localStorage.setItem('guest_folders', JSON.stringify(guestFolders));
  }, [guestFolders]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const syncReportsToSession = async (newReports: ReportPage[], newIndex: number) => {
    if (!activeSessionId) return;

    if (!currentUser) {
      setGuestSessions(prev => prev.map(s => s.id === activeSessionId ? { 
        ...s, 
        reports: newReports, 
        activeReportIndex: newIndex, 
        updatedAt: Date.now() 
      } : s));
      return;
    }

    try {
      const { error } = await supabase.from('general_data').update({
        reports: newReports,
        activeReportIndex: newIndex,
        updated_at: new Date().toISOString()
      })
      .eq('id', activeSessionId)
      .eq('is_folder', false);
      
      if (error) throw error;
    } catch (err) {
      console.error("Report sync failed:", err);
    }
  };

  const handleExportPDF = () => {
    const printContent = reportRef.current;
    if (!printContent) return;
    const printWindow = window.open('', '', 'height=1000,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>NoStruct Report</title><script src="https://cdn.tailwindcss.com"></script><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet"><style>body{font-family:"Inter", sans-serif;} @media print {.no-print {display:none;}} img { max-width: 100%; height: auto; display: block; margin: 1rem 0; }</style></head><body class="bg-white">');
      const clone = printContent.cloneNode(true) as HTMLElement;
      clone.style.transform = 'none';
      clone.style.width = '210mm';
      clone.style.minHeight = '297mm';
      printWindow.document.write(clone.outerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    }
  };

  const handleCreateFolder = async () => {
    const folderName = "제목없는 폴더";

    if (!currentUser) {
      if (guestFolders.length >= 10) return;
      const newFolderId = Date.now().toString();
      setGuestFolders(prev => [{ id: newFolderId, name: folderName, updatedAt: Date.now() }, ...prev]);
      return;
    }

    if (folders.length >= 10) return;

    try {
      const { error } = await supabase.from('general_data').insert({
        name: folderName,
        is_folder: true,
        user_id: currentUser.id,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      fetchUserData(currentUser.id);
    } catch (err) {
      console.error("Folder creation failed:", err);
    }
  };

  const executeDeleteFolder = async (id: string) => {
    if (!currentUser) {
      setGuestSessions(prev => prev.map(s => s.folderId === id ? { ...s, folderId: null } : s));
      setGuestFolders(prev => prev.filter(f => f.id !== id));
      setFolderDeletingId(null);
      return;
    }

    try {
      await supabase.from('general_data')
        .update({ folderId: null })
        .eq('folderId', id)
        .eq('is_folder', false);

      const { error } = await supabase.from('general_data').delete().eq('id', id).eq('is_folder', true);
      if (error) throw error;
      
      setFolderDeletingId(null);
      fetchUserData(currentUser.id);
    } catch (err) {
      console.error("Folder deletion failed:", err);
    }
  };

  const handleRenameSession = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    if (!currentUser) {
      setGuestSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    } else {
      const { error } = await supabase.from('general_data')
        .update({ title: newTitle, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('is_folder', false);

      if (error) console.error("Session rename failed:", error);
      fetchUserData(currentUser.id);
    }
    setEditingSessionId(null);
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    if (!newName.trim()) {
      setEditingFolderId(null);
      return;
    }
    if (!currentUser) {
      setGuestFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    } else {
      const { error } = await supabase.from('general_data')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('is_folder', true);
      if (error) console.error("Folder rename failed:", error);
      fetchUserData(currentUser.id);
    }
    setEditingFolderId(null);
  };

  const handleMoveToFolder = async (sessionId: string, folderId: string | null) => {
    if (!currentUser) {
      setGuestSessions(prev => prev.map(s => s.id === sessionId ? { ...s, folderId, updatedAt: Date.now() } : s));
      setActiveMenuId(null);
      return;
    }
    try {
      const { error } = await supabase.from('general_data').update({
        folderId: folderId,
        updated_at: new Date().toISOString()
      }).eq('id', sessionId)
        .eq('is_folder', false);

      if (error) throw error;
      setActiveMenuId(null);
      fetchUserData(currentUser.id);
    } catch (err) {
      console.error("Move to folder failed:", err);
    }
  };

  const toggleFolderExpansion = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addNewReportPage = () => {
    const newReports = [...reports, { title: '새 보고서', subtitle: 'BY NORUCT', sections: [] }];
    const newIndex = reports.length;
    setReports(newReports);
    setActiveReportIndex(newIndex);
    syncReportsToSession(newReports, newIndex);
  };

  const deleteCurrentReportPage = () => {
    let newReports;
    let newIndex;
    if (reports.length <= 1) {
      newReports = [{ title: '보고서', subtitle: 'BY NORUCT', sections: [] }];
      newIndex = 0;
    } else {
      newReports = reports.filter((_, i) => i !== activeReportIndex);
      newIndex = Math.max(0, activeReportIndex - 1);
    }
    setReports(newReports);
    setActiveReportIndex(newIndex);
    syncReportsToSession(newReports, newIndex);
  };

  const updateActiveReport = (updates: Partial<ReportPage>) => {
    const newReports = reports.map((r, i) => i === activeReportIndex ? { ...r, ...updates } : r);
    setReports(newReports);
    syncReportsToSession(newReports, activeReportIndex);
  };

  const parseReportContent = (text: string, currentReports: ReportPage[], currentIndex: number, aiMediaData?: string) => {
    if (text.includes('---REPORT---') || text.includes('##')) {
      const lines = text.split('\n');
      let title = currentReports[currentIndex]?.title;
      const reportStartIndex = lines.findIndex(l => l.includes('---REPORT---'));
      if (reportStartIndex !== -1 && lines[reportStartIndex + 1]) {
        title = lines[reportStartIndex + 1].replace(/#|보고서/g, '').trim();
      }
      
      const rawSections = text.split('\n##').slice(1);
      const sections = rawSections.map((s, idx) => {
        const parts = s.split('\n');
        return { 
          title: parts[0].trim(), 
          body: parts.slice(1).join('\n').replace('---REPORT---', '').trim(),
          image: idx === 0 ? aiMediaData : undefined
        };
      });

      if (sections.length > 0) {
        const updatedReports = currentReports.map((r, i) => i === currentIndex ? { ...r, title: title || r.title, sections } : r);
        setReports(updatedReports);
        syncReportsToSession(updatedReports, currentIndex);
      }
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    let promptToSend = customPrompt || input;
    if (!promptToSend.trim() && !mediaFile) return;

    const isReportRequestedByUser = /보고서|작성|정리|기록|report/i.test(promptToSend);

    if (isSidecarOpen) {
      promptToSend += `\n\n(참고: 보고서 모드가 켜져 있습니다. 현재 당신은 '${currentReport.title}' 페이지를 편집 중입니다. 답변 시 핵심 내용을 정리하여 '---REPORT---' 태그와 함께 ## 섹션 제목 형식으로 보고서 내용을 포함해 주세요.)`;
    }

    let sessionId = activeSessionId;
    const isNewSession = !sessionId;

    const userMessage: Message = {
      role: 'user',
      content: customPrompt || input,
      timestamp: Date.now(),
      type: mediaFile ? (mediaFile.type.startsWith('video') ? 'video' : mediaFile.type.startsWith('audio') ? 'audio' : 'image') : 'text',
      mediaData: mediaFile?.data,
      mediaType: mediaFile?.type
    };

    const messageHistory = [...messages];
    const updatedMessages = customPrompt ? messages.slice(0, messages.length) : [...messages, userMessage];
    
    setMessages(updatedMessages);
    if (!customPrompt) setInput('');
    setIsTyping(true);

    const sessionTitle = userMessage.content.length > 30 ? userMessage.content.substring(0, 30) + '...' : userMessage.content || "새로운 대화";

    // 1. 세션 생성/업데이트 (DB 또는 Local)
    if (!currentUser) {
      if (isNewSession) {
        sessionId = Date.now().toString();
        const newSession: ChatSession = { 
          id: sessionId, 
          title: sessionTitle, 
          messages: updatedMessages, 
          updatedAt: Date.now(), 
          folderId: null,
          reports: reports,
          activeReportIndex: activeReportIndex
        };
        setGuestSessions(prev => [newSession, ...prev]);
        setActiveSessionId(sessionId);
      } else {
        setGuestSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: updatedMessages, updatedAt: Date.now() } : s));
      }
    } else {
      if (isNewSession) {
        try {
          const { data, error } = await supabase.from('general_data').insert({
            title: sessionTitle || "새로운 대화", 
            messages: updatedMessages, 
            updated_at: new Date().toISOString(), 
            folderId: null,
            reports: reports,
            activeReportIndex: activeReportIndex || 0,
            user_id: currentUser.id,
            name: null,
            is_folder: false
          }).select().single();
          
          if (error) throw error;
          if (data) {
            sessionId = data.id;
            setActiveSessionId(sessionId);
            fetchUserData(currentUser.id);
          }
        } catch (err) { 
          console.error("Session save failed:", err); 
        }
      } else if (sessionId) {
        try {
          const { error } = await supabase.from('general_data').update({ 
            messages: updatedMessages, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', sessionId)
          .eq('is_folder', false);
          
          if (error) throw error;
          fetchUserData(currentUser.id);
        } catch (err) { 
          console.error("Session update failed:", err); 
        }
      }
    }

    // 2. AI 응답 생성
    try {
      const mediaParts = mediaFile ? [{ inlineData: { mimeType: mediaFile.type, data: mediaFile.data.split(',')[1] } }] : [];
      const result = await generateEducationalResponse(mode, promptToSend, messageHistory, mediaParts);
      
      const modelMessage: Message = { 
        role: 'model', 
        content: result.text, 
        timestamp: Date.now(), 
        groundingUrls: result.urls || [],
        thinking: result.thinking,
        mediaData: result.aiMedia?.data,
        mediaType: result.aiMedia?.mimeType,
        type: result.aiMedia ? (result.aiMedia.mimeType.startsWith('image') ? 'image' : 'text') : 'text'
      };
      
      const finalMessages = [...updatedMessages, modelMessage];
      setMessages(finalMessages);
      setMediaFile(null);
      
      // 보고서 파싱
      parseReportContent(result.text, reports, activeReportIndex, result.aiMedia?.data);

      if (isReportRequestedByUser && result.text.includes('---REPORT---') && !isSidecarOpen) {
        setIsSidecarOpen(true);
      }

      // 3. AI 응답 후 최종 상태 저장
      if (!currentUser) {
        setGuestSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: finalMessages, updatedAt: Date.now() } : s));
      } else if (sessionId) {
        const { error } = await supabase.from('general_data').update({ 
          messages: finalMessages, 
          updated_at: new Date().toISOString() 
        }).eq('id', sessionId).eq('is_folder', false);
        
        if (error) throw error;
        fetchUserData(currentUser.id);
      }
    } catch (error) {
      console.error(error);
      const errorMessage: Message = { role: 'model', content: "오류가 발생했습니다. 연결 상태를 확인하고 다시 시도해 주세요.", timestamp: Date.now() };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setMediaFile(null);
    setInput('');
    setIsSidecarOpen(false);
    setReports([{ title: '보고서', subtitle: 'BY NORUCT', sections: [] }]);
    setActiveReportIndex(0);
  };

  const handleSelectSession = (id: string) => {
    const session = [...sessions, ...guestSessions].find(s => s.id === id);
    if (session) {
      setActiveSessionId(id);
      setMessages(session.messages || []);
      
      if (session.reports && session.reports.length > 0) {
        setReports(session.reports);
        setActiveReportIndex(session.activeReportIndex ?? 0);
      } else {
        setReports([{ title: '보고서', subtitle: 'BY NORUCT', sections: [] }]);
        setActiveReportIndex(0);
      }

      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("이 대화를 삭제하시겠습니까?")) return;
    if (!currentUser || guestSessions.some(s => s.id === id)) {
      setGuestSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) handleNewChat();
      setActiveMenuId(null);
      return;
    }
    try {
      const { error } = await supabase.from('general_data')
      .delete()
      .eq('id', id)
      .eq('is_folder', false);

      if (error) throw error;

      if (activeSessionId === id) handleNewChat();
      setActiveMenuId(null);
      fetchUserData(currentUser.id);
    } catch (err) { console.error("Delete failed:", err); }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleDeleteMessage = (index: number) => {
    if (!confirm("이 메시지를 삭제하시겠습니까?")) return;
    const nextMessages = messages.filter((_, i) => i !== index);
    setMessages(nextMessages);
    
    if (activeSessionId) {
      if (!currentUser) {
        setGuestSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: nextMessages, updatedAt: Date.now() } : s));
      } else {
        supabase.from('general_data')
        .update({ messages: nextMessages, updated_at: new Date().toISOString() })
        .eq('id', activeSessionId)
        .eq('is_folder', false)
        .then(({ error }) => {
          if (error) console.error("Message delete failed:", error);
          fetchUserData(currentUser.id);
        });
      }
    }
  };

  const handleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google' });
    } catch (error) { console.error("Login failed:", error); }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      handleNewChat();
      setIsSettingsMenuOpen(false);
    } catch (error) { console.error("Logout failed:", error); }
  };

  const toggleLive = async () => {
    if (isLiveActive) {
      if (liveSessionRef.current) liveSessionRef.current.close();
      setIsLiveActive(false);
      return;
    }
    try {
      const ai = getAIClient();
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: encodePCM(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg) => {
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const buffer = await decodeAudioData(decodePCM(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }
          },
          onerror: (e) => console.error("Live Error:", e),
          onclose: () => setIsLiveActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: "당신은 Noruct입니다. 음성을 통해 정확한 학습 지원을 제공하세요."
        }
      });
      liveSessionRef.current = await sessionPromise;
      setIsLiveActive(true);
    } catch (e) { console.error("Failed to start live session:", e); }
  };

  const allSessions = useMemo(() => [...sessions, ...guestSessions], [sessions, guestSessions]);
  const allFolders = useMemo(() => [...folders, ...guestFolders], [folders, guestFolders]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return allSessions;
    return allSessions.filter(s => s.title?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allSessions, searchQuery]);

  const rootSessions = useMemo(() => filteredSessions.filter(s => !s.folderId), [filteredSessions]);

  const currentActiveSession = useMemo(() => allSessions.find(s => s.id === activeSessionId), [allSessions, activeSessionId]);

  const showSendButton = input.trim() !== '' || mediaFile !== null;

  // === 세션 리스트 아이템 컴포넌트 ===
  const SessionItem = ({ session }: { session: ChatSession }) => (
    <div className="group/item">
      {editingSessionId === session.id ? (
        <div className="px-2 py-1">
          <input 
            autoFocus
            type="text" 
            value={editValue} 
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleRenameSession(session.id, editValue)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSession(session.id, editValue); if (e.key === 'Escape') setEditingSessionId(null); }}
            className="w-full bg-white border border-blue-500 rounded-lg px-2 py-1 text-[13px] focus:outline-none"
          />
        </div>
      ) : (
        <button
          onClick={() => handleSelectSession(session.id)}
          className={`w-full text-left px-4 py-2.5 text-[13px] font-medium rounded-xl transition-all flex items-center justify-between gap-2 ${
            activeSessionId === session.id 
            ? 'bg-blue-50 text-blue-600' 
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="truncate flex-1">{session.title}</span>
          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setEditValue(session.title); }}
              className={`p-1 rounded opacity-0 group-hover/item:opacity-100 hover:bg-slate-200 text-slate-400`}
            >
              <PencilSquareIcon className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === session.id ? null : session.id); }}
              className={`p-1 rounded transition-all ${activeMenuId === session.id ? 'bg-slate-200' : 'opacity-0 group-hover/item:opacity-100 hover:bg-slate-200 text-slate-400'}`}
            >
              <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-300 ${activeMenuId === session.id ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </button>
      )}

      <div className={`grid transition-all duration-300 ${activeMenuId === session.id ? 'grid-rows-[1fr] opacity-100 py-2' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
        <div className="overflow-hidden">
          <div className="bg-slate-100/50 rounded-xl mx-2 p-2 border border-slate-200/50 space-y-1">
            <p className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Move to Folder</p>
            <div className="max-h-32 overflow-y-auto no-scrollbar space-y-0.5">
              {allFolders.map(f => (
                <button 
                  key={f.id}
                  onClick={() => handleMoveToFolder(session.id, f.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold rounded-lg hover:bg-white hover:text-blue-600 transition-all ${session.folderId === f.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
                >
                  <FolderIcon className="w-3 h-3" />
                  {f.name}
                </button>
              ))}
              {session.folderId && (
                <button 
                  onClick={() => handleMoveToFolder(session.id, null)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-slate-500 rounded-lg hover:bg-white transition-all"
                >
                  <ArrowUturnLeftIcon className="w-3 h-3" />
                  폴더에서 제거
                </button>
              )}
            </div>
            <div className="pt-1 border-t border-slate-200/50">
              <button 
                onClick={() => handleDeleteSession(session.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-all"
              >
                <TrashIcon className="w-3 h-3" />
                삭제하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ... (상단 import 부분은 동일하므로 생략, 아래 return 부분부터 핵심 수정사항 반영)

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden relative" onClick={() => { setActiveMenuId(null); setFolderDeletingId(null); }}>
      {/* === 사이드바 === */}
      <aside className={`
        fixed md:relative z-50 h-full bg-slate-50 border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col overflow-hidden
        ${isSidebarOpen ? 'translate-x-0 w-72 opacity-100' : '-translate-x-full w-0 md:w-0 opacity-0'}
      `}>
        <div className="flex flex-col h-full w-72 shrink-0">
          <div className="p-6 pt-16 md:pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <span className="text-white font-bold text-lg leading-none">N</span>
              </div>
              <span className="font-bold text-slate-800 tracking-tight text-lg">Noruct</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors md:hidden"><ChevronLeftIcon className="w-5 h-5" /></button>
          </div>

          <div className="px-4 mb-4 space-y-2">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="채팅 검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all" />
            </div>
            <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all group shadow-sm">
              <PlusIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>새 채팅 생성</span>
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto no-scrollbar pt-2">
            <div className="mb-2">
              <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="w-full flex items-center justify-between px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors group">
                <div className="flex items-center gap-3"><ChatBubbleLeftRightIcon className="w-5 h-5 opacity-70 group-hover:text-blue-500 transition-colors" /><span>Chat History</span></div>
                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isHistoryOpen ? 'rotate-0' : '-rotate-90'}`} />
              </button>
              <div className={`grid transition-all duration-300 ${isHistoryOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                <div className="overflow-hidden">
                  <div className="mt-1 px-2 space-y-0.5">
                    {rootSessions.length > 0 ? rootSessions.map(session => <SessionItem key={session.id} session={session} />) : <p className="px-10 py-2 text-[12px] text-slate-400 font-medium">최근 대화 없음</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-2">
              <div className="flex items-center justify-between px-4 py-2">
                <button onClick={() => setIsFoldersSectionOpen(!isFoldersSectionOpen)} className="flex-1 text-left flex items-center gap-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors group">
                  <FolderIcon className="w-5 h-5 opacity-70 group-hover:text-blue-500 transition-colors" /><span>Folders</span>
                  <ChevronDownIcon className={`w-4 h-4 ml-auto transition-transform duration-300 ${isFoldersSectionOpen ? 'rotate-0' : '-rotate-90'}`} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleCreateFolder(); }} disabled={allFolders.length >= 10} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-500 disabled:opacity-20 transition-all ml-1"><FolderPlusIcon className="w-4 h-4" /></button>
              </div>
              <div className={`grid transition-all duration-300 ${isFoldersSectionOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                <div className="overflow-hidden">
                  <div className="mt-1 px-2 space-y-1">
                    {allFolders.map(folder => (
                      <div key={folder.id} className="space-y-0.5">
                        {editingFolderId === folder.id ? (
                          <div className="px-6 py-1">
                            <input 
                              autoFocus
                              type="text" 
                              value={editValue} 
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleRenameFolder(folder.id, editValue)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(folder.id, editValue); if (e.key === 'Escape') setEditingFolderId(null); }}
                              className="w-full bg-white border border-blue-500 rounded-lg px-2 py-1 text-[13px] focus:outline-none"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1 group/folder pr-2">
                            <button onClick={() => toggleFolderExpansion(folder.id)} className={`flex-1 flex items-center gap-2 px-4 py-2 text-[13px] font-bold rounded-xl transition-all ${expandedFolders.has(folder.id) ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100'}`}>
                              <ChevronRightIcon className={`w-3 h-3 transition-transform ${expandedFolders.has(folder.id) ? 'rotate-90' : ''}`} />
                              <span className="truncate">{folder.name}</span>
                            </button>
                            <div className="flex items-center gap-0.5">
                              <button onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditValue(folder.name); }} className={`p-1 rounded opacity-0 group-hover/folder:opacity-100 text-slate-400 hover:text-blue-500 transition-all`}><PencilSquareIcon className="w-3.5 h-3.5" /></button>
                              <button onClick={(e) => { e.stopPropagation(); setFolderDeletingId(folderDeletingId === folder.id ? null : folder.id); }} className={`p-1.5 rounded transition-all ${folderDeletingId === folder.id ? 'bg-red-50 text-red-500' : 'opacity-0 group-hover/folder:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50'}`}><TrashIcon className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        )}

                        <div className={`grid transition-all duration-300 ${folderDeletingId === folder.id ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}>
                          <div className="overflow-hidden">
                            <div className="bg-red-50 border border-red-100 rounded-xl mx-2 p-3 space-y-2">
                              <div className="flex items-center gap-2 text-red-600">
                                <ExclamationTriangleIcon className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">삭제 확인</span>
                              </div>
                              <p className="text-[10px] text-red-700/70 font-bold leading-relaxed">이 폴더를 삭제할까요? 내역은 보존됩니다.</p>
                              <div className="flex gap-2">
                                <button onClick={() => executeDeleteFolder(folder.id)} className="flex-1 py-1.5 bg-red-600 text-white text-[10px] font-black rounded-lg hover:bg-red-700 active:scale-95 transition-all">삭제</button>
                                <button onClick={() => setFolderDeletingId(null)} className="flex-1 py-1.5 bg-white text-slate-500 text-[10px] font-black border border-red-200 rounded-lg hover:bg-slate-50 transition-all">취소</button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`grid transition-all duration-300 ${expandedFolders.has(folder.id) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}><div className="overflow-hidden pl-4 border-l border-slate-200 ml-5 my-1">{allSessions.filter(s => s.folderId === folder.id).map(session => <SessionItem key={session.id} session={session} />)}{allSessions.filter(s => s.folderId === folder.id).length === 0 && <p className="px-4 py-2 text-[11px] text-slate-400 font-medium italic">이 폴더는 비어있습니다</p>}</div></div>
                      </div>
                    ))}
                    {allFolders.length === 0 && <p className="px-10 py-2 text-[12px] text-slate-400 font-medium italic">생성된 폴더 없음</p>}
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <div className="p-4 border-t border-slate-200 bg-slate-100/30">
            <div className="space-y-0.5 mb-6 relative">
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setIsSettingsMenuOpen(!isSettingsMenuOpen); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-500 hover:bg-white hover:text-slate-900 rounded-xl transition-all"><Cog6ToothIcon className="w-4 h-4" />Settings</button>
                {isSettingsMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 animate-in slide-in-from-bottom-2 duration-200 z-50">
                    {currentUser ? <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-all"><ArrowRightOnRectangleIcon className="w-4 h-4" />로그아웃</button> : <div className="px-3 py-2 text-xs text-slate-400 font-medium italic">로그인이 필요합니다</div>}
                  </div>
                )}
              </div>
              <SidebarLink icon={<CreditCardIcon className="w-4 h-4" />} label="Billing & Plans" />
            </div>
            {currentUser ? (
              <div className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-slate-200 shadow-sm mb-6">
                <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NORUCT PRO</span></div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-50 rounded-full flex items-center justify-center overflow-hidden border border-blue-100">{currentUser.user_metadata?.avatar_url ? <img src={currentUser.user_metadata.avatar_url} className="w-full h-full object-cover" alt="avatar" /> : <UserCircleIcon className="w-5 h-5 text-blue-400" />}</div>
                  <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-slate-800 truncate">{currentUser.user_metadata?.full_name || 'User'}</p><p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p></div>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <button onClick={() => setIsLoginModalOpen(true)} className="w-full group relative flex items-center justify-center gap-2 py-4 bg-white border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 shadow-sm hover:shadow-md hover:border-blue-200 transition-all overflow-hidden active:scale-95">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5 h-5 relative" alt="Google" />
                  <span className="relative">Google로 시작하기</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0 h-full bg-white transition-all duration-300">
        <header className="min-h-[4rem] md:h-16 flex items-center justify-between px-6 border-b border-slate-200/50 bg-white/90 backdrop-blur-xl sticky top-0 z-30 pt-10 md:pt-0">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }} className={`p-2.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-all active:scale-95 ${isSidebarOpen ? 'md:hidden opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}><Bars3Icon className="w-6 h-6" /></button>
            {isSidebarOpen && <button onClick={() => setIsSidebarOpen(false)} className="hidden md:flex p-2.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-all active:scale-95"><ChevronLeftIcon className="w-6 h-6" /></button>}
          </div>
          
          <div className="flex-1 flex justify-center">
            {activeSessionId && editingSessionId === activeSessionId ? (
              <input 
                autoFocus
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleRenameSession(activeSessionId, editValue)}
                onKeyDown={(e) => { if (e.key === 'Enter' && editingSessionId) handleRenameSession(editingSessionId, editValue); if (e.key === 'Escape') setEditingSessionId(null); }}
                className="bg-transparent border-b border-blue-500 focus:outline-none text-center font-bold text-slate-800 uppercase tracking-tighter text-sm w-full max-w-xs"
              />
            ) : (
              <button 
                onClick={() => { if(activeSessionId) { setEditingSessionId(activeSessionId); setEditValue(currentActiveSession?.title || ""); } }}
                className="flex items-center gap-2 group"
              >
                <h2 className="font-bold text-slate-800 uppercase tracking-tighter text-sm">
                  {currentActiveSession?.title || "GENERAL CHAT"}
                </h2>
                {activeSessionId && <PencilSquareIcon className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end">
    <button 
      onClick={() => setIsSidecarOpen(!isSidecarOpen)} 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-xs font-bold ${
        isSidecarOpen 
          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' 
          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <DocumentTextIcon className="w-4 h-4" />
      <span className="hidden sm:inline">보고서</span>
    </button>

    {/*  보고서 버튼 옆 사용자 아이콘 및 로그인 정보
    {currentUser && (
      <div className="hidden md:flex items-center gap-2 pr-2 animate-in fade-in duration-500">
        <div className="text-right">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
            Authenticated
          </p>
          <p className="text-[12px] font-bold text-slate-700 leading-none">
            {currentUser.user_metadata?.full_name}
          </p>
        </div>
        <img
          src={currentUser.user_metadata?.avatar_url || ''}
          className="w-8 h-8 rounded-full border border-slate-200"
          alt="me"
        />
      </div>
    )}
    */}

    </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
          <div className={`flex-1 flex flex-col relative transition-all duration-500 ease-in-out ${isSidecarOpen ? 'md:w-1/2' : 'w-full'}`}>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-12 pt-10 pb-48 no-scrollbar scroll-smooth relative">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto animate-in fade-in zoom-in duration-700">
                  <div className="w-20 h-20 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 ring-1 ring-blue-100 shadow-[0_10px_30px_-5px_rgba(59,130,246,0.15)]">
                    <ChatBubbleLeftRightIcon className="w-10 h-10 text-blue-500" />
                  </div>
                  <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Noruct</h1>
                  <p className="text-slate-500 text-[15px] leading-relaxed font-medium">정확한 학습을 위한 신뢰할 수 있는 학업 동반자입니다.</p>
                </div>
              )}
              
              <div className="max-w-3xl mx-auto space-y-12">
                {/* 1. 메시지 렌더링 루프 */}
{messages.map((m, i) => (
  <div 
    key={i} 
    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-6 duration-500`}
  >
    {m.role === 'user' ? (
      // 사용자 메시지 – 파란 말풍선 그대로
      <div 
        className={`relative max-w-[95%] md:max-w-[85%] rounded-[28px] p-6 shadow-sm flex flex-col bg-blue-600 text-white shadow-blue-200`}
      >
        {/* 사고 과정 */}
        {m.thinking && (
          <div className="mb-6 text-[13px] font-medium bg-slate-50/30 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/30 text-slate-200 italic">
            <span className="block font-black mb-2 opacity-40 text-[10px] uppercase tracking-widest not-italic">사고 과정</span>
            {m.thinking}
          </div>
        )}

        {/* 미디어 */}
        {m.mediaData && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-slate-100 shadow-sm relative group">
            {m.type === 'image' && <img src={m.mediaData} className="w-full max-h-[400px] object-contain bg-slate-50" alt="content" />}
            {m.type === 'video' && <video src={m.mediaData} controls className="w-full max-h-[400px] bg-black" />}
            {m.type === 'audio' && (
              <div className="p-4 bg-slate-50 flex items-center gap-3">
                <MusicalNoteIcon className="w-6 h-6 text-blue-500" />
                <audio src={m.mediaData} controls className="flex-1 h-10" />
              </div>
            )}
          </div>
        )}

        {/* 텍스트 본문 */}
        <div className="prose prose-invert prose-headings:text-white prose-strong:text-white prose-a:text-blue-200 hover:prose-a:underline max-w-none leading-relaxed text-[16px] font-medium tracking-tight mb-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {m.content}
          </ReactMarkdown>
        </div>

        {/* 사용자 액션 버튼 */}
        <div 
          className={`flex items-center gap-1 pt-3 border-t mt-auto justify-end border-blue-500/30`}
        >
          <button 
            onClick={() => handleCopyMessage(m.content)} 
            title="복사" 
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-blue-500/50 transition-all"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDeleteMessage(i)} 
            title="삭제" 
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-red-500/50 transition-all"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    ) : (
      // AI 메시지 – 하얀 말풍선 제거 + 최대 너비
      <div className="w-[99%] max-w-[99%] md:max-w-[99%] pl-2 md:pl-4 pr-2 overflow-hidden">
        {/* 사고 과정 */}
        {m.thinking && (
          <div className="mb-5 flex items-start gap-3 text-[13px] font-medium text-slate-600 italic">
            {/* 텍스트 내용 */}
            <div className="flex-1">
              <span className="block text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">
                사고 과정
              </span>
              {m.thinking}
            </div>
          </div>
        )}

        {/* 미디어 */}
        {m.mediaData && (
          <div className="mb-5 rounded-2xl overflow-hidden border border-slate-200/60 shadow-sm relative group">
            {m.type === 'image' && (
              <>
                <img src={m.mediaData} className="w-full max-h-[400px] object-contain bg-slate-50" alt="content" />
                <a 
                  href={m.mediaData} 
                  download="generated.png" 
                  className="absolute top-3 right-3 p-2.5 bg-white/90 backdrop-blur-md rounded-xl shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white text-slate-700 hover:text-blue-600"
                >
                  <ArrowDownTrayIcon className="w-5 h-5" />
                </a>
              </>
            )}
            {m.type === 'video' && <video src={m.mediaData} controls className="w-full max-h-[400px] bg-black" />}
            {m.type === 'audio' && (
              <div className="p-5 bg-slate-50 flex items-center gap-4">
                <MusicalNoteIcon className="w-7 h-7 text-blue-500" />
                <audio src={m.mediaData} controls className="flex-1 h-10" />
              </div>
            )}
          </div>
        )}

        {/* 본문 텍스트 + 출처 드롭다운 */}
        {(() => {
          const parts = m.content.split('🔗');
          const mainContent = parts[0].trim();
          const references = parts.length > 1 ? '🔗' + parts.slice(1).join('🔗').trim() : '';

          return (
            <>
              {/* 본문은 항상 보임 */}
              <div className="prose prose-slate prose-headings:text-slate-900 prose-strong:text-slate-900 prose-a:text-blue-600 hover:prose-a:underline max-w-none break-words [&_a]:break-all [&_pre]:overflow-x-auto leading-relaxed text-[16px] font-medium tracking-tight mb-5">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                >
                  {mainContent}
                </ReactMarkdown>
              </div>

              {/* 출처(참고 자료)가 있으면 드롭다운으로 */}
              {references && (
                <details className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
                  <summary className="px-5 py-3 font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors flex items-center justify-between">
                    <span>참고 자료 / 출처</span>
                    <span className="text-slate-400 text-sm">▼</span>
                  </summary>
                  <div className="
                  px-5 py-4 bg-white 
                  prose prose-slate max-w-none 
                  break-words                   /* 긴 단어 강제 줄바꿈 */
                  hyphens-auto                  /* 자동 하이픈 */
                  [&_a]:break-all               /* 링크 강제 줄바꿈 */
                  [&_a]:underline 
                  [&_pre]:overflow-x-auto       /* 코드 블록은 가로 스크롤 */
                  [&_pre]:max-w-full
                  leading-relaxed text-[15px]
                  ">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {references}
                    </ReactMarkdown>
                  </div>
                </details>
              )}
            </>
          );
        })()}

        {/* AI 액션 버튼 */}
        <div className="flex items-center gap-2 text-slate-500 mt-3">
          <button 
            onClick={() => handleSendMessage(messages[i-1]?.content)} 
            title="재생성" 
            className="p-2 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button 
            title="공유" 
            className="p-2 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors"
          >
            <ShareIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={() => handleCopyMessage(m.content)} 
            title="복사" 
            className="p-2 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors"
          >
            <DocumentDuplicateIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    )}
  </div>
))}

                {/* 2. 루프 외부 최하단: 타이핑 애니메이션 점3개 애니매이션 */}
                {isTyping && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-500 pl-2 md:pl-4">
                    <div className="flex gap-2 items-center ">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                      <span className="ml-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">AI Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-10 left-0 right-0 z-20 px-4 md:px-12 pointer-events-none flex flex-col items-center gap-4">
              <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 p-1 rounded-2xl shadow-xl flex items-center gap-1 pointer-events-auto transition-all animate-in slide-in-from-bottom-2 duration-500">
                <button onClick={() => setMode(AppMode.CHAT)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === AppMode.CHAT ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><ChatBubbleLeftRightIcon className="w-4 h-4" />학습 대화</button>
                <button onClick={() => setMode(AppMode.THINKING)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === AppMode.THINKING ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><LightBulbIcon className="w-4 h-4" />심층 사고</button>
                <button onClick={() => setMode(AppMode.SEARCH)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === AppMode.SEARCH ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><MagnifyingGlassIcon className="w-4 h-4" />웹 검색</button>
                <button onClick={() => setMode(AppMode.VISION)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === AppMode.VISION ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`}><SparklesIcon className="w-4 h-4" />이미지 생성</button>
              </div>

              <div className="max-w-3xl w-full pointer-events-auto relative">
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  accept="image/*,video/*,audio/*"
                  onChange={(e) => { 
                    const file = e.target.files?.[0]; 
                    if (file) { 
                      const reader = new FileReader(); 
                      reader.onloadend = () => setMediaFile({ data: reader.result as string, type: file.type, name: file.name }); 
                      reader.readAsDataURL(file); 
                    } 
                  }} 
                />
                
                {mediaFile && (
                  <div className="mb-3 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-white/95 backdrop-blur shadow-xl border border-slate-200/50 rounded-2xl p-2 inline-flex items-center gap-3 max-w-full">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                        {mediaFile.type.startsWith('image') ? (
                          <img src={mediaFile.data} className="w-full h-full object-cover" alt="preview" />
                        ) : mediaFile.type.startsWith('video') ? (
                          <PlayIcon className="w-6 h-6 text-slate-400" />
                        ) : (
                          <MusicalNoteIcon className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-700 truncate">{mediaFile.name}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{mediaFile.type.split('/')[0]}</p>
                      </div>
                      <button onClick={() => setMediaFile(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-all"><XMarkIcon className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}

                <div className={`bg-white/90 backdrop-blur-3xl rounded-[32px] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.12)] border p-2.5 flex items-end gap-1.5 transition-all duration-300 ${
                    mode === AppMode.VISION ? 'border-fuchsia-200 ring-2 ring-fuchsia-100' :
                    mode === AppMode.SEARCH ? 'border-emerald-200 ring-2 ring-emerald-100' :
                    mode === AppMode.THINKING ? 'border-indigo-200 ring-2 ring-indigo-100' :
                    'border-slate-200/60'
                }`}>
                  <button onClick={() => fileInputRef.current?.click()} className="p-3.5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all shrink-0 flex items-center justify-center mb-0.5"><PlusIcon className="w-6 h-6" /></button>
                  
                  <div className="flex-1 min-w-0">
                  <textarea 
                    ref={textareaRef}
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    onKeyDown={(e) => {
                      if (isComposing) return;
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                      placeholder={
                        mode === AppMode.VISION ? "생성하고 싶은 이미지를 상세히 설명하세요..." :
                        mode === AppMode.SEARCH ? "웹 검색이 필요한 질문을 입력하세요..." :
                        mode === AppMode.THINKING ? "깊이 있는 사고가 필요한 논리적 질문을 입력하세요..." :
                        "학습 질문을 입력하세요..."
                      } 
                      className="w-full bg-transparent text-slate-900 px-2 py-3.5 focus:outline-none resize-none no-scrollbar font-medium leading-[1.6]" 
                      style={{ height: 'auto', minHeight: '48px' }}
                      rows={1} 
                    />
                  </div>
                  
                  <div className="shrink-0 flex items-center mb-1">
                    {showSendButton ? (
                      <button onClick={() => handleSendMessage()} className={`p-3 text-white rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${
                        mode === AppMode.VISION ? 'bg-fuchsia-600 shadow-fuchsia-200' :
                        mode === AppMode.SEARCH ? 'bg-emerald-600 shadow-emerald-200' :
                        mode === AppMode.THINKING ? 'bg-indigo-600 shadow-indigo-200' :
                        'bg-blue-600 shadow-blue-200'
                      }`}><PaperAirplaneIcon className="w-6 h-6" /></button>
                    ) : (
                      <button onClick={toggleLive} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all flex items-center justify-center"><MicrophoneIcon className="w-6 h-6" /></button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`h-full bg-slate-50 border-l border-slate-200 transition-all duration-500 ease-in-out flex flex-col ${isSidecarOpen ? 'w-full md:w-1/2 opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-full overflow-hidden'}`}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3 flex-1 overflow-hidden">
                <DocumentTextIcon className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 bg-slate-100 rounded-lg">
                  <button onClick={() => {
                    const nextIdx = Math.max(0, activeReportIndex - 1);
                    setActiveReportIndex(nextIdx);
                    syncReportsToSession(reports, nextIdx);
                  }} disabled={activeReportIndex === 0} className="p-1 hover:bg-white disabled:opacity-30 rounded transition-all"><ChevronLeftIcon className="w-3.5 h-3.5" /></button>
                  <span className="text-[11px] font-black text-slate-600 min-w-[30px] text-center">{activeReportIndex + 1} / {reports.length}</span>
                  <button onClick={() => {
                    const nextIdx = Math.min(reports.length - 1, activeReportIndex + 1);
                    setActiveReportIndex(nextIdx);
                    syncReportsToSession(reports, nextIdx);
                  }} disabled={activeReportIndex === reports.length - 1} className="p-1 hover:bg-white disabled:opacity-30 rounded transition-all"><ChevronRightIcon className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center gap-1.5 ml-2 px-2 py-1 bg-slate-100 rounded-lg">
                  <button onClick={() => setReportZoom(prev => Math.max(0.5, prev - 0.1))} title="축소" className="p-1 hover:bg-white rounded transition-all"><MinusIcon className="w-3.5 h-3.5" /></button>
                  <span className="text-[10px] font-black text-slate-600 min-w-[35px] text-center">{Math.round(reportZoom * 100)}%</span>
                  <button onClick={() => setReportZoom(prev => Math.min(2, prev + 0.1))} title="확대" className="p-1 hover:bg-white rounded transition-all"><PlusIcon className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <button onClick={addNewReportPage} title="페이지 추가" className="p-2 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all active:scale-95"><PlusIcon className="w-5 h-5" /></button>
                <button onClick={deleteCurrentReportPage} title="현재 페이지 삭제" className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-all active:scale-95"><TrashIcon className="w-5 h-5" /></button>
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <button onClick={handleExportPDF} title="PDF로 저장" className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all active:scale-95"><ArrowDownTrayIcon className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-8 bg-slate-100 flex justify-center no-scrollbar">
              <div ref={reportRef} style={{ transform: `scale(${reportZoom})`, transformOrigin: 'top center', width: '210mm', minHeight: '297mm', height: 'fit-content' }} className="bg-white shadow-[0_4px_32px_rgba(0,0,0,0.06)] rounded-sm p-[25mm] pt-[20mm] flex flex-col animate-in fade-in slide-in-from-right-4 duration-700 relative shrink-0">
                <header className="mb-10 border-b-2 border-slate-900 pb-4 flex items-baseline gap-4">
                  <h1 className="text-4xl font-black text-slate-900">
                    <input type="text" value={currentReport.title} onChange={(e) => updateActiveReport({ title: e.target.value })} className="bg-transparent border-none focus:ring-0 p-0 text-inherit font-inherit w-full" placeholder="보고서 제목" />
                  </h1>
                  <p className="text-xs font-bold text-slate-400 tracking-[0.25em] uppercase whitespace-nowrap">{currentReport.subtitle}</p>
                </header>
                <div className="flex-1 space-y-10 pb-32">
                  {currentReport.sections.length > 0 ? currentReport.sections.map((sec, idx) => (
                    <section key={idx} className="space-y-4 animate-in fade-in duration-500">
                      <h2 className="text-lg font-black text-slate-900 border-l-4 border-blue-600 pl-3">{sec.title}</h2>
                      {sec.image && (
                        <div className="my-6 rounded-xl overflow-hidden border border-slate-100 shadow-md">
                          <img src={sec.image} className="w-full object-contain bg-slate-50" alt="report visual" />
                        </div>
                      )}
                      <div className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">{sec.body}</div>
                    </section>
                  )) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 py-20"><DocumentPlusIcon className="w-16 h-16 mb-4" /><p className="text-sm font-black uppercase tracking-widest">보고서 자동 생성 대기 중</p></div>
                  )}
                </div>
                <footer className="absolute bottom-16 left-16 right-16 pt-6 border-t border-slate-100 flex items-center justify-between opacity-50"><span className="text-[10px] font-black tracking-widest text-slate-400">NORUCT AI REPORT SYSTEM</span><div className="flex items-center gap-4"><span className="text-[10px] font-black text-slate-400 italic">No hallucinations detected</span></div></footer>
              </div>
            </div>
          </div>
        </div>

        {isLoginModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsLoginModalOpen(false)} />
            <div className="relative bg-white w-full max-w-md rounded-[32px] p-8 text-center animate-in zoom-in-95 duration-300">
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8"><span className="text-white font-bold text-2xl">N</span></div>
              <h2 className="text-2xl font-black mb-10">Noruct 로그인</h2>
              <button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 py-4 bg-white border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"><img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-6 h-6" alt="G" />Google로 로그인하기</button>
            </div>
          </div>
        )}

        {isLiveActive && (
          <div className="fixed inset-0 z-[100] bg-slate-950/95 flex flex-col items-center justify-center text-white">
            <div className="relative mb-20"><div className="absolute w-72 h-72 bg-blue-500/10 rounded-full animate-ping"></div><div className="w-44 h-44 bg-blue-600 rounded-[3.5rem] flex items-center justify-center relative z-10 shadow-[0_0_100px_-10px_rgba(37,99,235,0.7)]"><MicrophoneIcon className="w-24 h-24" /></div></div>
            <button onClick={toggleLive} className="px-14 py-6 bg-red-600 rounded-[2rem] font-black">종료</button>
          </div>
        )}
      </main>
    </div>
  );
}
function SidebarLink({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-bold text-slate-500 hover:bg-white hover:text-slate-900 rounded-xl transition-all group">
      <span className="opacity-70 group-hover:text-blue-600 transition-colors">{icon}</span>
      <span>{label}</span>
    </button>
  );
}