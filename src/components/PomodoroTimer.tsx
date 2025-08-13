'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import Auth from './Auth';

interface TimerSettings {
  focusTime: number;
  breakTime: number;
}

interface Task {
  id: string;
  title: string;
  notes: string;
  timestamp: string;
}

interface SavedData {
  settings: TimerSettings;
  tasks: Task[];
}

export default function PomodoroTimer() {
  const [user] = useAuthState(auth);
  const defaultSettings: TimerSettings = {
    focusTime: 25,
    breakTime: 5
  };
  
  // Add notification function
  const notify = (message: string) => {
    if (Notification.permission === 'granted') {
      new Notification(message);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(message);
        }
      });
    }
  };
  const [settings, setSettings] = useState<TimerSettings>(defaultSettings);
  const [timeLeft, setTimeLeft] = useState(defaultSettings.focusTime * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isFocusTime, setIsFocusTime] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentTask, setCurrentTask] = useState('');
  const [currentNotes, setCurrentNotes] = useState('');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');

  // 導出數據到檔案
  const exportData = () => {
    const data: SavedData = {
      settings,
      tasks
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tomato-timer-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 導入數據從檔案
  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data: SavedData = JSON.parse(e.target?.result as string);
          setSettings(data.settings);
          setTasks(data.tasks);
          localStorage.setItem('pomodoroSettings', JSON.stringify(data.settings));
          localStorage.setItem('pomodoroTasks', JSON.stringify(data.tasks));
          alert('數據導入成功！');
        } catch {
          alert('導入失敗：無效的檔案格式');
        }
      };
      reader.readAsText(file);
    }
  };

  // Load saved settings and tasks
  useEffect(() => {
    let unsubscribe: () => void;

    if (user) {
      const docRef = doc(db, 'users', user.uid);
      
      // 設置實時監聽
      unsubscribe = onSnapshot(docRef, 
        (doc) => {
          if (doc.exists()) {
            const data = doc.data() as SavedData;
            setSettings(data.settings);
            setTasks(data.tasks);
            setSyncStatus('synced');
          }
        },
        (error) => {
          console.error("Firestore sync error:", error);
          setSyncStatus('error');
          // 如果雲端同步失敗，嘗試從本地讀取
          const savedSettings = localStorage.getItem('pomodoroSettings');
          const savedTasks = localStorage.getItem('pomodoroTasks');
          
          if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
          }
          if (savedTasks) {
            setTasks(JSON.parse(savedTasks));
          }
        }
      );
    } else {
      // 未登入時從本地讀取
      const savedSettings = localStorage.getItem('pomodoroSettings');
      const savedTasks = localStorage.getItem('pomodoroTasks');
      
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      }
    }

    // 清理函數：取消訂閱
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  // Save data with throttle
  const saveData = useCallback(async () => {
    // 避免重複保存相同的數據
    const currentSettingsString = JSON.stringify(settings);
    const currentTasksString = JSON.stringify(tasks);
    const lastSavedSettings = localStorage.getItem('pomodoroSettings');
    const lastSavedTasks = localStorage.getItem('pomodoroTasks');

    const hasChanges = currentSettingsString !== lastSavedSettings || 
                      currentTasksString !== lastSavedTasks;

    if (!hasChanges) return;

    // 保存到本地
    localStorage.setItem('pomodoroSettings', currentSettingsString);
    localStorage.setItem('pomodoroTasks', currentTasksString);
    
    // 如果已登入，同時保存到雲端
    if (user) {
      try {
        const docRef = doc(db, 'users', user.uid);
        const lastSyncStatus = syncStatus;
        if (lastSyncStatus !== 'syncing') {
          setSyncStatus('syncing');
          await setDoc(docRef, {
            settings,
            tasks,
            lastUpdated: new Date().toISOString()
          });
          setSyncStatus('synced');
        }
      } catch (error) {
        console.error("Firestore save error:", error);
        setSyncStatus('error');
      }
    }
  }, [settings, tasks, user, syncStatus]);

  // 當設置或任務改變時保存數據
  useEffect(() => {
    saveData();
  }, [settings, tasks, saveData]);

  // Timer logic
  useEffect(() => {
    if (!isRunning) return;

    let timer: NodeJS.Timeout;

    const handleTimerComplete = () => {
      // Play notification sound and show notification
      new Audio('/notification.mp3').play().catch(() => {});
      notify(isFocusTime ? '休息時間到了！' : '該開始專注了！');
      
      // Switch between focus and break time
      const newIsFocusTime = !isFocusTime;
      setIsFocusTime(newIsFocusTime);
      setTimeLeft(newIsFocusTime ? settings.focusTime * 60 : settings.breakTime * 60);
      
      if (isFocusTime && currentTask) {
        // Save task when focus time ends
        const newTask: Task = {
          id: Date.now().toString(),
          title: currentTask,
          notes: currentNotes,
          timestamp: new Date().toISOString()
        };
        setTasks(prev => [...prev, newTask]);
        setCurrentTask('');
        setCurrentNotes('');
      }
    };

    if (timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else {
      handleTimerComplete();
    }

    return () => clearInterval(timer);
  }, [
    isRunning,
    timeLeft,
    isFocusTime,
    settings.focusTime,
    settings.breakTime,
    currentTask,
    currentNotes
  ]);

  // Reset timer when settings change
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(isFocusTime ? settings.focusTime * 60 : settings.breakTime * 60);
    }
  }, [settings, isFocusTime, isRunning]);

  const toggleTimer = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const updateSettings = useCallback((focusTime: number, breakTime: number) => {
    setSettings({ focusTime, breakTime });
    setTimeLeft(focusTime * 60);
  }, []);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 space-y-6">
      <Auth />
      
      <div className="card shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-primary bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-blue-700">
            {isFocusTime ? '專注時間' : '休息時間'}
          </h1>
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {syncStatus === 'synced' && '已同步'}
                {syncStatus === 'syncing' && '同步中...'}
                {syncStatus === 'error' && '同步失敗'}
              </span>
              <div 
                className={`w-2 h-2 rounded-full ${
                  syncStatus === 'synced' ? 'bg-green-500' :
                  syncStatus === 'syncing' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
              />
            </div>
          )}
        </div>
        
        <div className="timer-display">
          {formatTime(timeLeft)}
        </div>

        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={toggleTimer}
            className="btn btn-primary"
            disabled={!currentTask && isFocusTime}
          >
            {isRunning ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
                暫停
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                開始
              </>
            )}
          </button>
          <button
            onClick={() => setTimeLeft(isFocusTime ? settings.focusTime * 60 : settings.breakTime * 60)}
            className="btn btn-secondary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重置
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="label">專注時間 (分鐘)</label>
            <input
              type="number"
              value={settings.focusTime}
              onChange={(e) => updateSettings(parseInt(e.target.value) || 25, settings.breakTime)}
              className="input"
              min="1"
            />
          </div>
          <div>
            <label className="label">休息時間 (分鐘)</label>
            <input
              type="number"
              value={settings.breakTime}
              onChange={(e) => updateSettings(settings.focusTime, parseInt(e.target.value) || 5)}
              className="input"
              min="1"
            />
          </div>
        </div>

        {isFocusTime && (
          <div className="mb-6 space-y-4">
            <div>
              <label className="label">當前任務</label>
              <input
                type="text"
                placeholder="正在進行的任務..."
                value={currentTask}
                onChange={(e) => setCurrentTask(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">備註</label>
              <textarea
                placeholder="添加一些任務細節..."
                value={currentNotes}
                onChange={(e) => setCurrentNotes(e.target.value)}
                className="input min-h-[6rem] resize-y"
              />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            工作記錄
          </h2>
          <div className="flex gap-2">
            {!user && (
              <>
                <button
                  onClick={exportData}
                  className="btn btn-primary"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  導出數據
                </button>
                <label className="btn btn-outline cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  導入數據
                  <input
                    type="file"
                    accept=".json"
                    onChange={importData}
                    className="hidden"
                  />
                </label>
              </>
            )}
          </div>
        </div>
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg font-medium">暫無工作記錄</p>
              <p className="text-sm">完成一個番茄鐘週期後，記錄將顯示在這裡</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="card card-hover bg-gray-50">
                <div className="font-medium text-gray-900">{task.title}</div>
                {task.notes && (
                  <div className="mt-2 text-gray-600 text-sm">{task.notes}</div>
                )}
                <div className="mt-3 text-gray-400 text-xs flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(task.timestamp).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
